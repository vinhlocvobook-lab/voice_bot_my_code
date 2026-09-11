export const audio_prompt = "Cuộc gọi tổng đài chăm sóc khách hàng công ty cấp nước tại TP.HCM, "
    + "toàn bộ bằng tiếng Việt. Có thể chứa mã danh bộ 11 chữ số, số tiền, "
    + "tên thủ tục: định mức nước, lắp đặt đồng hồ, sang tên, nâng dời đồng hồ."
// audio_prompt = "";
// audio_prompt = "Trung An, danh bộ, tiền nước, hóa đơn, thanh toán, đồng hồ nước, cúp nước, định mức, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9.";
// export const audio_prompt = "Cuộc gọi tổng đài chăm sóc khách hàng công ty cấp nước Trung An tại TP.HCM, "
//     + "toàn bộ bằng tiếng Việt. Tra cứu kỳ, kỳ 1, kỳ 2, kỳ 3, kỳ 4, kỳ 5, kỳ 6, kỳ 7, kỳ 8, kỳ 9, kỳ 10, kỳ 11, kỳ 12, "
//     + "mã danh bộ 11 chữ số, tiền nước, sản lượng nước, VCB, MoMo...";

export const tool_get_outages = {
    type: "function",
    name: "get_outages",
    description: `
    Mục đích :
      - Tra cứu thông tin gián đoạn cung cấp nước/lịch cúp nước bảo trì hiện tại theo số danh bộ.
    Quy tắc:
      - Gọi tool này khi khách yêu cầu tra cứu thông tin gián đoạn cung cấp nước/lịch cúp nước bảo trì hiện tại theo số danh bộ.
      - Nếu cuộc gọi CHƯA có mã danh bộ hoặc mã danh bộ CHƯA được xác nhận, hãy ưu tiên gọi 'get_so_danh_bo' để thu thập mã danh bộ trước.`,
    parameters: {
        type: "object",
        properties: {
            ma_danh_bo: {
                type: "string",
                description: "Mã danh bộ 11 chữ số đã được xác nhận (tùy chọn).",
            },
        },
        required: [],
    },
}
export const tool_compare_usage = {
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
}
export const tool_get_bill_old1 = {
    type: "function",
    name: "get_bill",
    description: `
    Mục đích :
      - Tra cứu tiền nước, trạng thái thanh toán (đã đóng hay chưa, ngày thanh toán), và sản lượng nước sử dụng của khách hàng — CẢ BA thông tin có trong MỘT lần gọi tool này. Khách hỏi bất kỳ thông tin nào trong 3 thứ trên đều gọi tool này, rồi đọc đúng phần khách hỏi (không cần đọc hết cả 3 nếu khách chỉ hỏi 1 thứ, nhưng không cần gọi lại tool nếu khách hỏi tiếp 1 trong 2 thứ còn lại — dữ liệu đã có sẵn trong kết quả).
    Lời thoại để hỏi số danh bộ CHỈ dùng khi ngữ cảnh cuộc gọi thực sự CHƯA có mã danh bộ nào (không có phần "Thông tin từ hệ thống" gợi ý danh bộ) : "Dạ, Quý khách vui lòng cho em xin số danh bộ để kiểm tra ạ". Nếu ngữ cảnh ĐÃ có mã (tra theo SĐT hoặc lịch sử), đọc lại xin xác nhận theo mục "Thu thập mã danh bộ" — KHÔNG dùng câu này.`,
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
}
const tool_get_bill_old2 = {
    type: "function",
    name: "get_bill",
    description: `
    Mục đích :
      - Tra cứu tiền nước, trạng thái thanh toán (đã đóng hay chưa, ngày thanh toán), và sản lượng nước sử dụng của khách hàng 
      — CẢ BA thông tin có trong MỘT lần gọi tool này. Khách hỏi bất kỳ thông tin nào trong 3 thứ trên đều gọi tool này, rồi đọc đúng phần khách hỏi (không cần đọc hết cả 3 nếu khách chỉ hỏi 1 thứ, nhưng không cần gọi lại tool nếu khách hỏi tiếp 1 trong 2 thứ còn lại — dữ liệu đã có sẵn trong kết quả).`,
    parameters: {
        type: "object",
        properties: {
            ma_danh_bo: { type: "string", description: "mã danh bộ, gồm 11 chữ số." },
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
        required: [],
    },
}
const tool_get_bill_old3 = {
    type: "function",
    name: "get_bill",
    description: `
    Mục đích :
      - Tra cứu tiền nước, trạng thái thanh toán (đã đóng hay chưa, ngày thanh toán), và sản lượng nước sử dụng của khách hàng 
      — CẢ BA thông tin có trong MỘT lần gọi tool này. Khách hỏi bất kỳ thông tin nào trong 3 thứ trên đều gọi tool này, rồi đọc đúng phần khách hỏi (không cần đọc hết cả 3 nếu khách chỉ hỏi 1 thứ, nhưng không cần gọi lại tool nếu khách hỏi tiếp 1 trong 2 thứ còn lại — dữ liệu đã có sẵn trong kết quả).`,
    parameters: {
        type: "object",
        properties: {
            ma_danh_bo: { type: "string", description: "mã danh bộ, gồm 11 chữ số. Không được bịa số danh bộ." },
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
        required: [],
    },
}
export const tool_get_so_danh_bo_old1 = {
    type: "function",
    name: "get_so_danh_bo",
    description: `
    Mục đích:
      - Thu thập và xác nhận mã danh bộ (gồm 11 chữ số) của khách hàng.
    Khi nào BẮT BUỘC gọi tool này:
      1. Khách hàng yêu cầu bất kỳ dịch vụ nào cần mã danh bộ (tra cứu tiền nước, hóa đơn, cúp nước, so sánh sản lượng, khiếu nại...) nhưng cuộc gọi CHƯA có mã danh bộ đã xác nhận.
      2. Khách hàng vừa đọc mã danh bộ hoặc một dãy số.
      3. Khách hàng trả lời xác nhận mã danh bộ (ví dụ: "đúng rồi", "chính xác", "sai rồi", "không phải", "đổi số khác"...).
    Lưu ý CỰC KỲ QUAN TRỌNG:
      - TUYỆT ĐỐI KHÔNG tự mở miệng hỏi xin mã danh bộ, KHÔNG tự đọc lại số, KHÔNG tự hỏi xác nhận bằng lời nói.
      - BẮT BUỘC GỌI TOOL NÀY để backend điều khiển câu thoại và phân tích transcript.`,
    parameters: {
        type: "object",
        properties: {
            ma_danh_bo: {
                type: "string",
                description: "Chuỗi chữ số danh bộ khách vừa đọc nếu có (tùy chọn, không bắt buộc, không được tự bịa số).",
            },
            xac_nhan: {
                type: "string",
                enum: ["đúng", "sai"],
                description: "Kết quả khi khách trả lời xác nhận mã danh bộ: 'đúng' nếu khách bảo đúng/chính xác, 'sai' nếu khách bảo sai/không đúng.",
            },
        },
        required: [],
    },
}
export const tool_get_so_danh_bo = {
    type: "function",
    name: "get_so_danh_bo",
    description: `
    Mục đích:
      - Thu thập và xác nhận mã danh bộ (gồm 11 chữ số) của khách hàng.
    Khi nào BẮT BUỘC gọi tool này:
      1. Khách hàng yêu cầu bất kỳ dịch vụ nào cần mã danh bộ (tra cứu tiền nước, hóa đơn, cúp nước, so sánh sản lượng, khiếu nại...) nhưng cuộc gọi CHƯA có mã danh bộ đã xác nhận.
      2. Khách hàng vừa đọc mã danh bộ hoặc một dãy số.
      3. Khách hàng trả lời xác nhận mã danh bộ (ví dụ: "đúng rồi", "chính xác", "sai rồi", "không phải", "đổi số khác"...).
    Lưu ý CỰC KỲ QUAN TRỌNG:
      - TUYỆT ĐỐI KHÔNG tự mở miệng hỏi xin mã danh bộ, KHÔNG tự đọc lại số, KHÔNG tự hỏi xác nhận bằng lời nói.
      - BẮT BUỘC GỌI TOOL NÀY để backend điều khiển câu thoại và phân tích transcript.`,
    parameters: {
        type: "object",
        properties: {
            intent: {
                type: "string",
                enum: ["compare_usage", "get_bill", "get_outages", "create_ticket", "khác"],
                description: "Mục đích ban đầu của cuộc gọi: 'compare_usage' nếu khách hàng yêu cầu so sánh sản lượng nước, 'get_bill' nếu khách hàng yêu cầu tra cứu tiền nước / hóa đơn / sản lượng, 'get_outages' nếu khách hàng yêu cầu tra cứu tình hình cúp nước, 'create_ticket' nếu khách hàng yêu cầu tạo ticket, 'khác' nếu khách hàng yêu cầu dịch vụ khác.",
            },
            ma_danh_bo: {
                type: "string",
                description: "Chuỗi chữ số danh bộ khách vừa đọc nếu có (tùy chọn, không bắt buộc, không được tự bịa số).",
            },
            xac_nhan: {
                type: "string",
                enum: ["đúng", "sai", "chưa_xác_nhận"],
                description: `Xác nhận số danh bộ, trả về 
                    - 'đúng' nếu khách hàng đã xác nhận đúng mã danh bộ, 
                    - 'sai' nếu khách hàng xác nhận là sai   
                    - 'chưa_xác_nhận' nếu mã danh bộ chưa được xác nhận hoặc yêu cầu đọc lại.`,
            },
        },
        required: [],
    },
}
export const tool_get_bill = {
    type: "function",
    name: "get_bill",
    description: `
    Mục đích:
      - Tra cứu tiền nước, trạng thái thanh toán (đã đóng hay chưa, ngày thanh toán), và sản lượng nước sử dụng của khách hàng theo mã danh bộ.
      - CẢ BA thông tin có trong MỘT lần gọi tool này. Khách hỏi bất kỳ thông tin nào trong 3 thứ trên đều gọi tool này, rồi đọc đúng phần khách hỏi.
    Quy tắc:
      - Gọi tool này khi khách yêu cầu tra cứu tiền nước / hóa đơn / sản lượng.
      - Nếu cuộc gọi CHƯA có mã danh bộ hoặc mã danh bộ CHƯA được xác nhận, hãy ưu tiên gọi 'get_so_danh_bo' để thu thập mã danh bộ trước.`,
    parameters: {
        type: "object",
        properties: {
            ma_danh_bo: {
                type: "string",
                description: "Mã danh bộ 11 chữ số đã được xác nhận (tùy chọn).",
            },
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
        required: [],
    },
}
export const tool_create_ticket = {
    type: "function",
    name: "create_ticket",
    description: "Tạo phiếu tiếp nhận phản ánh sự cố, phản ánh, khiếu nại, lời nhắn của khách",
    parameters: {
        type: "object",
        properties: {
            ma_danh_bo: {
                type: "string",
                description: "mã danh bộ",
            },
            loai: {
                type: "string",
                enum: ["su_co", "phan_anh", "khan_cap", "khieu_nai", "loi_nhan"],
                description: "Loại phiếu: su_co (sự cố thường), phan_anh (phản ánh), khieu_nai (khiếu nại), khan_cap (sự cố ngoài giờ sau 22h), loi_nhan (lời nhắn)",
            },
            mo_ta: {
                type: "string",
                description: "Mô tả ngắn gọn vấn đề khách hàng phản ánh",
            }
        },
        // required: ["ma_danh_bo", "loai", "mo_ta"],
        required: ["loai", "mo_ta"],
    },
}
export const tool_procedure_info_for_organization = {
    type: "function",
    name: "procedure_info_for_organization",
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
}
export const tool_procedure_info_for_family = {
    type: "function",
    name: "procedure_info_for_family",
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
}
export const tool_check_missing_docs = {
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
}
export const tool_chuyenmay = {
    type: "function",
    name: "transfer_to_agent",
    description: "Chuyển cuộc gọi sang tổng đài viên (người thật). Dùng khi khách yêu cầu hoặc vượt quá khả năng AI.",
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
};
export const tool_hangup = {
    type: "function",
    name: "end_call",
    description: "Kết thúc cuộc gọi. GỌI NGAY khi khách chào tạm biệt hoặc hết nhu cầu, sau khi đã nói lời chào tạm biệt.",
    parameters: {
        type: "object",
        properties: {
            ly_do: { type: "string", description: "Lý do kết thúc" },
        },
    },
}
export const tool_wait_for_user_old1 = {
    // [migrate 30/07/2026] Tool no-op theo pattern "wait_for_user" chính thức
    // của OpenAI (Realtime models prompting guide, mục "Handling Silence and
    // Background Noise") — cho model một lối thoát để KHÔNG nói gì thay vì
    // buộc phải đáp lại mọi lượt VAD kích hoạt. session-ws.js xử lý: gọi xong
    // KHÔNG tạo response.create tiếp theo (khác với các tool dữ liệu khác).
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
};
export const tool_wait_for_user = {
    type: "function",
    name: "wait_for_user",
    description:
        "Gọi tool này khi âm thanh vừa nghe KHÔNG cần Trợ lý trả lời bằng lời — ví dụ: " +
        "khách im lặng, tạp âm nền, tiếng thở, tiếng echo, nhạc chờ, " +
        "hoặc lời nói không hướng tới Trợ lý. KHÔNG dùng khi khách rõ ràng đang nói với Trợ lý " +
        "nhưng nội dung nghe không rõ — trường hợp đó hỏi lại thay vì gọi tool này. " +
        "Sau khi gọi, KHÔNG nói gì thêm, chờ khách nói tiếp.",
    parameters: {
        type: "object",
        properties: {},
        required: [],
    },
};
// const tool_intent = {
//     type: "function",
//     name: "intent",
//     description: "Xác định ý định của khách hàng.",
//     parameters: {
//         type: "object",
//         properties: {
//             intent: {
//                 type: "string",
//                 description: "Xác định ý định của khách hàng",
//                 enum: ["tiennuoc", "hoadon", "thanhtoan", "datdongho", "khac"],
//             },
//         },
//         required: ["intent"],
//     },
// }
// instructions = "bạn là nhân viên chăm sóc khách hàng của công ty cấp nước Trung An."
// TOOLS = [tool_chuyenmay, tool_hangup, tool_wait_for_user, tool_intent]; 
// export const instructions = `
//     # Role and Objective
//     - bạn là nhân viên chăm sóc khách hàng của công ty cấp nước Trung An.
//     # Language
//     - Luôn trả lời bằng tiếng Việt, bất kể khách nói giọng vùng miền nào, phát âm không chuẩn, hay lẫn từ tiếng Anh/từ đệm. 
//     - Giọng nói (accent) của khách KHÔNG phải tín hiệu để đổi ngôn ngữ trả lời.
//     # Personality and Tone
//     - Luôn xưng "Em" và gọi người gọi là "Quý khách"
//     - KHÔNG NHẠI LỜI: Tuyệt đối KHÔNG lặp lại nguyên văn câu nói của khách, không hỏi ngược lại câu khách vừa hỏi.
//     ## Preambles
//     - Dạ, Quý khách đợi chút, để em kiểm tra ạh

//     # Mã Danh Bộ
//     - Mã danh bộ là 11 chữ số, đọc liên tục, liền mạch, không ngắt quãng.
//     - Bạn không cần kiểm tra tính hợp lệ của mã danh bộ, phía backend sẽ thực hiện việc này.
//     - Bất cứ khi nào khách hàng đọc số hoặc trả lời câu hỏi xác nhận, BẮT BUỘC PHẢI GỌI TOOL, TUYỆT ĐỐI KHÔNG TỰ TRẢ LỜI BẰNG LỜI NÓI
//     `
export const tools = [
    tool_get_bill,
    // tool_get_outages,
    // tool_compare_usage,
    // tool_get_procedure_info,
    // tool_check_missing_docs,
    // tool_create_ticket,
    tool_chuyenmay,
    tool_hangup,
    tool_wait_for_user
];


// export const accept_body = {
//     type: "realtime",
//     model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini",
//     reasoning: { effort: process.env.OPENAI_REALTIME_REASONING_EFFORT || "low" },
//     instructions,
//     tools: tools,
//     parallel_tool_calls: false,
//     audio: {
//         input: {
//             transcription: {
//                 model: "gpt-4o-transcribe",
//                 language: "vi",
//                 prompt: audio_prompt,
//             },
//         },

//         output: {
//             voice: process.env.OPENAI_VOICE || "alloy",
//         },
//     },
// };

export const session_update_semantic_vad = {
    type: "session.update",
    session: {
        type: "realtime",
        audio: {
            input: {
                "turn_detection": {
                    "type": "semantic_vad",
                    "eagerness": "low",//"auto",
                    "create_response": true,
                    "interrupt_response": true
                }
            }
        }
    }
}
export const session_update_waitfordigits = {
    type: "session.update",
    session: {
        type: "realtime",
        audio: {
            input: {
                "turn_detection": {
                    "type": "semantic_vad",
                    "eagerness": "low",//"auto",
                    "create_response": false,
                    "interrupt_response": false
                }
            }
        }
    }
}