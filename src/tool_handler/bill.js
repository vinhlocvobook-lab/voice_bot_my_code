import { getTrangThaiTT, getAvailableAgents } from "../api.js";
import { docTienVN, docSanLuong, formatNgayThanhToan, format_danh_bo_voice } from "./tool_helper.js";
import { get_so_danh_bo_handler } from "./resolve_mdb.js";
import { check_avaliable_agents } from "./tool_call.js";




async function get_trang_thai_thanh_toan(function_event, asteriskData, send_message) {
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
    const kq = await getTrangThaiTT(asteriskData.ma_danh_bo, ky, nam);
    console.log("[tools][get_trang_thai_thanh_toan] kq: ", kq);
    // 1. TRƯỜNG HỢP THÀNH CÔNG CÓ DỮ LIỆU
    if (kq && kq.success && Array.isArray(kq.data) && kq.data.length > 0) {
        // Chuẩn hóa và chuyển các trường số thành chữ
        const items = kq.data.map(item => {
            const daThanhToan = item.TrangThaiThanhToan === "Đã thanh toán";
            const tongTienChu = docTienVN(item.TongTien);
            const sanLuongChu = docSanLuong(item.SanLuong);
            const ngayThanhToanText = daThanhToan ? formatNgayThanhToan(item.NgayThanhToan) : "";

            let cauThoai = `Dạ, tiền nước kỳ ${item.Ky} năm ${item.Nam} của Quý khách,có mã danh bộ là : ${format_danh_bo_voice(asteriskData.ma_danh_bo)}, sản lượng là ${sanLuongChu}, tổng tiền là ${tongTienChu}. `;
            if (daThanhToan) {
                cauThoai += `Hóa đơn đã được thanh toán${item.DonViThanhToan ? ` qua ${item.DonViThanhToan}` : ""}${ngayThanhToanText ? ` vào ${ngayThanhToanText}` : ""} ạ.`;
            } else {
                cauThoai += `Hiện tại hóa đơn này chưa thanh toán ạ.`;
            }
            cauThoai += " Quý khách có cần em hỗ trợ gì thêm không ạ? ";
            return {
                ky: item.Ky,
                nam: item.Nam,
                ma_danh_bo_digits: asteriskData.ma_danh_bo,
                ma_danh_bo_characters: format_danh_bo_voice(asteriskData.ma_danh_bo),
                tong_tien_so: item.TongTien,
                tong_tien_chu: tongTienChu,
                san_luong: item.SanLuong,
                san_luong_chu: sanLuongChu,
                trang_thai_thanh_toan: item.TrangThaiThanhToan,
                ngay_thanh_toan: ngayThanhToanText,
                don_vi_thanh_toan: item.DonViThanhToan,
                cau_thoai_doc: cauThoai
            };
        });

        const cauTraLoiChinh = items.map(i => i.cau_thoai_doc).join(" ");

        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    ma_danh_bo: asteriskData.ma_danh_bo,
                    message: "Tra cứu thông tin thành công.",
                    say_verbatim: cauTraLoiChinh,
                    chi_tiet: items
                }),
            }
        });

        send_message({
            type: "response.create",
            response: {
                instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được`
            }
        });

    } else {
        // 2. TRƯỜNG HỢP THẤT BẠI HOẶC KHÔNG CÓ DỮ LIỆU - PHÂN THEO ERROR_CODE
        // Trường hợp không có dữ liệu hoặc success = false
        const errorCode = kq?.error_code || "NOT_FOUND";
        const danhBoVoice = format_danh_bo_voice(asteriskData.ma_danh_bo);
        let thongBaoLoi = "";
        // const thongBaoLoi = `Dạ, hiện tại hệ thống chưa có dữ liệu sản lượng và tiền nước của kỳ ${ky} năm ${nam} cho số danh bộ ${format_danh_bo_voice(asteriskData.ma_danh_bo)} ạ. Quý khách có cần em hỗ trợ gì thêm không ạ!`;

        switch (errorCode) {
            case "PRODUCTION_NOT_FOUND":
                thongBaoLoi = `Dạ, hiện tại hệ thống chưa có dữ liệu sản lượng và tiền nước của kỳ ${ky} năm ${nam} cho số danh bộ ${danhBoVoice} ạ. Quý khách có cần em hỗ trợ gì thêm không ạ!`;
                break;
            case "CUSTOMER_NOT_FOUND":
                thongBaoLoi = `Dạ, hệ thống không tìm thấy thông tin khách hàng với mã danh bộ ${danhBoVoice} ạ. Quý khách vui lòng kiểm tra và đọc lại số danh bộ giúp em ạ!`;
                // if (check_avaliable_agents(function_event, asteriskData, send_message)) {
                //     thongBaoLoi = `Dạ, hiện tại hệ thống tra cứu đang gián đoạn kết nối. Quý khách có muốn em chuyển máy cho tổng đài viên để hỗ trợ không ạ ?`;
                // }
                // Đánh dấu để luồng sau yêu cầu xác nhận lại mã danh bộ
                asteriskData.ma_danh_bo_confirmed = false;
                break;

            case "CONNECTION_ERROR":
            case "INVALID_RESPONSE":
            case "TIMEOUT":
                // Lỗi máy chủ hoặc đường truyền
                thongBaoLoi = `Dạ, hiện tại hệ thống tra cứu đang gián đoạn kết nối. Quý khách vui lòng liên hệ lại sau ít phút giúp em ạ!`;
                // if (check_avaliable_agents(function_event, asteriskData, send_message)) {
                //     thongBaoLoi = `Dạ, hiện tại hệ thống tra cứu đang gián đoạn kết nối. Quý khách có muốn em chuyển máy cho tổng đài viên để hỗ trợ không ạ ?`;
                // }
                break;

            default:
                // Các trường hợp dữ liệu rỗng hoặc không xác định khác
                thongBaoLoi = `Dạ, hiện tại hệ thống chưa tìm thấy thông tin tiền nước kỳ ${ky} năm ${nam} cho số danh bộ ${danhBoVoice} ạ. Quý khách có cần em hỗ trợ gì thêm không ạ?`;
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
                    ma_danh_bo_characters: format_danh_bo_voice(asteriskData.ma_danh_bo),
                    error_code: kq?.error_code || "NOT_FOUND",
                    message: kq?.message || "Chưa có thông tin kỳ này.",
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
}
export async function get_bill_handler(function_event, asteriskData, send_message) {
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
        return await get_trang_thai_thanh_toan(function_event, asteriskData, send_message);
    }

    // B. Nếu CHƯA CÓ hoặc CHƯA XÁC NHẬN mã danh bộ:
    // Đánh dấu pending_action để sau khi xác nhận số danh bộ xong sẽ tự động tra cứu hóa đơn
    console.log("[tools][get_bill_handler] Chưa có mã danh bộ đã xác nhận -> chuyển tiếp sang get_so_danh_bo");
    asteriskData.pending_action = "get_bill";
    return await get_so_danh_bo_handler(function_event, asteriskData, send_message, "get_trang_thai_thanh_toan");
}