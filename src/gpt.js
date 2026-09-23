import "dotenv/config";
import { log, log_sequenceDiagram } from "./logger.js";
const ARBITER_MODEL = process.env.DANH_BO_ARBITER_MODEL || "gpt-5.1";

const ARBITER_TIMEOUT_MS = Number(process.env.DANH_BO_ARBITER_TIMEOUT_MS || 20000);
const ARBITER_REASONING_EFFORT = process.env.DANH_BO_ARBITER_REASONING_EFFORT || "low";
const VERDICT_SCHEMA = {
    type: "json_schema",
    json_schema: {
        name: "danh_bo_verdict",
        strict: true,
        schema: {
            type: "object",
            properties: {
                intent: {
                    type: "string",
                    enum: ["compare_usage", "get_bill", "get_outages", "create_ticket", "khác"],
                    description: `Mục đích ban đầu của cuộc gọi: 
                    - 'compare_usage' nếu khách hàng yêu cầu so sánh sản lượng / tiền nước nước hoặc khách cần giải thích hay phản ánh về việc sản lượng/tiền nước bị tăng/giảm đột ngột hoặc có sự thay đổi bất thường, 
                    - 'get_bill' nếu khách hàng yêu cầu tra cứu tiền nước / hóa đơn / sản lượng,
                    - 'get_outages' nếu khách hàng yêu cầu tra cứu tình hình cúp nước,
                    - 'create_ticket' nếu khách hàng yêu cầu tạo ticket,
                    - 'khác' nếu khách hàng yêu cầu dịch vụ khác.`,
                },
                ma_danh_bo: {
                    type: ["string", "null"],
                    description: "Chuỗi ĐÚNG 11 chữ số suy ra được, hoặc null nếu không đủ tin cậy để ghép.",
                },
                ma_danh_bo_length: {
                    type: ["number"],
                    description: "Tổng số chữ số khách hàng cung cấp, nếu chưa cung cấp thì trả về là 0"
                },
                xac_nhan: {
                    type: "string",
                    description: `Xác nhận số danh bộ, trả về 
                    - 'đúng' nếu khách hàng đã xác nhận đúng mã danh bộ, 
                    - 'sai' nếu khách hàng xác nhận là sai hoặc  
                    - 'chưa_xác_nhận' nếu mã danh bộ chưa được xác nhận.`,
                    enum: ['đúng', 'sai', 'chưa_xác_nhận']
                },
                do_tin_cay: {
                    type: "number",
                    description: "Độ tin cậy từ 0.0 đến 1.0 rằng ma_danh_bo là đúng.",
                },
                ly_do: {
                    type: "string",
                    description: "Giải thích ngắn gọn cách ghép/suy luận.",
                },
            },
            required: ["intent", "ma_danh_bo", "xac_nhan", "ma_danh_bo_length", "do_tin_cay", "ly_do"],
            additionalProperties: false,
        },
    },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function get_so_danh_bo(asteriskData) {

    const ctrl = asteriskData.gptController;

    for (let i = 0; i < 5; i++) {
        if (ctrl?.signal?.aborted) {
            throw new Error("old_tool");

        }
        if (!asteriskData.input_transcript_is_completed) {
            await sleep(500);
            if (ctrl?.signal?.aborted) {
                throw new Error("old_tool");

            }
            continue;
        } else {
            break;
        }
    }
    if (ctrl?.signal?.aborted) {
        throw new Error("old_tool");

    }
    if (!asteriskData.input_transcript_is_completed) {
        log.warn("[get_so_danh_bo]: input_transcript_is_completed is false");
        return null;
    }
    let conversation = asteriskData.conversation;
    const prompt = `Hãy dựa vào toàn bộ cuộc hội thoại sau đây để lấy thông tin mã danh bộ khách hàng cung cấp

${conversation}

Trả về DUY NHẤT JSON:
{"intent": "intent",
 "ma_danh_bo": "chuỗi 11 chữ số hoặc null nếu không suy ra được",
 "ma_danh_bo_length":"Tổng số chữ số khách hàng cung cấp, nếu chưa cung cấp thì trả về là 0",
 "xac_nhan": 'đúng' nếu mã danh bộ đã được xác nhận, ngược lại trả về 'sai' hoặc 'chưa_xác_nhận'.",
  "do_tin_cay": 0.0-1.0, 
  "ly_do": "giải thích ngắn cách ghép"}`;


    console.log("=================ArbitrateDanhbo=================");
    console.log("[arbitrateDanhBo]:prompt = ", prompt);
    console.log("=================================================");
    // const ctrl =  new AbortController();

    const timer = setTimeout(() => ctrl.abort("timeout"), ARBITER_TIMEOUT_MS);
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            signal: ctrl.signal,
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: ARBITER_MODEL,
                messages: [{ role: "user", content: prompt }],
                response_format: VERDICT_SCHEMA,
                reasoning_effort: ARBITER_REASONING_EFFORT,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            log.warn(`[Arbiter] API lỗi ${res.status}: ${err.slice(0, 300)}`);
            return null;
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        // log.debug(`[Arbiter] raw content: ${content}`);
        if (!content) return null;
        const out = JSON.parse(content);
        // log.info(
        //     `[Arbiter] model=${ARBITER_MODEL} → ma_danh_bo=${out.ma_danh_bo} ` +
        //     `| xac_nhan=${out.xac_nhan} | do_tin_cay=${out.do_tin_cay} | tokens=${data.usage?.total_tokens ?? "?"} | ly_do=${out.ly_do}`
        // );
        return { ...out, _usage: data.usage ?? null };
    } catch (err) {
        const reason = ctrl?.signal?.reason;

        console.log(
            `ℹ️ Arbiter bị hủy. Lý do: ${reason}`
        );

        log.warn(`[Arbiter] Lỗi: ${err.name === "AbortError" ? `timeout ${ARBITER_TIMEOUT_MS}ms` : err.message}`);
        if (reason === "old_tool") {
            throw new Error(`old_tool`)
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}
const TICKET_SCHEMA = {
    type: "json_schema",
    json_schema: {
        name: "ticket_verdict",
        strict: true,
        schema: {
            type: "object",
            properties: {
                can_tao_phieu: {
                    type: "boolean",
                    description: "true nếu khách hàng thực sự có yêu cầu tạo phiếu (sự cố/phản ánh/khiếu nại/lời nhắn) cần xử lý trong cuộc gọi này, false nếu không có yêu cầu như vậy.",
                },
                loai: {
                    type: ["string", "null"],
                    enum: ["su_co", "khieu_nai", "loi_nhan", "khac", null],
                    description: "Loại yêu cầu.",
                },
                noi_dung_chi_tiet: {
                    type: ["string", "null"],
                    description: "Mô tả ĐẦY ĐỦ nội dung phản ánh/sự cố/lời nhắn, gộp toàn bộ chi tiết khách đã cung cấp trong suốt cuộc gọi (địa chỉ, số điện thoại liên hệ, giờ liên hệ mong muốn, mô tả sự cố...). Chỉ dùng thông tin khách thực sự nói trong hội thoại, không suy diễn thêm.",
                },
                ten: {
                    type: ["string", "null"],
                    description: "Tên khách hàng nếu có nhắc tới trong hội thoại.",
                },
                ma_danh_bo: {
                    type: ["string", "null"],
                    description: "Mã danh bộ 11 chữ số nếu đã được xác nhận trong cuộc gọi.",
                },
                ten_nguoi_lien_he: {
                    type: "string",
                    description:
                        "Tên người đang liên hệ hoặc người khách yêu cầu liên hệ lại, nếu được nói rõ.",
                },
                dia_chi: {
                    type: "string",
                    description:
                        "Địa chỉ hoặc khu vực xảy ra sự cố/phản ánh, nếu khách cung cấp.",
                },
                so_dien_thoai_lien_he: {
                    type: "string",
                    description:
                        "Số điện thoại khách muốn được liên hệ lại, nếu khách cung cấp rõ.",
                },
                khung_gio_lien_he: {
                    type: "string",
                    description:
                        "Khung giờ hoặc thời điểm khách muốn được liên hệ lại, nếu có.",
                },
            },
            required: ["can_tao_phieu", "loai", "noi_dung_chi_tiet", "ten", "ma_danh_bo", "ten_nguoi_lien_he", "dia_chi", "so_dien_thoai_lien_he", "khung_gio_lien_he"],
            additionalProperties: false,
        },
    },
};

export async function synthesizeTicket(asteriskData) {
    console.log("[synthesizeTicket]:bắt đầu");
    const notes = asteriskData.pendingTicketNotes || [];
    // if (notes.length === 0) return null;

    const conversation = asteriskData.conversation || "";
    const notesText = notes
        .map((n, i) => `Ghi chú ${i + 1}: loai=${n.loai || "?"}, ten=${n.ten || "?"}, so_dien_thoai_lien_he=${n.so_dien_thoai_lien_he || "?"}, dia_chi=${n.dia_chi || "?"}, so_dien_thoai_lien_he=${n.so_dien_thoai_lien_he || "?"}, khung_gio_lien_he=${n.khung_gio_lien_he || "?"}, noi_dung_chi_tiet=${n.noi_dung_chi_tiet || "?"},`)
        .join("\n");

    const prompt = `Dựa vào toàn bộ hội thoại cuộc gọi CSKH sau đây và các ghi chú tool đã ghi nhận trong lúc gọi, hãy tổng hợp lại đầy đủ và chính xác nội dung để tạo 1 phiếu tiếp nhận (ticket) DUY NHẤT.

Hội thoại:
${conversation}

Ghi chú tool trong lúc gọi:
${notesText}

Chỉ dùng thông tin khách hàng thực sự đã nói trong hội thoại và ghi chú tool ở trên, KHÔNG bịa thêm chi tiết nào khác. Nếu khách cung cấp thêm địa chỉ/SĐT liên hệ/giờ liên hệ ở các lượt nói sau, PHẢI gộp đầy đủ vào noi_dung_chi_tiet. Hãy trả về DUY NHẤT JSON theo schema.`;

    console.log("=================SynthesizeTicket=================");
    console.log("[synthesizeTicket]:prompt = ", prompt);
    console.log("===================================================");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort("timeout"), ARBITER_TIMEOUT_MS);
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            signal: ctrl.signal,
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: ARBITER_MODEL,
                messages: [{ role: "user", content: prompt }],
                response_format: TICKET_SCHEMA,
                reasoning_effort: ARBITER_REASONING_EFFORT,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            log.warn(`[TicketSynth] API lỗi ${res.status}: ${err.slice(0, 300)}`);
            return null;
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) return null;
        return JSON.parse(content);
    } catch (err) {
        log.warn(`[TicketSynth] Lỗi: ${err.name === "AbortError" ? `timeout ${ARBITER_TIMEOUT_MS}ms` : err.message}`);
        return null;
    } finally {
        clearTimeout(timer);
    }
}