
import { getSoSanhTangGiam } from "../api.js"
import { docTienVN, formatNgayThanhToan, docSanLuong, format_danh_bo_voice } from "./tool_helper.js"
import { get_so_danh_bo_handler } from "./resolve_mdb.js"


/**
 * Format chuỗi "7/2026" thành "kỳ 7 năm 2026" cho câu thoại tự nhiên
 */
function formatKyText(kyStr) {
    if (!kyStr) return "";
    const parts = String(kyStr).trim().split("/");
    if (parts.length === 2) {
        return `kỳ ${parts[0]} năm ${parts[1]}`;
    }
    return `kỳ ${kyStr}`;
}
async function get_compare_usage_old(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    const args = JSON.parse(function_arg || "{}");
    let { ky, nam } = args;
    if ((!ky || ky == "" || ky == "undefined") && asteriskData?.pending_bill_args?.ky) {
        ky = asteriskData.pending_bill_args.ky;
    }
    if ((!nam || nam == "" || nam == "undefined") && asteriskData?.pending_bill_args?.nam) {
        nam = asteriskData.pending_bill_args.nam;
    }

    // Nếu kỳ/năm trống, mặc định là tháng/năm hiện tại
    const now = new Date();
    if (!ky || ky == "" || ky == "undefined") {
        ky = now.getMonth() + 1;
    }
    if (!nam || nam == "" || nam == "undefined") {
        nam = now.getFullYear();
    }

    console.log("[tools][get_trang_thai_thanh_toan] arguments: ", { ma_danh_bo: asteriskData.ma_danh_bo, ky, nam });
    const kq = await getSoSanhTangGiam(asteriskData.ma_danh_bo, ky, nam);
    console.log("[tools][get_trang_thai_thanh_toan] kq: ", kq);
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify(kq),
        }
    });
    send_message({
        type: "response.create",
        response: {
            instructions: `Dựa vào kết quả so sánh sản lượng vừa nhận được, trả lời cho khách biết sản lượng kỳ này tăng hay giảm bao nhiêu khối so với kỳ trước.`
        }
    });
    return;
    // if (kq && kq.success && Array.isArray(kq.data) && kq.data.length > 0) {
    //     // Chuẩn hóa và chuyển các trường số thành chữ
    //     const items = kq.data.map(item => {
    //         const daThanhToan = item.TrangThaiThanhToan === "Đã thanh toán";
    //         const tongTienChu = docTienVN(item.TongTien);
    //         const sanLuongChu = docSanLuong(item.SanLuong);
    //         const ngayThanhToanText = daThanhToan ? formatNgayThanhToan(item.NgayThanhToan) : "";

    //         let cauThoai = `Dạ, tiền nước kỳ ${item.Ky} năm ${item.Nam} của Quý khách,có mã danh bộ là ${format_danh_bo_voice(asteriskData.ma_danh_bo)} sản lượng là ${sanLuongChu}, tổng tiền là ${tongTienChu}. `;
    //         if (daThanhToan) {
    //             cauThoai += `Hóa đơn đã được thanh toán${item.DonViThanhToan ? ` qua ${item.DonViThanhToan}` : ""}${ngayThanhToanText ? ` vào ${ngayThanhToanText}` : ""} ạ.`;
    //         } else {
    //             cauThoai += `Hiện tại hóa đơn này chưa thanh toán ạ.`;
    //         }

    //         return {
    //             ky: item.Ky,
    //             nam: item.Nam,
    //             tong_tien_so: item.TongTien,
    //             tong_tien_chu: tongTienChu,
    //             san_luong: item.SanLuong,
    //             san_luong_chu: sanLuongChu,
    //             trang_thai_thanh_toan: item.TrangThaiThanhToan,
    //             ngay_thanh_toan: ngayThanhToanText,
    //             don_vi_thanh_toan: item.DonViThanhToan,
    //             cau_thoai_doc: cauThoai
    //         };
    //     });

    //     const cauTraLoiChinh = items.map(i => i.cau_thoai_doc).join(" ");

    //     send_message({
    //         type: "conversation.item.create",
    //         item: {
    //             type: "function_call_output",
    //             call_id: call_id,
    //             output: JSON.stringify({
    //                 success: true,
    //                 message: "Tra cứu thông tin thành công.",
    //                 cau_tra_loi: cauTraLoiChinh,
    //                 chi_tiet: items
    //             }),
    //         }
    //     });

    //     send_message({
    //         type: "response.create",
    //         response: {
    //             instructions: `Đọc câu trả lời cho khách theo nội dung sau, đọc đúng các từ ngữ viết bằng chữ, không tự chuyển đổi ngược lại thành con số: "${cauTraLoiChinh}"`
    //         }
    //     });

    // } else {
    //     // Trường hợp không có dữ liệu hoặc success = false
    //     const thongBaoLoi = `Dạ, hiện tại hệ thống chưa có dữ liệu sản lượng và tiền nước của kỳ ${ky} năm ${nam} cho số danh bộ ${format_danh_bo_voice(asteriskData.ma_danh_bo)} ạ. Quý khách có cần em hỗ trợ gì thêm không ạ!`;

    //     send_message({
    //         type: "conversation.item.create",
    //         item: {
    //             type: "function_call_output",
    //             call_id: call_id,
    //             output: JSON.stringify({
    //                 success: false,
    //                 error_code: kq?.error_code || "NOT_FOUND",
    //                 message: kq?.message || "Chưa có thông tin kỳ này.",
    //                 cau_tra_loi: thongBaoLoi
    //             }),
    //         }
    //     });

    //     send_message({
    //         type: "response.create",
    //         response: {
    //             instructions: `Đọc câu thông báo cho khách: "${thongBaoLoi}"`
    //         }
    //     });
    // }
}
async function get_compare_usage(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    const args = JSON.parse(function_arg || "{}");
    let { ky, nam } = args;
    if ((!ky || ky == "" || ky == "undefined") && asteriskData?.pending_bill_args?.ky) {
        ky = asteriskData.pending_bill_args.ky;
    }
    if ((!nam || nam == "" || nam == "undefined") && asteriskData?.pending_bill_args?.nam) {
        nam = asteriskData.pending_bill_args.nam;
    }
    // Nếu kỳ/năm trống, mặc định là tháng/năm hiện tại
    const now = new Date();
    if (!ky || ky == "" || ky == "undefined") {
        ky = now.getMonth() + 1;
    }
    if (!nam || nam == "" || nam == "undefined") {
        nam = now.getFullYear();
    }
    const danhBoVoice = format_danh_bo_voice(asteriskData.ma_danh_bo);
    console.log("[tools][get_compare_usage] arguments: ", { ma_danh_bo: asteriskData.ma_danh_bo, ky, nam });
    const kq = await getSoSanhTangGiam(asteriskData.ma_danh_bo, ky, nam);
    console.log("[tools][get_compare_usage] kq: ", kq);
    // 1. TRƯỜNG HỢP THÀNH CÔNG VÀ CÓ DỮ LIỆU
    if (kq && kq.success && kq.data) {
        const { KyNay, KyTruoc, ThongTinKyNay, ThongTinKyTruoc, SoSanhTangGiam } = kq.data;
        const kyNayText = formatKyText(KyNay || `${ky}/${nam}`);
        const kyTruocText = formatKyText(KyTruoc);
        const sanLuongNay = docSanLuong(ThongTinKyNay?.SanLuong ?? 0);
        const tienNay = docTienVN(ThongTinKyNay?.TienNuoc ?? 0);
        const {
            TangGiamSanLuong = 0,
            TangGiamTien = 0,
            TrangThaiSanLuong = "Không đổi",
            TrangThaiTien = "Không đổi",
            PhanTramChenhLechSanLuong = 0
        } = SoSanhTangGiam || {};
        // Xây dựng câu mô tả trạng thái tăng / giảm sản lượng
        let moTaSanLuong = "";
        const slChenhLechChu = docSanLuong(Math.abs(TangGiamSanLuong));
        const phanTramText = PhanTramChenhLechSanLuong ? `, tương đương ${Math.abs(Math.round(PhanTramChenhLechSanLuong))} phần trăm` : "";
        if (TrangThaiSanLuong.toLowerCase() === "tăng") {
            moTaSanLuong = `tăng ${slChenhLechChu}${phanTramText}`;
        } else if (TrangThaiSanLuong.toLowerCase() === "giảm") {
            moTaSanLuong = `giảm ${slChenhLechChu}${phanTramText}`;
        } else {
            moTaSanLuong = `không thay đổi`;
        }
        // Xây dựng câu mô tả tiền nước
        let moTaTien = "";
        const tienChenhLechChu = docTienVN(Math.abs(TangGiamTien));
        if (TrangThaiTien.toLowerCase() === "tăng") {
            moTaTien = `, tiền nước tăng ${tienChenhLechChu}`;
        } else if (TrangThaiTien.toLowerCase() === "giảm") {
            moTaTien = `, tiền nước giảm ${tienChenhLechChu}`;
        }
        // Ghép thành lời thoại hoàn chỉnh
        const cauThoai = `Dạ, ở ${kyNayText}, sản lượng nước của Quý khách có mã danh bộ là ${danhBoVoice} là ${sanLuongNay}, tiền nước là ${tienNay}. So với ${kyTruocText}, sản lượng nước ${moTaSanLuong}${moTaTien}. Quý khách có cần em hỗ trợ gì thêm không ạ?`;
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    ma_danh_bo: asteriskData.ma_danh_bo,
                    message: "Lấy dữ liệu so sánh tăng giảm thành công.",
                    say_verbatim: cauThoai,
                    data: kq.data
                }),
            }
        });
        send_message({
            type: "response.create",
            response: {
                instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được`
            }
        });
        return;
    }
    // 2. TRƯỜNG HỢP THẤT BẠI HOẶC KHÔNG CÓ DỮ LIỆU - PHÂN THEO ERROR_CODE
    const errorCode = kq?.error_code || "NOT_FOUND";
    let thongBaoLoi = "";
    switch (errorCode) {
        case "PRODUCTION_NOT_FOUND":
            thongBaoLoi = `Dạ, hiện tại hệ thống chưa có dữ liệu sản lượng của kỳ ${ky} năm ${nam} cho số danh bộ ${danhBoVoice} để so sánh ạ. Quý khách có cần em hỗ trợ gì thêm không ạ?`;
            break;
        case "CUSTOMER_NOT_FOUND":
            thongBaoLoi = `Dạ, hệ thống không tìm thấy thông tin khách hàng với mã danh bộ ${danhBoVoice} ạ. Quý khách vui lòng kiểm tra và đọc lại số danh bộ giúp em ạ!`;
            // Đánh dấu để yêu cầu khách xác nhận/đọc lại danh bộ
            asteriskData.ma_danh_bo_confirmed = false;
            break;
        case "CONNECTION_ERROR":
        case "INVALID_RESPONSE":
        case "TIMEOUT":
            thongBaoLoi = `Dạ, hiện tại hệ thống tra cứu đang gián đoạn kết nối. Quý khách vui lòng liên hệ lại sau ít phút giúp em ạ!`;
            break;
        default:
            thongBaoLoi = `Dạ, hiện tại hệ thống chưa tìm thấy dữ liệu so sánh sản lượng kỳ ${ky} năm ${nam} cho số danh bộ ${danhBoVoice} ạ. Quý khách có cần em hỗ trợ gì thêm không ạ?`;
            break;
    }
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({
                success: false,
                ma_danh_bo_digits: asteriskData.ma_danh_bo,
                ma_danh_bo_characters: danhBoVoice,
                error_code: errorCode,
                message: kq?.message || "Không có dữ liệu so sánh.",
                say_verbatim: thongBaoLoi
            }),
        }
    });
    send_message({
        type: "response.create",
        response: {
            instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được`
        }
    });
}

export async function compare_usage_handler(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }

    // Ghi nhớ thông tin tra cứu nếu khách có nói rõ kỳ, năm
    if (args.ky || args.nam) {
        asteriskData.pending_bill_args = {
            ky: args.ky,
            nam: args.nam
        };
    }

    // A. Nếu ĐÃ XÁC NHẬN mã danh bộ -> Tra cứu trực tiếp từ API
    if (asteriskData.ma_danh_bo_confirmed && asteriskData.ma_danh_bo) {
        return await get_compare_usage(function_event, asteriskData, send_message);
    }

    // B. Nếu CHƯA CÓ hoặc CHƯA XÁC NHẬN mã danh bộ:
    // Đánh dấu pending_action để sau khi xác nhận số danh bộ xong sẽ tự động tra cứu hóa đơn
    console.log("[tools][get_bill_handler] Chưa có mã danh bộ đã xác nhận -> chuyển tiếp sang get_so_danh_bo");
    asteriskData.pending_action = "compare_usage";
    return await get_so_danh_bo_handler(function_event, asteriskData, send_message, "get_compare_usage");
}