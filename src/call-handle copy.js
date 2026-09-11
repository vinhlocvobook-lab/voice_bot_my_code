import { closeCall, sendDtmf, startRealtimeAudio, stopRealtimeAudio } from "./asterisk.js";
import { askAzureSTT } from "./stt.js";
import { askOpenAI } from "./llm.js";
import WebSocket from "ws";
import { sendDtmf, getAvailableAgents, startRealtimeAudio } from "./asterisk.js";
import { closeCall } from "./asterisk.js";
import { log } from "./logger.js";
const BASE = "https://api.openai.com/v1/realtime/calls";
function authHeaders() {
    return {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
    };
}



// ## Handling Silence and Background Noise
// - If the latest audio is silence, background noise, hold music, TV audio,
//   side conversation, or speech not addressed to you, call 'wait_for_user'.
// - Do not generate a conversational response after calling 'wait_for_user'.
// - Do not say "I'm here", "I didn't catch that", "Take your time",
//   or "Let me know when you're ready".
// - Resume normal responses only when the user clearly addresses you
//   or asks for help.
// - Only respond to clear audio or text.
// - If the user's audio is not clear, ask for clarification using a short Vietnamese phrase such as "Xin lỗi, bạn có thể nói lại rõ hơn được không?"
// - Don't repeat the same unclear-audio clarification twice.
// - Treat audio as unclear if it is ambiguous, noisy, silent, unintelligible, partially cut off, or if you are unsure of the exact words the user said.
// - Do not guess what the user meant from unclear audio.
// - Do not reason when the audio is unclear.
// - Do not provide a preamble or call tools in the commentary channel when the audio is unclear.

/**
 * Accept một incoming call và cấu hình Realtime session.
 * @param {string} callId
 * @returns {Promise<object>} - Response body từ OpenAI
 */
async function acceptCall(callId) {
    let instructions = `
    # Role and Objective
    Bạn đóng vai trò nhân viên chăm sóc khách hàng của công ty cấp nước Trung An. Bạn có nhiệm vụ :
    -  gọi tool get_bill khi khách cần hỗ trợ tra cứu các thông tin tiền nước, thanh toán, hoá đơn tiền nước
    -  gọi tool compare_usage khi khách cần hỗ trợ so sánh tiền nước, sản lượng nước so với kỳ trước
    -  gọi tool get_outages khi khách cần hỗ trợ tra cứu thông tin gián đoạn cung cấp nước/lịch cúp nước bảo trì hiện tại theo số danh bộ.  
    -  gọi tool get_procedure_info khi khách có yêu cầu giải đáp các thủ tục về : 
        + Đăng ký định mức nước cho hộ gia đình
        + Đăng ký đồng hồ nước cho hộ gia đình
        + Sang Tên đồng hồ nước cho hộ gia đình
        + Nâng dời đồng hồ nước cho hộ gia đình
    - gọi tool create_ticket để tạo ticket : ghi nhận thông tin khiếu nại, lời nhắn của khách hàng
    - gọi tool transfer_to_agent để chuyển máy cho nhân viên khi khách hàng yêu cầu, hoặc các yêu cầu của khách hàng nằm ngoài các nhiệm vụ trên.
# Personality and Tone
        
# Language
- Luôn trả lời bằng tiếng Việt, bất kể khách nói giọng vùng miền nào, phát âm không chuẩn, hay lẫn từ tiếng Anh/từ đệm. 
- Giọng nói (accent) của khách KHÔNG phải tín hiệu để đổi ngôn ngữ trả lời.
# Reasoning
Do not perform extended reasoning when the user's audio is unclear; ask for clarification instead
# Message Channels

# Preambles

# Verbosity

# Tools
Use only the tools explicitly provided in the current tool list. Do not invent, assume, simulate, or rename tools.
Never call tools with guessed, partial, ambiguous, or unconfirmed exact values.

## Dùng lại số danh bộ
- Nếu số danh bộ đã được khách xác nhận trong cuộc hội thoại hiện tại, có thể dùng lại cho get_bill hoặc get_outages.
- Nếu khách đưa ra số mới hoặc sửa một chữ số, phải đọc lại đầy đủ 11 chữ số và xác nhận lại trước khi gọi tool.
## Không bắt buộc số danh bộ
- create_ticket không bắt buộc có số danh bộ.
- Có thể hỏi số danh bộ cho create_ticket nếu nó giúp xác định địa điểm hoặc tài khoản, nhưng không được chặn việc tạo phiếu chỉ vì khách không có hoặc không nhớ số danh bộ.
- get_procedure_info không yêu cầu số danh bộ; không hỏi số danh bộ trừ khi thật sự cần để làm rõ yêu cầu khác.

# Unclear Audio
## Silence and Non-Addressed Audio
- For silence, background noise, hold music, TV audio, side conversations,
  or speech not addressed to the assistant: call wait_for_user.
- Do not generate commentary or a final spoken response after calling it.

## Unclear User Speech
- If the user is clearly speaking to the assistant but their request is
  unintelligible, noisy, ambiguous, or cut off: ask one short clarification.
- Do not call wait_for_user in this case.
- Do not guess missing words or call business tools.

# Entity Capture

# Long Context Behavior

# Escalation


    `

    let TOOLS = [
        {
            "name": "wait_for_user",
            "description": "Call this when the latest audio does not need a spoken response, such as silence, background noise, hold music, TV audio, side conversation, or speech not addressed to the assistant. This tool helps end the turn without a spoken reply.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            type: "function",
            name: "get_bill",
            description: `
    Mục đích :
      - Tra cứu tiền nước, trạng thái thanh toán (đã đóng hay chưa, ngày thanh toán), và sản lượng nước sử dụng của khách hàng — CẢ BA thông tin có trong MỘT lần gọi tool này. Khách hỏi bất kỳ thông tin nào trong 3 thứ trên đều gọi tool này, rồi đọc đúng phần khách hỏi (không cần đọc hết cả 3 nếu khách chỉ hỏi 1 thứ, nhưng không cần gọi lại tool nếu khách hỏi tiếp 1 trong 2 thứ còn lại — dữ liệu đã có sẵn trong kết quả).
    Lời thoại để hỏi số danh bộ CHỈ dùng khi ngữ cảnh cuộc gọi thực sự CHƯA có mã danh bộ nào (không có phần "Thông tin từ hệ thống" gợi ý danh bộ) : "Dạ, Quý Khách vui lòng cho em xin số danh bộ để kiểm tra ạ". Nếu ngữ cảnh ĐÃ có mã (tra theo SĐT hoặc lịch sử), đọc lại xin xác nhận theo mục "Thu thập mã danh bộ" — KHÔNG dùng câu này.`,
            parameters: {
                type: "object",
                properties: {
                    ma_danh_bo: { type: "string", description: "mã danh bộ" },
                    ky: {
                        type: "integer",
                        description:
                            "Kỳ (tháng) cần tra cứu, tùy chọn. CHỈ điền khi khách nói RÕ tháng/kỳ cụ thể. " +
                            "Khách nói mơ hồ kiểu 'tháng này', 'gần đây', 'hiện tại', hoặc không nói gì thì BỎ TRỐNG " +
                            "field này (đừng tự suy ra từ ngày hiện tại) — hệ thống sẽ tự trả về kỳ gần nhất có dữ liệu.",
                    },
                    nam: {
                        type: "integer",
                        description:
                            "Năm cần tra cứu, tùy chọn. Cùng quy tắc như ky — chỉ điền khi khách nói rõ, không thì bỏ trống.",
                    },
                },
                required: ["ma_danh_bo"],
            },
        },
        {
            type: "function",
            name: "compare_usage",
            description: "So sánh tăng/giảm sản lượng nước so với kỳ trước.",
            parameters: {
                type: "object",
                properties: {
                    ma_danh_bo: { type: "string", description: "mã danh bộ" },
                    ky: {
                        type: "integer",
                        description:
                            "Kỳ (tháng) cần so sánh, tùy chọn. CHỈ điền khi khách nói RÕ tháng/kỳ cụ thể; " +
                            "không thì bỏ trống để hệ thống tự lấy kỳ gần nhất, đừng tự suy ra từ ngày hiện tại.",
                    },
                    nam: {
                        type: "integer",
                        description:
                            "Năm cần so sánh, tùy chọn. Cùng quy tắc như ky — chỉ điền khi khách nói rõ, không thì bỏ trống.",
                    },
                },
                required: ["ma_danh_bo"],
            },
        },
        {
            type: "function",
            name: "get_outages",
            description: `
    Mục đích :
      - Tra cứu thông tin gián đoạn cung cấp nước/lịch cúp nước bảo trì hiện tại theo số danh bộ.
    Lời thoại để hỏi số danh bộ CHỈ dùng khi ngữ cảnh cuộc gọi thực sự CHƯA có mã danh bộ nào (không có phần "Thông tin từ hệ thống" gợi ý danh bộ) : "Dạ, Quý Khách vui lòng cho em xin số danh bộ để kiểm tra ạ". Nếu ngữ cảnh ĐÃ có mã (tra theo SĐT hoặc lịch sử), đọc lại xin xác nhận theo mục "Thu thập mã danh bộ" — KHÔNG dùng câu này.`,
            parameters: {
                type: "object",
                properties: {
                    ma_danh_bo: { type: "string", description: "mã danh bộ" },
                },
                required: ["ma_danh_bo"],
            },
        },
        {
            type: "function",
            name: "create_ticket",
            description: "Tạo phiếu tiếp nhận phản ánh sự cố hoặc khiếu nại ban đầu.",
            parameters: {
                type: "object",
                properties: {
                    ma_danh_bo: {
                        type: "string",
                        description: "mã danh bộ",
                    },
                    loai: {
                        type: "string",
                        enum: ["su_co", "phan_anh", "khan_cap", "khieunai"],
                        description: "Loại phiếu: su_co (sự cố thường), phan_anh (phản ánh), khieu_nai (khiếu nại), khan_cap (sự cố ngoài giờ sau 22h)",
                    },
                    mo_ta: {
                        type: "string",
                        description: "Mô tả ngắn gọn vấn đề khách hàng phản ánh",
                    }
                },
                // required: ["ma_danh_bo", "loai", "mo_ta"],
                required: ["loai", "mo_ta"],
            },
        },
        {
            type: "function",
            name: "get_procedure_company",
            description: "hướng dẫn thủ tục hành chính về cấp nước dành cho doanh nghiệp, công ty, tổ chức",
        },
        {
            type: "function",
            name: "get_procedure_home",
            description:
                "Lấy hướng dẫn thủ tục hành chính về cấp nước (định mức, lắp đồng hồ mới, sang tên, nâng/dời đồng hồ). " +
                "CHỈ hỗ trợ 4 loại thủ tục trong enum — thủ tục khác KHÔNG gọi tool này, " +
                "mời khách chuyển tổng đài viên (transfer_to_agent) hoặc tạo phiếu (create_ticket).",
            parameters: {
                type: "object",
                properties: {
                    loai_thu_tuc: {
                        type: "string",
                        enum: ["dinh_muc_nuoc", "lap_dat_dong_ho", "sang_ten_dong_ho", "nang_doi_dong_ho"],
                        description:
                            "dinh_muc_nuoc: định mức nước sinh hoạt, khai số nhân khẩu (chỉ áp dụng hộ gia đình). " +
                            "lap_dat_dong_ho: gắn/lắp ĐỒNG HỒ NƯỚC MỚI tại địa chỉ chưa có nước (doanh nghiệp → tool trả hướng dẫn chuyển tổng đài viên). " +
                            "sang_ten_dong_ho: đổi tên chủ hợp đồng/danh bộ (doanh nghiệp → tool trả hướng dẫn chuyển tổng đài viên). " +
                            "nang_doi_dong_ho: nâng hoặc di dời vị trí đồng hồ.",
                    },
                    doi_tuong: {
                        type: "string",
                        enum: ["ho_gia_dinh", "doanh_nghiep"],
                        description: "Đối tượng áp dụng (nếu thủ tục có phân biệt)",
                    },
                },
                required: ["loai_thu_tuc"],
            },
        },
        {
            type: "function",
            name: "check_missing_docs",
            description:
                "Đối chiếu giấy tờ khách ĐÃ CÓ với yêu cầu của thủ tục, trả về phần CÒN THIẾU. " +
                "PHẢI GỌI tool này mỗi khi khách nhắc tên MỘT giấy tờ cụ thể kèm câu hỏi cần gì thêm, " +
                'vd: "giấy phép xây dựng rồi cần gì nữa", "có sổ hồng rồi thiếu gì", "căn cước với cái gì nữa", ' +
                '"X rồi... gì nữa em", "còn thiếu giấy gì". KHÔNG tự đối chiếu, KHÔNG tự đọc lại danh sách.',
            parameters: {
                type: "object",
                properties: {
                    loai_thu_tuc: {
                        type: "string",
                        enum: ["dinh_muc_nuoc", "lap_dat_dong_ho", "sang_ten_dong_ho", "nang_doi_dong_ho"],
                        description: "Thủ tục đang tư vấn",
                    },
                    doi_tuong: {
                        type: "string",
                        enum: ["ho_gia_dinh", "doanh_nghiep"],
                        description: "Đối tượng áp dụng (nếu đã biết từ hội thoại)",
                    },
                    giay_to_da_co: {
                        type: "array",
                        items: { type: "string" },
                        description:
                            'Các giấy tờ khách nói ĐÃ CÓ, ghi theo lời khách (vd ["giấy phép xây dựng", "căn cước"])',
                    },
                },
                required: ["loai_thu_tuc", "giay_to_da_co"],
            },
        },
        {
            type: "function",
            name: "transfer_to_agent",
            description: `Chuyển cuộc gọi sang tổng đài viên (người thật). Dùng khi :
            - khách yêu cầu hoặc vượt quá khả năng AI.`,
            parameters: {
                type: "object",
                properties: {
                    ly_do: {
                        type: "string",
                        description: "Lý do chuyển máy (để log nội bộ)",
                    },
                },
                required: ["ly_do"],
            },
        },
        {
            type: "function",
            name: "end_call",
            description: "Kết thúc cuộc gọi. GỌI NGAY khi khách chào tạm biệt hoặc hết nhu cầu, sau khi đã nói lời chào tạm biệt.",
            parameters: {
                type: "object",
                properties: {
                    ly_do: { type: "string", description: "Lý do kết thúc" },
                },
            },
        },

        {

            type: "function",
            name: "wait_for_user",
            description:
                "Gọi tool này khi âm thanh vừa nghe KHÔNG cần Trợ lý trả lời bằng lời — ví dụ: " +
                "khách đang đọc dở mã danh bộ, im lặng, tạp âm nền, tiếng thở, tiếng echo, nhạc chờ, " +
                "hoặc lời nói không hướng tới Trợ lý. KHÔNG dùng khi khách rõ ràng đang nói với Trợ lý " +
                "nhưng nội dung nghe không rõ — trường hợp đó hỏi lại thay vì gọi tool này. " +
                "Sau khi gọi, KHÔNG nói gì thêm, chờ khách nói tiếp.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            type: "function",
            name: "confirm_danh_bo",
            description:
                "Lấy trạng thái HIỆN TẠI của mã danh bộ đang xử lý (do hệ thống tự xác minh, không dựa " +
                "vào những gì Trợ lý tự nghe được). CHỈ gọi tool này khi hệ thống chủ động yêu cầu " +
                "(qua instructions của đúng lượt nói đó, thường có chữ 'Gọi NGAY tool confirm_danh_bo'). " +
                "KHÔNG tự ý gọi tool này để 'kiểm tra lại cho chắc' trước khi tra cứu dữ liệu — nếu " +
                "mã danh bộ đã xác nhận thì cứ dùng thẳng tool tra cứu (get_bill/...), không cần gọi " +
                "confirm_danh_bo trước. Hệ thống sẽ tự nhắc lại khi cần. " +
                "Ví dụ SAI (đã xảy ra thật, tránh lặp lại): khách vừa nói 'đúng rồi' xác nhận mã danh bộ " +
                "→ Trợ lý nói 'Để em xác nhận lại thông tin cho chắc chắn một chút rồi báo lại kết quả " +
                "nhé' RỒI mới gọi confirm_danh_bo — SAI, thừa một bước và thừa câu dẫn; khách ĐÃ xác nhận " +
                "rồi thì phải gọi THẲNG tool tra cứu khách cần (get_bill/compare_usage/get_outages/...) " +
                "NGAY, không nói gì trước, không gọi confirm_danh_bo.",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    ];
    const body = {
        type: "realtime",
        model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini",
        reasoning: { effort: process.env.OPENAI_REALTIME_REASONING_EFFORT || "low" },
        instructions,
        tools: TOOLS,
        audio: {
            input: {
                transcription: {
                    model: "gpt-4o-transcribe",
                    language: "vi",
                    prompt: "Cuộc gọi tổng đài chăm sóc khách hàng công ty cấp nước tại TP.HCM, "
                        + "toàn bộ bằng tiếng Việt. Có thể chứa mã danh bộ 11 chữ số, số tiền, "
                        + "tên thủ tục: định mức nước, lắp đặt đồng hồ, sang tên, nâng dời đồng hồ.",
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
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Accept call failed ${res.status}: ${text}`);
    }
    log.info(`[CallMgr] Call ${callId} accepted`);
    // OpenAI trả 200 OK với body rỗng hoặc JSON – xử lý cả hai trường hợp
    const text = await res.text();
    console.log("[CallMgr] :text :", text);
    // Trả về body đã gửi để logger lưu lại (phân tích/điều chỉnh prompt)
    return body;
}

async function handleIncomingCall(callId, fromHeader, asteriskData) {
    //accept call
    await acceptCall(callId);
    //start realtime audio
    await startRealtimeAudio(callId);
    //
}