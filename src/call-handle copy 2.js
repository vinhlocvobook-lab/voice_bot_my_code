import WebSocket from "ws";
import { log, log_sequenceDiagram } from "./logger.js";
import { handle_WebSocket_to_OpenAI } from "./ws.js";
import {
    audio_prompt, tool_get_outages, tool_compare_usage, tool_get_bill,
    tool_create_ticket, tool_procedure_info_for_family, tool_check_missing_docs,
    tool_chuyenmay, tool_hangup, tool_wait_for_user
} from './prompt.js'
const BASE = "https://api.openai.com/v1/realtime/calls";
function authHeaders() {
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
    -  gọi tool "get_bill" khi khách cần hỗ trợ tra cứu các thông tin tiền nước, thanh toán, hoá đơn tiền nước
    -  gọi tool "compare_usage" khi khách cần hỗ trợ so sánh tiền nước, sản lượng nước so với kỳ trước
    -  gọi tool "get_outages" khi khách cần hỗ trợ tra cứu thông tin gián đoạn cung cấp nước/lịch cúp nước bảo trì hiện tại theo số danh bộ.  
    -  gọi tool "get_procedure_info_for_family" khi khách có yêu cầu giải đáp các thủ tục cho hộ gia đình : 
        + Đăng ký định mức nước cho hộ gia đình
        + Đăng ký đồng hồ nước cho hộ gia đình
        + Sang Tên đồng hồ nước cho hộ gia đình
        + Nâng dời đồng hồ nước cho hộ gia đình
    -  gọi tool "get_procedure_info_for_organization" khi khách có yêu cầu giải đáp các thủ tục cho tổ chức, doanh nghiệp, công ty : 
        + Đăng ký định mức nước cho tổ chức, doanh nghiệp, công ty
        + Đăng ký đồng hồ nước cho tổ chức, doanh nghiệp, công ty
        + Sang Tên đồng hồ nước cho tổ chức, doanh nghiệp, công ty
        + Nâng dời đồng hồ nước cho tổ chức, doanh nghiệp, công ty
    - gọi tool "create_ticket" để tạo ticket : ghi nhận thông tin khiếu nại, lời nhắn của khách hàng
    - gọi tool "transfer_to_agent" để chuyển máy cho nhân viên khi khách hàng yêu cầu, hoặc các yêu cầu của khách hàng nằm ngoài các nhiệm vụ trên.
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
    
    # Mã Danh Bộ
    - Bạn không cần kiểm tra tính hợp lệ của mã danh bộ, phía backend sẽ thực hiện việc này.
    - Bất cứ khi nào khách hàng đọc số hoặc trả lời câu hỏi xác nhận, BẮT BUỘC PHẢI GỌI TOOL, TUYỆT ĐỐI KHÔNG TỰ TRẢ LỜI BẰNG LỜI NÓI
    `
    //- Mã danh bộ là 11 chữ số, đọc liên tục, liền mạch, không ngắt quãng.
    let tools = [
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

export async function handleIncomingCall(callId, fromHeader, asteriskData) {
    try {
        //accept call
        log.info(`[handleIncomingCall]: Accepting call, callId = ${callId} ` + "\n\r");
        log_sequenceDiagram(`Code-- >> OpenAI: Accept Call, callId = ${callId} `, asteriskData.fileName);
        let kq_acceptCall = await acceptCall(callId);
        await handle_WebSocket_to_OpenAI(callId, asteriskData);
    } catch (err) {
        log_sequenceDiagram(`Note over Code, OpenAI: Error ${err.message} `, asteriskData.fileName);
        log.error(`[handleIncomingCall] Lỗi xử lý cuộc gọi ${callId}: ${err.message} `, err);
    }
}