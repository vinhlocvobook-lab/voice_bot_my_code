# Hướng dẫn kết hợp: Lưu tạm Ticket trong cuộc gọi và Tạo Ticket chính thức khi `ws.on("close")`

Tài liệu này hướng dẫn chi tiết cách kết hợp cả 2 phương án:
1. **Trong cuộc gọi (Khi AI gọi `create_ticket`)**: Chỉ ghi nhớ / tích lũy thông tin vào `asteriskData.pendingTicket` và phản hồi dứt khoát để AI trấn an khách, **KHÔNG** gọi API ngoài gây gián đoạn hay tạo phiếu non.
2. **Khi kết thúc cuộc gọi (`ws.on("close")`)**: Lấy thông tin từ `pendingTicket` kết hợp với toàn bộ transcript cuộc gọi qua một hàm trích xuất/tổng hợp (LLM Post-call Extraction tương tự như `ArbitrateDanhbo`) để có đầy đủ 100% thông tin: **Tên khách, SĐT liên hệ, Địa chỉ thực tế, Mã danh bộ, Loại sự cố, Mô tả chi tiết, Giờ hẹn**, sau đó mới chính thức gọi `POST /bao-su-co` và lưu vào cơ sở dữ liệu (`insertTicket`).

---

## BƯỚC 1: Cập nhật hàm trích xuất thông tin Ticket từ Transcript (`src/gpt.js`)

Thêm hàm `extractTicketFromConversation` vào cuối file `src/gpt.js`:

```javascript
// Thêm vào src/gpt.js

const TICKET_EXTRACT_SCHEMA = {
    type: "json_schema",
    json_schema: {
        name: "ticket_extraction_verdict",
        strict: true,
        schema: {
            type: "object",
            properties: {
                has_ticket_request: {
                    type: "boolean",
                    description: "True nếu khách hàng có yêu cầu báo sự cố, khiếu nại, để lại lời nhắn hoặc cần nhân viên hỗ trợ tại nhà. False nếu chỉ hỏi thông tin thông thường.",
                },
                ten_khach_hang: {
                    type: ["string", "null"],
                    description: "Tên khách hàng nếu có nhắc đến trong hội thoại, nếu không có trả về null.",
                },
                sdt_lien_he: {
                    type: ["string", "null"],
                    description: "Số điện thoại liên hệ khách cung cấp bằng giọng nói (ví dụ 0908407321), nếu không có trả về null.",
                },
                dia_chi: {
                    type: ["string", "null"],
                    description: "Địa chỉ nhà khách hàng cung cấp để nhân viên đến kiểm tra (ví dụ: 30 đường Bình Hưng), nếu không có trả về null.",
                },
                thoi_gian_hen: {
                    type: ["string", "null"],
                    description: "Thời gian thuận tiện để liên hệ hoặc kiểm tra (ví dụ: 9 giờ sáng), nếu không có trả về null.",
                },
                ma_danh_bo: {
                    type: ["string", "null"],
                    description: "Mã danh bộ 11 chữ số đã xác nhận nếu có, nếu không trả về null.",
                },
                loai: {
                    type: "string",
                    enum: ["su_co", "khieu_nai", "loi_nhan", "khac"],
                    description: "Phân loại yêu cầu: 'su_co' (nước yếu, mất nước, rò rỉ, kẹt đồng hồ...), 'khieu_nai' (tiền nước, dịch vụ...), 'loi_nhan' (lời nhắn liên hệ lại...), 'khac'.",
                },
                mo_ta_chi_tiet: {
                    type: "string",
                    description: "Mô tả đầy đủ, chi tiết toàn bộ vấn đề của khách hàng kèm các thông tin liên hệ được cung cấp.",
                },
            },
            required: [
                "has_ticket_request",
                "ten_khach_hang",
                "sdt_lien_he",
                "dia_chi",
                "thoi_gian_hen",
                "ma_danh_bo",
                "loai",
                "mo_ta_chi_tiet",
            ],
            additionalProperties: false,
        },
    },
};

/**
 * Trích xuất toàn bộ thông tin ticket từ hội thoại sau khi cuộc gọi kết thúc.
 */
export async function extractTicketFromConversation(conversation, pendingTicket = {}) {
    if (!conversation || conversation.trim().length === 0) return null;

    const prompt = `Dưới đây là toàn bộ cuộc hội thoại giữa AI (Tổng đài Cấp nước Trung An) và Khách hàng:

${conversation}

Thông tin bổ sung bot đã ghi nhận trong cuộc gọi (nếu có):
${JSON.stringify(pendingTicket, null, 2)}

NHIỆM VỤ:
1. Xác định xem khách hàng có yêu cầu lập phiếu sự cố, khiếu nại, hẹn kiểm tra đồng hồ/đường ống tại nhà hoặc để lại lời nhắn hay không (has_ticket_request = true/false).
2. Trích xuất chính xác:
   - Tên khách hàng (nếu có).
   - Địa chỉ khách cung cấp (nếu có).
   - Số điện thoại liên hệ (nếu khách đọc SĐT khác số gọi đến).
   - Thời gian hẹn khách mong muốn (nếu có).
   - Mã danh bộ 11 số (nếu có).
   - Phân loại (su_co, khieu_nai, loi_nhan, khac).
   - mo_ta_chi_tiet: Tổng hợp mạch lạc nội dung sự cố kèm địa chỉ, SĐT liên hệ và thời gian hẹn nếu có.`;

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: ARBITER_MODEL, // hoặc "gpt-5.1" / "gpt-4o-mini"
                messages: [{ role: "user", content: prompt }],
                response_format: TICKET_EXTRACT_SCHEMA,
            }),
        });

        if (!res.ok) {
            log.warn(`[TicketExtractor] API lỗi ${res.status}`);
            return null;
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;
        return JSON.parse(content);
    } catch (err) {
        log.warn(`[TicketExtractor] Lỗi extract: ${err.message}`);
        return null;
    }
}
```

---

## BƯỚC 2: Điều chỉnh Tool Handler `create_ticket_handler` (`src/tool_handler/create_ticket.js`)

Khi khách đang trong cuộc đàm thoại và AI gọi tool `create_ticket`, chúng ta **chỉ lưu vào biến `asteriskData.pendingTicket`** và phản hồi xác nhận để khách yên tâm, **chưa gọi API backend ngay**:

Nội dung thay thế file `src/tool_handler/create_ticket.js`:

```javascript
import { log } from "../logger.js";

export async function create_ticket_handler(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }

    const { ma_danh_bo, loai, mo_ta, ten, summary } = args;

    // ✅ PHƯƠNG ÁN KẾT HỢP (GIAI ĐOẠN 1):
    // Lưu tạm và tích lũy thông tin ticket vào session memory của cuộc gọi
    asteriskData.pendingTicket = {
        ...(asteriskData.pendingTicket || {}),
        ma_danh_bo: ma_danh_bo || asteriskData.ma_danh_bo_confirmed || asteriskData.pendingTicket?.ma_danh_bo,
        loai: loai || asteriskData.pendingTicket?.loai || "su_co",
        mo_ta: mo_ta || asteriskData.pendingTicket?.mo_ta,
        ten: ten || asteriskData.pendingTicket?.ten,
        summary: summary || asteriskData.pendingTicket?.summary,
        requestedAt: new Date().toISOString(),
    };

    log.info(`[create_ticket_handler] Đã ghi nhớ thông tin ticket tạm thời:`, asteriskData.pendingTicket);

    // Báo thành công cho OpenAI Realtime để tiếp tục hội thoại tự nhiên
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({
                success: true,
                message: "Đã ghi nhận thông tin yêu cầu của Quý Khách vào hệ thống.",
                pending: true,
            }),
        },
    });

    send_message({
        type: "response.create",
        response: {
            instructions: "Thông báo với khách em đã ghi nhận thông tin phản ánh/lời nhắn của Quý Khách. Hỏi khách có cần bổ sung thêm thông tin gì (như địa chỉ, số điện thoại, giờ hẹn) hoặc cần hỗ trợ gì thêm không.",
        },
    });

    return { success: true, pending: true, data: asteriskData.pendingTicket };
}
```

---

## BƯỚC 3: Xử lý tạo Ticket chính thức tại `ws.on("close")` (`src/ws.js`)

Khi cuộc gọi kết thúc, WebSocket đóng (`ws.on("close")`). Đây là thời điểm an toàn nhất vì toàn bộ transcript từ đầu đến cuối đã hoàn tất. Ta tiến hành:
1. Kiểm tra nếu có `pendingTicket` hoặc kiểm tra transcript qua `extractTicketFromConversation`.
2. Lập nội dung chi tiết gồm: Tên, SĐT liên hệ, Địa chỉ, Giờ hẹn, Nội dung sự cố.
3. Gọi `POST /bao-su-co` (`baoSuCo`) và lưu vào cơ sở dữ liệu (`insertTicket`).

### Cập nhật trong `src/ws.js`:

#### 3.1. Thêm import ở đầu `src/ws.js`:
```javascript
import { extractTicketFromConversation } from "./gpt.js";
import { baoSuCo } from "./api.js";
import { insertTicket } from "./integrations/calllog-api.js";
```

#### 3.2. Chèn đoạn xử lý tạo ticket vào trong sự kiện `ws.on("close")` (trước hoặc ngay sau khi lưu file json summary):

```javascript
    ws.on("close", async (code, reason) => {
        log_sequenceDiagram(`OpenAI->>Code: close`, asteriskData.fileName);
        log_sequenceDiagram(`Note over Code,OpenAI: ${code} ${reason?.toString()}`, asteriskData.fileName);
        log.info(`[WS][${callId}]WebSocket đóng: ${code} ${reason?.toString()}`);
        if (greetingTimeout) clearTimeout(greetingTimeout);

        // =========================================================================
        // ✅ TẠO TICKET CHÍNH THỨC KHI KẾT THÚC CUỘC GỌI
        // =========================================================================
        try {
            const hasPending = !!asteriskData.pendingTicket;
            const conversationText = asteriskData.conversation || "";

            // Nếu bot từng gọi create_ticket HOẶC trong hội thoại có từ khóa sự cố/lời nhắn
            const shouldCheckTicket = hasPending || 
                /sự cố|nước yếu|mất nước|xì bể|kiểm tra|lời nhắn|khiếu nại|liên hệ lại/i.test(conversationText);

            if (shouldCheckTicket) {
                log.info(`[WS][${callId}][Post-Call Ticket] Đang tổng hợp thông tin tạo phiếu...`);
                const extracted = await extractTicketFromConversation(conversationText, asteriskData.pendingTicket);

                if (extracted && extracted.has_ticket_request) {
                    const finalMdb = extracted.ma_danh_bo || 
                                     asteriskData.ma_danh_bo_confirmed || 
                                     asteriskData.pendingTicket?.ma_danh_bo || 
                                     null;

                    const finalTel = extracted.sdt_lien_he || 
                                    asteriskData.phoneNumber_real || 
                                    asteriskData.phoneNumber;

                    // Xây dựng nội dung chi tiết đầy đủ
                    const parts = [];
                    if (extracted.ten_khach_hang) parts.push(`Khách hàng: ${extracted.ten_khach_hang}`);
                    if (extracted.dia_chi) parts.push(`Địa chỉ: ${extracted.dia_chi}`);
                    if (extracted.sdt_lien_he) parts.push(`SĐT liên hệ: ${extracted.sdt_lien_he}`);
                    if (extracted.thoi_gian_hen) parts.push(`Giờ hẹn: ${extracted.thoi_gian_hen}`);
                    parts.push(`Nội dung: ${extracted.mo_ta_chi_tiet}`);

                    const loaiTag = extracted.loai ? `[${extracted.loai}] ` : "[su_co] ";
                    const noiDungBao = loaiTag + parts.join(" | ");

                    log.info(`[WS][${callId}][Post-Call Ticket] Gửi API tạo phiếu: MDB=${finalMdb}, SĐT=${finalTel}, Nội dung=${noiDungBao}`);

                    // 1. Gọi API Tổng đài tạo phiếu
                    const rBaoSuCo = await baoSuCo(finalMdb, noiDungBao, finalTel);
                    log.info(`[WS][${callId}][Post-Call Ticket] Kết quả API bao-su-co:`, rBaoSuCo);

                    // 2. Ghi nhận vào Database bảng voicebot_tickets
                    await insertTicket({
                        callId,
                        customerTel: finalTel,
                        args: {
                            ma_danh_bo: finalMdb,
                            loai: extracted.loai,
                            mo_ta: noiDungBao,
                            ten: extracted.ten_khach_hang,
                            dia_chi: extracted.dia_chi,
                            sdt_lien_he: extracted.sdt_lien_he,
                            thoi_gian_hen: extracted.thoi_gian_hen,
                        },
                        output: rBaoSuCo,
                    });

                    // Lưu vào sessionLogger để ghi nhận vào summary
                    sessionLogger.createdTicket = {
                        success: rBaoSuCo.success,
                        data: rBaoSuCo.data,
                        details: extracted,
                    };
                } else {
                    log.info(`[WS][${callId}][Post-Call Ticket] Không có yêu cầu tạo phiếu từ hội thoại.`);
                }
            }
        } catch (errTicket) {
            log.error(`[WS][${callId}][Post-Call Ticket] Lỗi tạo phiếu sau cuộc gọi: ${errTicket.message}`);
        }
        // =========================================================================

        // Lưu document call summary và finalizeCallLog như hiện tại...
```

---

## BƯỚC 4: Sửa câu instruction trong `src/tool_handler/tool_call.js` (Tránh đọc "nguyên văn là")

Tại các hàm `transfer_to_agent_handler` và `end_call_handler` trong `src/tool_handler/tool_call.js`, sửa lại lệnh `instructions`:

```javascript
// ❌ Cũ:
instructions: `Nói nguyên văn trường "say_verbatim_for_user" trong kết quả tool vừa nhận được`

// ✅ Mới:
instructions: `Đọc chính xác câu thoại sau cho khách hàng, KHÔNG thêm bớt lời dẫn, KHÔNG nói cụm từ "nguyên văn là": "${cauThoai}"`
```

---

## TỔNG KẾT ƯU ĐIỂM KHI TRIỂN KHAI
1. **Không bị "tạo phiếu non"**: Khách nói địa chỉ hay SĐT ở bất kỳ lúc nào trong cuộc gọi cũng được gom trọn vẹn vào nội dung phiếu.
2. **Không làm chậm cuộc đàm thoại**: Bot không bị khựng lại để chờ API bên thứ ba.
3. **Phiếu cực kỳ chuẩn chỉ**: Đội kỹ thuật nhận phiếu sẽ có đầy đủ cấu trúc: `[su_co] Khách hàng: Tân Đà Lộc | Địa chỉ: 30 đường Bình Hưng | SĐT liên hệ: 0908407321 | Giờ hẹn: 9 giờ sáng | Nội dung: Cho người xuống kiểm tra đường ống nước nhà anh.`
