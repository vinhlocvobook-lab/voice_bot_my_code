import WebSocket from "ws";
import { log, log_sequenceDiagram } from "./logger.js";
import { handle_WebSocket_to_OpenAI } from "./ws.js";
import { getThongTinKhachHang, getAvailableAgents } from "./integrations/tongdai-api.js";
import { closeDb, getDanhBoHistory } from "./integrations/calllog-api.js";
import {
    audio_prompt, tool_get_outages, tool_compare_usage, tool_get_bill,
    tool_create_ticket, tool_procedure_info_for_family, tool_check_missing_docs,
    tool_chuyenmay, tool_hangup, tool_wait_for_user,
    tool_get_so_danh_bo
} from './prompt.js'
const BASE = "https://api.openai.com/v1/realtime/calls";
function authHeaders() {
    // console.log(`Authorization: Bearer ${process.env.OPENAI_API_KEY}`);
    return {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
    };
}




/**
 * Accept một incoming call và cấu hình Realtime session.
 * @param {string} callId
 * @returns {Promise<object>} - Response body từ OpenAI
 */
async function acceptCall(callId) {
    const now = new Date();
    // Lấy ngày/tháng/năm theo giờ Việt Nam
    const vnTime = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(now);
    const day = vnTime.find(p => p.type === 'day')?.value;
    const month = vnTime.find(p => p.type === 'month')?.value;
    const year = vnTime.find(p => p.type === 'year')?.value;

    let instructions = `
     # Context & Realtime Date
    - Thời gian hiện tại: Ngày ${day} tháng ${month} năm ${year}.
    - Tháng hiện tại là tháng ${month} (kỳ ${month}).

    # Role and Objective
    - Tên: Trợ lý Ảo Ây Ai.
    - Vai trò: Nhân viên chăm sóc khách hàng của "Công ty Cổ phần Cấp nước Trung An".
    
    # Language
    - Luôn trả lời bằng tiếng Việt, bất kể khách nói giọng vùng miền nào, phát âm không chuẩn, hay lẫn từ tiếng Anh/từ đệm. 
    - Giọng nói (accent) của khách KHÔNG phải tín hiệu để đổi ngôn ngữ trả lời.
    
    ## QUY TẮC THƯƠNG HIỆU VÀ TÊN CÔNG TY (BẮT BUỘC)
    - Tên công ty CHÍNH XÁC: "Công ty Cổ phần Cấp nước Trung An".
    - TUYỆT ĐỐI CẤM: Không tự dịch tên công ty sang tiếng Anh (CẤM dùng "Trung An Water", "Water Company", "Water Supply").
    - TUYỆT ĐỐI CẤM: Không chêm từ tiếng Anh vào lời thoại.

    # Personality and Tone
    - Luôn xưng "Em" và gọi người gọi là "Quý khách"
    - KHÔNG NHẠI LỜI: Tuyệt đối KHÔNG lặp lại nguyên văn câu nói của khách.
    
    ## Preambles
    - Khi cần thời gian tra cứu, nói câu này: "Dạ, Quý khách đợi em một chút ạ.".
    - Khi khách hàng đang đọc dở các cụm số hoặc đọc chậm từng số, tuyệt đối giữ im lặng lắng nghe cho đến khi khách đọc xong toàn bộ dãy số, không nói chen ngang (như Dạ, Vâng, Chờ chút), không gọi tool 'wait_for_user' khi khách chưa đọc xong số.

    # QUY TẮC CỐT LÕI: QUẢN LÝ MÃ DANH BỘ BẰNG TOOL 'get_so_danh_bo'
    - BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ HỎI SỐ DANH BỘ BẰNG GIỌNG NÓI (CẤM nói các câu như: "Dạ Quý khách cho em xin mã danh bộ", "Quý khách đọc số danh bộ giúp em"...).
    - BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ ĐỌC LẠI SỐ HOẶC TỰ HỎI XÁC NHẬN (CẤM tự đọc số, CẤM tự hỏi "có đúng không ạ").
    - BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ NÓI khi khách vừa đọc một dãy số hoặc khi khách trả lời xác nhận "đúng" / "sai".
    
    - HÀNH ĐỘNG BẮT BUỘC: PHẢI GỌI TOOL 'get_so_danh_bo' trong 3 trường hợp sau:
      1. Ngay khi khách yêu cầu bất kỳ dịch vụ nào cần mã danh bộ (tiền nước, hóa đơn, cúp nước, so sánh sản lượng...) mà cuộc gọi chưa có mã danh bộ đã xác nhận.
      2. Khi khách hàng đọc mã danh bộ hoặc một dãy số bất kỳ.
      3. Khi khách hàng trả lời xác nhận (đúng rồi, chính xác, sai rồi, không phải...).
    - TẤT CẢ CÂU THOẠI HỎI SỐ, NHẮC ĐỌC LẠI, VÀ ĐỌC XÁC NHẬN SỐ ĐỀU DO TOOL QUẢN LÝ. BẠN CHỈ ĐƯỢC PHÁT ÂM THEO CHỈ DẪN CHÍNH XÁC TỪ TOOL.
    - KHI MÃ DANH BỘ ĐÃ ĐƯỢC XÁC NHẬN THÀNH CÔNG: Dựa vào yêu cầu ban đầu của khách hàng trong cuộc gọi (ví dụ khách hỏi tiền nước/hóa đơn), hãy GỌI TIẾP NGAY tool nghiệp vụ tương ứng (ví dụ gọi tool 'get_bill') để lấy thông tin. TUYỆT ĐỐI KHÔNG hỏi lại khách câu hỏi thừa.
    `
    // - Khi chuẩn bị gọi tool, TUYỆT ĐỐI KHÔNG nói câu đệm hay câu dẫn trước (CẤM nói: "để em ghi nhận nhé", "chờ em một chút", "để em mở thông tin"). Hãy phát ra function call ngay lập tức.

    //- Mã danh bộ là 11 chữ số, đọc liên tục, liền mạch, không ngắt quãng.
    // -  gọi tool "get_bill" khi khách cần hỗ trợ tra cứu các thông tin tiền nước, thanh toán, hoá đơn tiền nước
    // -  gọi tool "compare_usage" khi khách cần hỗ trợ so sánh tiền nước, sản lượng nước so với kỳ trước
    // -  gọi tool "get_outages" khi khách cần hỗ trợ tra cứu thông tin gián đoạn cung cấp nước/lịch cúp nước bảo trì hiện tại theo số danh bộ.  
    // -  gọi tool "get_procedure_info_for_family" khi khách có yêu cầu giải đáp các thủ tục cho hộ gia đình : 
    //     + Đăng ký định mức nước cho hộ gia đình
    //     + Đăng ký đồng hồ nước cho hộ gia đình
    //     + Sang Tên đồng hồ nước cho hộ gia đình
    //     + Nâng dời đồng hồ nước cho hộ gia đình
    // -  gọi tool "get_procedure_info_for_organization" khi khách có yêu cầu giải đáp các thủ tục cho tổ chức, doanh nghiệp, công ty : 
    //     + Đăng ký định mức nước cho tổ chức, doanh nghiệp, công ty
    //     + Đăng ký đồng hồ nước cho tổ chức, doanh nghiệp, công ty
    //     + Sang Tên đồng hồ nước cho tổ chức, doanh nghiệp, công ty
    //     + Nâng dời đồng hồ nước cho tổ chức, doanh nghiệp, công ty
    // - gọi tool "create_ticket" để tạo ticket : ghi nhận thông tin khiếu nại, lời nhắn của khách hàng
    // - gọi tool "transfer_to_agent" để chuyển máy cho nhân viên khi khách hàng yêu cầu, hoặc các yêu cầu của khách hàng nằm ngoài các nhiệm vụ trên.
    let tools = [
        tool_get_so_danh_bo,
        tool_get_bill,
        tool_get_outages,
        tool_compare_usage,
        tool_procedure_info_for_family,
        tool_check_missing_docs,
        tool_create_ticket,
        tool_chuyenmay,
        tool_hangup,
        tool_wait_for_user
    ];


    const accept_body = {
        type: "realtime",
        model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini",
        reasoning: { effort: process.env.OPENAI_REALTIME_REASONING_EFFORT || "low" },
        instructions,
        tools: tools,
        parallel_tool_calls: false,
        audio: {
            input: {
                transcription: {
                    model: "gpt-4o-transcribe",
                    language: "vi",
                    prompt: audio_prompt,
                },
            },

            output: {
                voice: process.env.OPENAI_VOICE || "alloy",
            },
        },
    };
    log.info("accept url: " + `${BASE}/${callId}/accept`);
    const res = await fetch(`${BASE}/${callId}/accept`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(accept_body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Accept call failed ${res.status}: ${text} `);
    }
    log.info(`[CallMgr] Call ${callId} accepted`);
    // OpenAI trả 200 OK với body rỗng hoặc JSON – xử lý cả hai trường hợp
    const text = await res.text();
    console.log("[CallMgr] :text :", text);
    // Trả về body đã gửi để logger lưu lại (phân tích/điều chỉnh prompt)
    return accept_body;
}

/**
 * Chuyển máy (SIP REFER) sang URI khác.
 * @param {string} callId
 * @param {string} targetUri - VD: "sip:200@asterisk_host" hoặc "tel:+84901234567"
 */
export async function referCall(callId, targetUri) {
    log.info(`[CallMgr] Referring call ${callId} → ${targetUri}`);
    setTimeout(async () => {
        try {
            const res = await fetch(`${BASE}/${callId}/refer`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ target_uri: targetUri }),
            });
            if (!res.ok) {
                const text = await res.text();
                log.error(`[CallMgr] Refer ${callId} thất bại ${res.status}: ${text}`);
            } else {
                log.info(`[CallMgr] Refer ${callId} thành công`);
            }
        } catch (err) {
            log.error(`[CallMgr] Refer ${callId} lỗi mạng: ${err.message}`);
        }
    }, 2000);
}

/**
 * Cúp máy.
 * @param {string} callId
 */
export async function hangupCall(callId) {
    log.info(`[CallMgr] Hanging up call ${callId}`);
    setTimeout(async () => {
        try {
            const res = await fetch(`${BASE}/${callId}/hangup`, {
                method: "POST",
                headers: authHeaders(),
            });
            if (!res.ok) {
                const text = await res.text();
                // 404/call_id_not_found = cuộc gọi đã kết thúc → coi như thành công, KHÔNG ném lỗi
                if (res.status === 404) {
                    log.info(`[CallMgr] Hangup ${callId}: cuộc gọi đã kết thúc trước đó (404), bỏ qua.`);
                } else {
                    log.error(`[CallMgr] Hangup ${callId} thất bại ${res.status}: ${text}`);
                }
            } else {
                log.info(`[CallMgr] Hangup ${callId} thành công`);
            }
        } catch (err) {
            // Bắt mọi lỗi mạng để không làm sập tiến trình
            log.error(`[CallMgr] Hangup ${callId} lỗi mạng: ${err.message}`);
        }
    }, 3000);
}
async function get_so_danh_bo(tel, callId = '') {
    let knownDanhBo = [];
    if (tel && tel !== "Unknown") {
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 3000)
            );
            const r = await Promise.race([getThongTinKhachHang(null, tel), timeoutPromise]);
            console.log('==getThongTinKhachHang===tel: ', tel);
            console.log('==getThongTinKhachHang===r : ', r);

            knownDanhBo = (Array.isArray(r?.data) ? r.data : [])
                .map((c) => String(c?.danhBa ?? "").replace(/\D/g, ""))
                .filter(Boolean);
            log.info(`[Call][${callId}] Lookup SĐT ${tel}: ${r?.data?.length ?? 0} hợp đồng`);
        } catch (err) {
            log.warn?.(`[Call][${callId}] Lookup SĐT thất bại (${err.message}), tiếp tục không có context`);
        }
    }

    console.log("1./: ", { tel, knownDanhBo });
    if (tel && tel !== "Unknown" && knownDanhBo.length === 0) {
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("timeout")), 2000)
            );
            const candidates = await Promise.race([getDanhBoHistory(tel, { limit: 1, days: 180 }), timeoutPromise]);
            console.log("[getDanhBoHistory]: candidates===: ", candidates);
            const list = Array.isArray(candidates) ? candidates : [];
            knownDanhBo = list
                .map((c) => String(c?.ma_danh_bo ?? "").replace(/\D/g, ""))
                .filter(Boolean);
            if (knownDanhBo.length) {
                log.info(`[Call][${callId}] Lịch sử SĐT ${tel}: ${knownDanhBo.length} mã danh bộ từng xác nhận — đưa vào customerContext.`);
            }
        } catch (err) {
            log?.warn?.(`[Call][${callId}] Tra lịch sử danh bộ theo SĐT thất bại (${err.message}), bỏ qua.`);
        }
    }
    console.log("2./ historyDanhBo===: ", { tel, knownDanhBo });
    return knownDanhBo;
}
export async function handleIncomingCall(callId, fromHeader, asteriskData) {
    try {
        //accept call
        log.info(`[handleIncomingCall]: Accepting call, callId = ${callId} ` + "\n\r");
        log_sequenceDiagram(`Code-->> OpenAI: Accept Call, callId = ${callId} `, asteriskData.fileName);
        const t0 = Date.now();
        let kq_acceptCall = await acceptCall(callId);
        console.log(`[CallMgr] accept fetch mất ${Date.now() - t0}ms`);
        let knowDanhbo = await get_so_danh_bo(asteriskData.phoneNumber, callId);
        if (knowDanhbo?.length > 0) {
            asteriskData.ma_danh_bo_list = knowDanhbo;
            // kq.ma_danh_bo_count = knowDanhbo.length;
            // kq.ma_danh_bo_checking = knowDanhbo[0];
            // kq.ma_danh_bo_phase = 2;
        }
        // log.info(`[handleIncomingCall]: asteriskData = ` + "\n\r");
        // console.log('handleIncomingCall: asteriskData= ', asteriskData);
        await handle_WebSocket_to_OpenAI(callId, asteriskData);
    } catch (err) {
        log_sequenceDiagram(`Note over Code, OpenAI: Error ${err.message} `, asteriskData.fileName);
        log.error(`[handleIncomingCall] Lỗi xử lý cuộc gọi ${callId}: ${err.message} `, err);
    }
}