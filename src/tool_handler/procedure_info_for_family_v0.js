import { PROCEDURES } from "../data/huongdanthutuc-data.js";

const stripDiacritics = (s) =>
    String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
// Chuẩn hoá value về dạng id: bỏ dấu, thường hoá, khoảng trắng/gạch → "_"
// (vd "lắp đặt đồng hồ" → "lap_dat_dong_ho").
const canonValue = (v) => stripDiacritics(v).toLowerCase().trim().replace(/[\s-]+/g, "_");

const DOI_TUONG_IDS = ["ho_gia_dinh", "doanh_nghiep"];
function normalizeProcedureArgs(args = {}) {
    let loai = PROCEDURES[args.loai_thu_tuc] ? args.loai_thu_tuc : undefined;
    let doiTuong = DOI_TUONG_IDS.includes(args.doi_tuong) ? args.doi_tuong : undefined;

    // 1) Key viết sai (có dấu/hoa thường) nhưng bỏ dấu thì khớp đúng tên tham số.
    if (!loai || !doiTuong) {
        for (const [k, v] of Object.entries(args)) {
            const key = canonValue(k);
            const val = canonValue(v);
            if (!loai && key === "loai_thu_tuc" && PROCEDURES[val]) loai = val;
            if (!doiTuong && key === "doi_tuong" && DOI_TUONG_IDS.includes(val)) doiTuong = val;
        }
    }
    // 2) Fallback: quét value — chỉ nhận khi có ĐÚNG MỘT id thủ tục (tránh đoán bừa).
    if (!loai) {
        const ids = [...new Set(
            Object.values(args).map(canonValue).filter((v) => PROCEDURES[v])
        )];
        if (ids.length === 1) loai = ids[0];
    }
    // 2b) [fix 18/07/2026] Cuộc E2u0Db8u91GWMPBYS9aj4: value là TÊN thủ tục đầy đủ
    // ("Sang tên đồng hồ nước" → canon "sang_ten_dong_ho_nuoc") — khớp exact trượt.
    // Nhận khi canon value CHỨA đúng MỘT id thủ tục (các id không chứa lẫn nhau).
    if (!loai) {
        const hits = [...new Set(
            Object.values(args)
                .map(canonValue)
                .flatMap((v) => Object.keys(PROCEDURES).filter((id) => v.includes(id)))
        )];
        if (hits.length === 1) loai = hits[0];
    }
    if (!doiTuong) {
        const dts = [...new Set(
            Object.values(args).map(canonValue).filter((v) => DOI_TUONG_IDS.includes(v))
        )];
        if (dts.length === 1) doiTuong = dts[0];
    }
    // 3) [13/07/2026] Model mã hoá dạng CỜ BOOLEAN — cuộc gọi E11HysUBZhNRGG2XKE6AD
    // gửi { lap_dat_dong_ho: true, sang_ten_dong_ho: false, ... } KHÔNG có
    // loai_thu_tuc → key chính là id, value truthy đánh dấu lựa chọn.
    const truthy = (v) => v === true || v === 1 || v === "true" || v === "1";
    if (!loai) {
        const flagged = [...new Set(
            Object.entries(args)
                .filter(([k, v]) => PROCEDURES[canonValue(k)] && truthy(v))
                .map(([k]) => canonValue(k))
        )];
        if (flagged.length === 1) loai = flagged[0];
    }
    if (!doiTuong) {
        const flagged = [...new Set(
            Object.entries(args)
                .filter(([k, v]) => DOI_TUONG_IDS.includes(canonValue(k)) && truthy(v))
                .map(([k]) => canonValue(k))
        )];
        if (flagged.length === 1) doiTuong = flagged[0];
    }
    // 3b) [fix 18/07/2026] Cuộc E2u0Db8u91GWMPBYS9aj4: model đệm cả 4 key thủ tục
    // bằng "N/A", key ĐƯỢC CHỌN mang value có nghĩa (tên thủ tục, "có", ...).
    // → key là id thủ tục + value KHÔNG phải marker rỗng = lựa chọn của model.
    // Chỉ nhận khi có ĐÚNG MỘT key như vậy (tránh đoán bừa).
    const NULL_MARKERS = new Set(["", "n/a", "na", "null", "none", "khong", "khong_co", "false", "0"]);
    const isNullish = (v) => v == null || v === false || v === 0 || NULL_MARKERS.has(canonValue(v));
    if (!loai) {
        const selected = [...new Set(
            Object.entries(args)
                .filter(([k, v]) => PROCEDURES[canonValue(k)] && !isNullish(v))
                .map(([k]) => canonValue(k))
        )];
        if (selected.length === 1) loai = selected[0];
    }
    if (!doiTuong) {
        const selected = [...new Set(
            Object.entries(args)
                .filter(([k, v]) => DOI_TUONG_IDS.includes(canonValue(k)) && !isNullish(v))
                .map(([k]) => canonValue(k))
        )];
        if (selected.length === 1) doiTuong = selected[0];
    }

    if (loai !== args.loai_thu_tuc || doiTuong !== args.doi_tuong) {
        console.warn("[get_procedure_info] Args chuẩn hoá lại:", JSON.stringify(args),
            "→", JSON.stringify({ loai_thu_tuc: loai, doi_tuong: doiTuong }));
    }
    return { loai_thu_tuc: loai, doi_tuong: doiTuong };
}

export function get_procedure_info_for_family_handler(function_event, asteriskData, send_message) {
    console.log("==========[handleGetProcedureInfo]==================")
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }

    // // Ghi nhớ thông tin tra cứu nếu khách có nói rõ kỳ, năm
    // if (args.ky || args.nam) {
    //     asteriskData.pending_bill_args = {
    //         ky: args.ky,
    //         nam: args.nam
    //     };
    // }
    // const rawArgs = asteriskData.user_params;
    console.log("args: " + JSON.stringify(args));
    const { loai_thu_tuc, doi_tuong } = normalizeProcedureArgs(args);
    console.log("loai_thu_tuc: " + loai_thu_tuc);
    console.log("doi_tuong: " + doi_tuong);
    const procedure = PROCEDURES[loai_thu_tuc];
    if (!procedure) {
        // [11/07/2026] Thủ tục ngoài phạm vi 4 thủ tục hỗ trợ → không tự hướng dẫn,
        // mời chuyển tổng đài viên hoặc tạo phiếu ghi nhận.
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    ngoai_pham_vi: true,
                    say_verbatim:
                        "Dạ, em không có thông tin về yêu cầu này! " +
                        "Quý khách có muốn em chuyển máy sang tổng đài viên hỗ trợ trực tiếp, hoặc ghi nhận lại yêu cầu để nhân viên liên hệ lại sau không ạ?",
                    message:
                        "Loại thủ tục không thuộc 4 thủ tục hỗ trợ (dinh_muc_nuoc, lap_dat_dong_ho, " +
                        "sang_ten_dong_ho, nang_doi_dong_ho). Nếu khách đang hỏi MỘT trong 4 thủ tục này " +
                        "→ GỌI LẠI tool với đúng tham số loai_thu_tuc. Nếu là thủ tục khác → ngoài phạm vi: " +
                        "KHÔNG tự hướng dẫn, mời khách chọn chuyển tổng đài viên (transfer_to_agent) " +
                        "hoặc tạo phiếu ghi nhận (create_ticket) để nhân viên liên hệ lại sau.",
                }),
            }
        });
        send_message({
            type: "response.create",
            response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
        });
        return;
    }

    // return JSON.stringify({
    //     success: false,
    //     ngoai_pham_vi: true,
    //     doc_cho_khach:
    //         "Dạ, em không có thông tin về yêu cầu này! " +
    //         "Quý khách có muốn em chuyển máy sang tổng đài viên hỗ trợ trực tiếp, hoặc ghi nhận lại yêu cầu để nhân viên liên hệ lại sau không ạ?",
    //     message:
    //         "Loại thủ tục không thuộc 4 thủ tục hỗ trợ (dinh_muc_nuoc, lap_dat_dong_ho, " +
    //         "sang_ten_dong_ho, nang_doi_dong_ho). Nếu khách đang hỏi MỘT trong 4 thủ tục này " +
    //         "→ GỌI LẠI tool với đúng tham số loai_thu_tuc. Nếu là thủ tục khác → ngoài phạm vi: " +
    //         "KHÔNG tự hướng dẫn, mời khách chọn chuyển tổng đài viên (transfer_to_agent) " +
    //         "hoặc tạo phiếu ghi nhận (create_ticket) để nhân viên liên hệ lại sau.",
    // });


    // [08/07/2026] Thủ tục giới hạn đối tượng (vd định mức nước chỉ cho hộ gia
    // đình) → khách hỏi cho đối tượng khác thì báo rõ, không trả nhầm nội dung.
    if (procedure.apDung && doi_tuong && doi_tuong !== procedure.apDung) {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    thuTuc: procedure.title,
                    say_verbatim:
                        `Dạ, thủ tục ${procedure.title} hiện chỉ áp dụng cho hộ gia đình, ` +
                        `chưa áp dụng cho doanh nghiệp ạ. Quý Khách có muốn em chuyển máy sang tổng đài viên ` +
                        `hỗ trợ trực tiếp, hoặc ghi nhận lại yêu cầu không ạ?`,
                    message: `Thủ tục ${procedure.title} CHỈ áp dụng cho hộ gia đình, KHÔNG áp dụng cho doanh nghiệp hay công ty. Nếu khách là doanh nghiệp cần hỗ trợ khác, mời chuyển tổng đài viên hoặc tạo phiếu ghi nhận.`,

                }),
            }
        });
        send_message({
            type: "response.create",
            response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
        });
        return;
    }

    // [12/07/2026] Thủ tục có hướng dẫn KHÁC NHAU theo đối tượng (lắp đặt, sang
    // tên): thiếu doi_tuong thì KHÔNG trả gộp cả hai trường hợp — cuộc gọi
    // E0VkaW1IIC4xom9HGSneG model nhận cả 2 case rồi tự tóm tắt làm rơi mất địa
    // chỉ văn phòng. Trả yêu cầu hỏi khách rồi gọi lại (deterministic).
    const coPhanBietDoiTuong = procedure.cases.some((c) => c.id === "doanh_nghiep");

    // [fix 18/07/2026] Cuộc E2u70cuT94h0rwpLAKOyA: model TỰ ĐOÁN doi_tuong ngay
    // lượt tool đầu tiên (khách chưa hề nói hộ gia đình hay doanh nghiệp) → nguy
    // cơ đọc nhầm hướng dẫn hộ gia đình cho doanh nghiệp (DN phải chuyển tổng đài
    // viên). Deterministic: với thủ tục có hướng dẫn khác nhau theo đối tượng,
    // doi_tuong CHỈ được chấp nhận SAU KHI tool đã yêu cầu hỏi khách
    // (can_hoi_doi_tuong) cho thủ tục đó trong CÙNG cuộc gọi — trước đó thì bỏ
    // qua giá trị model gửi và ép hỏi.
    const _daHoiDoiTuong = (asteriskData.daHoiDoiTuong ??= new Set());
    const effDoiTuong = doi_tuong;
    if (coPhanBietDoiTuong && effDoiTuong && !_daHoiDoiTuong.has(loai_thu_tuc)) {
        // [fix 18/07/2026 v2] Cuộc E2uLXv4UbNfF0Do3JAccO: model TỰ HỎI đối tượng
        // bằng lời của nó rồi mới gọi tool → guard hỏi mở lần nữa làm khách phải
        // trả lời TRÙNG 2 lần. Code không phân biệt được "model đã hỏi thật" với
        // "model đoán bừa" → thay câu hỏi mở bằng câu XÁC NHẬN giá trị model gửi:
        // khách chỉ cần "đúng rồi" (nếu đã nói) hoặc sửa ngay (nếu model đoán sai).
        // Vẫn an toàn 100% vì đối tượng luôn qua lời khách xác nhận.
        _daHoiDoiTuong.add(loai_thu_tuc);
        const _dtLabel = effDoiTuong === "doanh_nghiep" ? "doanh nghiệp" : "hộ gia đình";
        console.warn(`[get_procedure_info] doi_tuong="${effDoiTuong}" chưa qua bước hỏi — trả câu xác nhận đối tượng`);

        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    thuTuc: procedure.title,
                    can_hoi_doi_tuong: true,
                    xac_nhan_doi_tuong: effDoiTuong,
                    message:
                        `Cần khách XÁC NHẬN đối tượng trước khi hướng dẫn. ĐỌC câu trong doc_cho_khach rồi DỪNG, chờ khách trả lời. ` +
                        `Khách xác nhận đúng → GỌI LẠI get_procedure_info với doi_tuong="${effDoiTuong}". ` +
                        `Khách sửa lại → GỌI LẠI với doi_tuong khách nói. ` +
                        `KHÔNG hướng dẫn giấy tờ khi chưa gọi lại tool.`,
                    say_verbatim: `Dạ, em xin xác nhận lại: Quý Khách đăng ký cho ${_dtLabel}, phải không ạ?`,
                }),
            }
        });
        send_message({
            type: "response.create",
            response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
        });
        return;
    }

    if (!effDoiTuong && coPhanBietDoiTuong) {
        _daHoiDoiTuong.add(loai_thu_tuc);

        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    thuTuc: procedure.title,
                    can_hoi_doi_tuong: true,
                    message:
                        `Thủ tục ${procedure.title} có hướng dẫn KHÁC NHAU cho hộ gia đình và doanh nghiệp. ` +
                        `HỎI khách một câu ngắn: "Quý Khách đăng ký cho hộ gia đình hay doanh nghiệp ạ?" ` +
                        `rồi GỌI LẠI get_procedure_info với doi_tuong tương ứng. KHÔNG tự đoán, ` +
                        `KHÔNG hướng dẫn giấy tờ khi chưa gọi lại tool.`,
                    say_verbatim: `Dạ, thủ tục ${procedure.title} có hướng dẫn khác nhau cho hộ gia đình và doanh nghiệp ạ. Quý Khách đăng ký cho hộ gia đình hay doanh nghiệp ạ?`,

                }),
            }
        });
        send_message({
            type: "response.create",
            response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
        });
        return;
    }

    // Lọc case phù hợp đối tượng (nếu có)
    let relevantCases = procedure.cases;
    if (effDoiTuong) {
        const matched = procedure.cases.filter((c) => c.id.includes(effDoiTuong) || c.id === "default");
        if (matched.length > 0) relevantCases = matched;
    }
    console.log("2. relevantCases_after_matching", relevantCases);
    // [11/07/2026] Case đánh dấu transferToAgent (vd doanh nghiệp gắn/sang tên
    // đồng hồ) → không hướng dẫn giấy tờ, mời chuyển tổng đài viên hoặc tạo phiếu.
    if (relevantCases.length > 0 && relevantCases.every((c) => c.transferToAgent)) {

        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    thuTuc: procedure.title,
                    can_chuyen_tong_dai: true,
                    message:
                        `Thủ tục ${procedure.title} đối với doanh nghiệp/công ty do tổng đài viên hỗ trợ trực tiếp, ` +
                        `trợ lý KHÔNG tự hướng dẫn giấy tờ. Mời khách chọn: chuyển tổng đài viên (transfer_to_agent), ` +
                        `hoặc tạo phiếu ghi nhận (create_ticket) để nhân viên liên hệ lại sau.`,
                    say_verbatim: `Dạ, thủ tục ${procedure.title} đối với doanh nghiệp/công ty do tổng đài viên hỗ trợ trực tiếp. Quý khách có muốn em chuyển máy sang tổng đài viên hỗ trợ trực tiếp, hoặc ghi nhận lại yêu cầu để nhân viên liên hệ lại sau không ạ?`,


                })
            },
        });
        send_message({
            type: "response.create",
            response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
        });
        return;
    }

    // Tổng hợp giấy tờ thành CÁC Ý ĐÁNH SỐ.
    // [fix 08/07/2026] Giữ ngữ nghĩa AND/OR của data: `required` = cần đầy đủ,
    // `options` = chỉ cần một trong, `optional` = bổ sung tùy trường hợp.
    // [fix 12/07/2026] Đánh số ý + chỉ thị "đọc đủ N ý" — cuộc gọi
    // E0Vu0A3D9QbGpHC9l3ng8 model mini tự tóm tắt chuỗi dài, làm rơi giấy tờ
    // bắt buộc (CCCD) và địa chỉ văn phòng dù prompt đã cấm.
    const spokenItems = [];
    const nhieuCase = relevantCases.length > 1;
    relevantCases.forEach((c) => {
        const prefix = nhieuCase ? `Trường hợp ${c.label} — ` : "";
        if (c.transferToAgent) {
            spokenItems.push(`${prefix}tổng đài viên hỗ trợ trực tiếp: mời chuyển tổng đài viên hoặc tạo phiếu ghi nhận`);
            return;
        }
        const docs = c.requiredDocs;
        let coY = false;
        if (docs.required?.length) {
            spokenItems.push(`${prefix}giấy tờ BẮT BUỘC: ${docs.required.join("; ")}`);
            coY = true;
        }
        if (docs.options?.length) {
            spokenItems.push(`${prefix}kèm CHỈ CẦN MỘT trong các giấy tờ sau: ${docs.options.join("; ")}`);
            coY = true;
        }
        if (docs.optional?.length) {
            spokenItems.push(`${prefix}giấy tờ bổ sung TÙY TRƯỜNG HỢP: ${docs.optional.join("; ")}`);
            coY = true;
        }
        if (!coY) spokenItems.push(`${prefix}${docs.note || "không có yêu cầu giấy tờ cụ thể"}`);
    });

    // [08/07/2026] Viết CHỮ CHUẨN (SAWACO CSKH, www.capnuoctrungan.vn) — cách
    // phát âm dạy trong SYSTEM_PROMPT (section "Cách đọc tên riêng"), không
    // nhúng phiên âm vào data để log/summary sạch.
    // [11/07/2026] Theo tài liệu mới, website chỉ là kênh của thủ tục nâng/dời
    // → procedure.channels (data) ghi đè kênh mặc định.
    const channels =
        procedure.channels ||
        "Nộp hồ sơ qua: app SAWACO CSKH, hoặc trực tiếp tại " +
        "văn phòng 873A Quang Trung, phường An Hội Tây, TP.HCM hoặc 540 Hà Huy Giáp, phường An Phú Đông, TP.HCM.";

    // Kênh nộp hồ sơ luôn là ý cuối — bắt buộc đọc (kèm đầy đủ 2 địa chỉ).
    spokenItems.push(channels);

    // [13/07/2026] Dùng "Thứ nhất/Thứ hai..." thay "Ý 1/Ý 2" — model đọc nguyên
    // văn nhãn đánh số cho khách (cuộc E1030jdrzgL8nTwnryZET nói "cần có 3 ý
    // quan trọng, Ý một..." nghe máy móc, khách rối). Số thứ tự chữ nghe tự nhiên.
    const THU_TU = ["Thứ nhất", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
    const bodyDanhSo = spokenItems
        .map((s, i) => `${THU_TU[i] || `Thứ ${i + 1}`}, ${s.replace(/\.\s*$/, "")}.`)
        .join(" ");

    // [13/07/2026 đợt 2] TÁCH chỉ thị khỏi nội dung đọc — cuộc gọi
    // E17jLdcYX5ACzRQ7IuGh0 model đọc NGUYÊN VĂN cả chỉ thị điều khiển lẫn đoạn
    // quy_dinh dài trong "message" cho khách nghe (khách: "nó bị khùng khùng ha").
    // → "doc_cho_khach" = nội dung sạch, đọc nguyên văn; "luu_y_cho_tro_ly" =
    // chỉ thị nội bộ, cấm đọc. quy_dinh KHÔNG nằm trong phần đọc mặc định —
    // chỉ dùng trả lời câu hỏi tiếp theo.
    // [13/07/2026 đợt 3] doc_cho_khach đặt TRƯỚC quy_dinh trong JSON + cảnh báo
    // ngay trong giá trị quy_dinh — cuộc E18GPiH9S0EO3dkWUSzUk model bị hút vào
    // field quy_dinh dài (đứng trước), trộn nó vào bài đọc và làm rơi phần địa chỉ.
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({
                success: true,
                thuTuc: procedure.title,
                so_phan_phai_doc: spokenItems.length,
                // luu_y_cho_tro_ly:
                //     `Ghi chú nội bộ, TUYỆT ĐỐI KHÔNG đọc cho khách: "doc_cho_khach" là KỊCH BẢN — ` +
                //     `đọc NGUYÊN VĂN toàn bộ, TỪNG CÂU, ngay từ lượt trả lời ĐẦU TIÊN. ` +
                //     `CẤM tóm tắt, CẤM diễn đạt lại, CẤM rút gọn (đủ ${spokenItems.length} phần, không bỏ phần nào, ` +
                //     `không đổi địa chỉ, không nói "có ${spokenItems.length} phần"). ` +
                //     `KHÔNG trộn nội dung "quy_dinh" vào bài đọc.`,
                // doc_cho_khach dùng dạng đọc (toSpoken); quy_dinh/thuTuc giữ chữ chuẩn
                // để log/summary sạch.
                say_verbatim: toSpoken(`${procedure.purpose} ${bodyDanhSo}`),
                ...(procedure.quyDinh
                    ? {
                        quy_dinh:
                            "(GHI CHÚ NỘI BỘ — KHÔNG đọc khi hướng dẫn giấy tờ; chỉ dùng khi khách " +
                            "hỏi thêm về đối tượng hoặc số người được đăng ký) " + procedure.quyDinh,
                    }
                    : {}),
                // [13/07/2026] Giải thích thuật ngữ (CT07/CT08...) — khách hỏi "CT07 là gì"
                // thì đọc phần liên quan, không để model tự bịa.
                ...(procedure.thuatNgu
                    ? {
                        giai_thich_thuat_ngu: toSpoken(
                            "(GHI CHÚ NỘI BỘ — KHÔNG đọc khi hướng dẫn giấy tờ; chỉ dùng khi khách " +
                            "hỏi hoặc thắc mắc thuật ngữ, đọc NGẮN GỌN phần liên quan) " + procedure.thuatNgu
                        ),
                    }
                    : {}),

            }),
        }
    });
    send_message({
        type: "response.create",
        response: {
            instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được`
        }
    })

    return;
}
// Chuẩn hoá text để so khớp: bỏ dấu, thường hoá, bỏ ký tự lạ, gộp khoảng trắng.
const canonText = (v) =>
    stripDiacritics(v).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Tên dân dã khách hay dùng → cụm đặc trưng trong tên giấy tờ chuẩn.
const DOC_ALIASES = [
    { keys: ["so hong", "so do", "giay to nha dat"], target: "giay chung nhan quyen" },
    { keys: ["hop dong mua ban"], target: "hop dong chuyen quyen so huu" },
];

function docMatches(customerRaw, docRaw) {
    const cus = canonText(customerRaw);
    const doc = canonText(docRaw);
    if (!cus || !doc) return false;
    if (doc.includes(cus)) return true;
    for (const a of DOC_ALIASES) {
        if (a.keys.some((k) => cus.includes(k)) && doc.includes(a.target)) return true;
    }
    // Khách nói dài dòng hơn tên giấy chuẩn: khớp khi có cụm 2 từ liên tiếp trùng.
    const words = cus.split(" ");
    for (let i = 0; i + 1 < words.length; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (bigram.length >= 7 && doc.includes(bigram)) return true;
    }
    return false;
}
function toSpoken(text) {
    if (!text) return "";
    return text
        .replace(/ ?\(CCCD\)/g, "")
        .replace(/CCCD/g, "Căn cước công dân")
        .replace(/VNeID/g, "Vi-en-e-ai-đi")
        .replace(/CT07/g, "Xê-Tê-không-bảy")
        .replace(/CT08/g, "Xê-Tê-không-tám")
        .replace(/SAWACO CSKH/g, "Sa-qua-cô Xê-ét-ka-hát")
        .replace(/www\.capnuoctrungan\.vn/g, "vê kép vê kép vê kép chấm cấp nước trung an chấm vi-en")
        .replace(/873A Quang Trung/g, "Tám bảy ba A Quang Trung")
        .replace(/540 Hà Huy Giáp/g, "Năm trăm bốn mươi Hà Huy Giáp")
        .replace(/TP.HCM/g, "Thành Phố Hồ Chí Minh");
}

export function check_missing_docs_handler(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }
    const { loai_thu_tuc, doi_tuong } = normalizeProcedureArgs(args);
    const procedure = PROCEDURES[loai_thu_tuc];
    if (!procedure) {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: false,
                    ngoai_pham_vi: true,
                    message:
                        "Loại thủ tục không thuộc 4 thủ tục hỗ trợ. Nếu khách hỏi 1 trong 4 thủ tục → gọi lại " +
                        "với đúng loai_thu_tuc; nếu không → mời chuyển tổng đài viên (transfer_to_agent) " +
                        "hoặc tạo phiếu (create_ticket).",
                })
            }
        });
        send_message({
            type: "response.create",
            response: {
                instructions: `Đọc câu thông báo cho khách: "Dạ, em xin lỗi! Thủ tục Quý khách yêu cầu không thuộc danh mục em có thể hỗ trợ. Mời Quý khách cung cấp mã danh bộ hoặc đọc lại yêu cầu ạ. Nếu cần, Quý khách có thể yêu cầu kết nối tới tổng đài viên. `
            }
        });
        return;
    }
    const coPhanBietDoiTuong = procedure.cases.some((c) => c.id === "doanh_nghiep");
    if (!doi_tuong && coPhanBietDoiTuong) {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    thuTuc: procedure.title,
                    can_hoi_doi_tuong: true,
                    message:
                        `Cần biết đối tượng trước. HỎI khách: "Quý Khách đăng ký cho hộ gia đình hay ` +
                        `doanh nghiệp ạ?" rồi gọi lại tool với doi_tuong tương ứng.`,
                })
            }
        });
        send_message({
            type: "response.create",
            response: {
                instructions: `Đọc câu thông báo cho khách: "Dạ, em xin lỗi! Thủ tục Quý khách yêu cầu không thuộc danh mục em có thể hỗ trợ. Mời Quý khách cung cấp mã danh bộ hoặc đọc lại yêu cầu ạ. Nếu cần, Quý khách có thể yêu cầu kết nối tới tổng đài viên. `
            }
        });
        return;
    }
    let relevantCases = procedure.cases;
    if (doi_tuong) {
        const matched = procedure.cases.filter((c) => c.id.includes(doi_tuong) || c.id === "default");
        if (matched.length > 0) relevantCases = matched;
    }
    if (relevantCases.length > 0 && relevantCases.every((c) => c.transferToAgent)) {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    thuTuc: procedure.title,
                    can_chuyen_tong_dai: true,
                    message:
                        `Thủ tục ${procedure.title} cho doanh nghiệp/công ty do tổng đài viên hỗ trợ trực tiếp ` +
                        `— mời khách chuyển tổng đài viên (transfer_to_agent) hoặc tạo phiếu (create_ticket).`,
                })
            }
        });
        send_message({
            type: "response.create",
            response: {
                instructions: `Đọc câu thông báo cho khách: "Dạ, em xin lỗi! Thủ tục Quý khách yêu cầu không thuộc danh mục em có thể hỗ trợ. Mời Quý khách cung cấp mã danh bộ hoặc đọc lại yêu cầu ạ. Nếu cần, Quý khách có thể yêu cầu kết nối tới tổng đài viên. "`
            }
        });
        return;
    }
    const cs = relevantCases.find((c) => !c.transferToAgent);
    const docsReq = cs?.requiredDocs || {};
    const required = docsReq.required || [];
    const options = docsReq.options || [];

    let daCo = args.giay_to_da_co;
    if (typeof daCo === "string") daCo = [daCo];
    if (!Array.isArray(daCo)) daCo = [];
    daCo = daCo.filter((x) => typeof x === "string" && x.trim());
    if (daCo.length === 0) {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: false,
                    message:
                        "Thiếu danh sách giấy tờ khách đã có. Gọi lại tool với giay_to_da_co là mảng " +
                        'các giấy tờ khách nói đã có (vd ["giấy phép xây dựng"]).',
                })
            }
        });
        send_message({
            type: "response.create",
            response: {
                instructions: `Đọc câu thông báo cho khách: "Dạ, em xin lỗi! Thủ tục Quý khách yêu cầu không thuộc danh mục em có thể hỗ trợ. Mời Quý khách cung cấp mã danh bộ hoặc đọc lại yêu cầu ạ. Nếu cần, Quý khách có thể yêu cầu kết nối tới tổng đài viên. "`
            }
        });
        return;
    }

    const matchedRequired = new Set();
    let optionHit = null;
    const unrecognized = [];
    for (const item of daCo) {
        let hit = false;
        for (const r of required) {
            if (docMatches(item, r)) { matchedRequired.add(r); hit = true; }
        }
        for (const o of options) {
            if (docMatches(item, o)) { if (!optionHit) optionHit = o; hit = true; }
        }
        if (!hit) unrecognized.push(item);
    }
    const missingRequired = required.filter((r) => !matchedRequired.has(r));
    const needOption = options.length > 0 && !optionHit;
    const hoSoDu = missingRequired.length === 0 && !needOption;

    const daDuParts = [];
    if (optionHit) daDuParts.push(`nhóm "chỉ cần một trong" ĐÃ ĐỦ (khách có: ${optionHit})`);
    if (matchedRequired.size) daDuParts.push(`giấy bắt buộc đã có: ${[...matchedRequired].join("; ")}`);
    const thieu = [];
    if (missingRequired.length) thieu.push(`giấy tờ BẮT BUỘC: ${missingRequired.join("; ")}`);
    if (needOption) thieu.push(`MỘT trong các giấy tờ sau: ${options.join("; ")}`);
    // Câu cho KHÁCH về giấy chưa nhận diện được (đọc được); chỉ thị nội bộ để ở luu_y.
    const canhBaoKhach = unrecognized.length
        ? ` Riêng "${unrecognized.join('", "')}" thì em chưa chắc chắn dùng thay được, ` +
        `Quý Khách có thể yêu cầu gặp tổng đài viên để xác nhận ạ.`
        : "";

    // [13/07/2026 đợt 2] Tách chỉ thị (luu_y_cho_tro_ly) khỏi nội dung đọc
    // (doc_cho_khach) — cuộc E17jLdcYX5ACzRQ7IuGh0 model đọc nguyên văn chỉ thị
    // nằm chung trong "message" cho khách nghe.
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({
                success: true,
                thuTuc: procedure.title,
                ho_so_du: hoSoDu,
                con_thieu: hoSoDu ? [] : thieu,
                luu_y_cho_tro_ly:
                    `Ghi chú nội bộ, TUYỆT ĐỐI KHÔNG đọc cho khách: đã đối chiếu xong` +
                    `${daDuParts.length ? ` (${daDuParts.join("; ")})` : ""}. ` +
                    `Đọc NGUYÊN VĂN "doc_cho_khach", KHÔNG đọc lại giấy tờ khách đã có, ` +
                    `KHÔNG đọc lại toàn bộ danh sách.`,
                say_verbatim: toSpoken(
                    hoSoDu
                        ? `Dạ, hồ sơ giấy tờ của Quý Khách như vậy là đã đủ cho thủ tục ` +
                        `${procedure.title}, Quý Khách chỉ cần nộp hồ sơ thôi ạ.${canhBaoKhach}`
                        : `Dạ, Quý Khách còn cần ${thieu.join(", và ")}.${canhBaoKhach}`
                ),
            }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: `Đọc nguyên văn trường say_verbatim` },
    })
}