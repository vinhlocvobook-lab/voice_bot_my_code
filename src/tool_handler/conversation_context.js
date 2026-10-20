import { answer_conversation_history } from "../gpt.js";
import { log, log_with_file } from "../logger.js";

export async function get_conversation_history_handler(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }

    const noidung = args.noidung || "";
    log.info(`[tools][get_conversation_history] noidung: "${noidung}"`);
    log_with_file(asteriskData?.fileName, `[tools][get_conversation_history] Khách hỏi lại: "${noidung}"`);

    let cauTraLoi = "";
    try {
        const kq = await answer_conversation_history(asteriskData, noidung);
        if (kq && kq.cau_tra_loi) {
            cauTraLoi = kq.cau_tra_loi;
        }
    } catch (err) {
        log.warn(`[tools][get_conversation_history] Lỗi khi gọi GPT: ${err.message}`);
        log_with_file(asteriskData?.fileName, `[tools][get_conversation_history] Lỗi khi gọi GPT: ${err.message}`);
    }

    // Fallback nếu GPT không trả về câu thoại
    if (!cauTraLoi) {
        cauTraLoi = "Dạ, Quý khách cần em nhắc lại thông tin nào về tiền nước, mã danh bộ hay lịch cúp nước ạ?";
    }

    log.info(`[tools][get_conversation_history] cauTraLoi: "${cauTraLoi}"`);
    log_with_file(asteriskData?.fileName, `[tools][get_conversation_history] Trả lời khách: "${cauTraLoi}"`);

    // 1. Gửi output của tool về OpenAI Realtime session
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({
                success: true,
                noidung: noidung,
                say_verbatim: cauTraLoi,
            }),
        },
    });

    // 2. Kích hoạt model đọc câu trả lời
    send_message({
        type: "response.create",
        response: {
            instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được, không thêm bớt hay suy diễn gì thêm.`,
        },
    });

    return {
        success: true,
        noidung: noidung,
        cau_tra_loi: cauTraLoi,
    };
}