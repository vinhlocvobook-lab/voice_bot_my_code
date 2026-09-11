import { getThongBaoCupNuoc } from "../api.js";
import { format_danh_bo_voice } from "./tool_helper.js";
import { get_so_danh_bo_handler } from "./resolve_mdb.js";

function formatThoiGianDuKien(dateTimeStr) {
    if (!dateTimeStr) return "";
    const m = String(dateTimeStr).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (m) {
        const [_, day, month, year, hour, minute] = m;
        return `${parseInt(hour, 10)} giờ ${minute === "00" ? "" : `${minute} phút `}ngày ${parseInt(day, 10)} tháng ${parseInt(month, 10)} năm ${year}`;
    }
    return dateTimeStr;
}
async function get_outages(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    const danhBoVoice = format_danh_bo_voice(asteriskData.ma_danh_bo);
    const args = JSON.parse(function_arg || "{}");
    console.log("[tools][get_outages] arguments: ", { ma_danh_bo: asteriskData.ma_danh_bo });
    const kq = await getThongBaoCupNuoc(asteriskData.ma_danh_bo);
    console.log("[tools][get_outages] kq: ", kq);

    // 1. TRƯỜNG HỢP THÀNH CÔNG (kq.success = true)
    if (kq && kq.success && kq.data) {
        const { coSuCo, thongBao, thoiGianDuKienHoanThanh } = kq.data;
        let cauThoai = "";
        if (coSuCo) {
            const tgHoanThanh = formatThoiGianDuKien(thoiGianDuKienHoanThanh);
            if (tgHoanThanh) {
                cauThoai = `Dạ, khu vực của Quý khách có mã danh bộ ${danhBoVoice} đang nằm trong vùng sự cố cúp nước, thời gian dự kiến hoàn thành là ${tgHoanThanh} ạ. Quý khách cần em hỗ trợ gì thêm nữa không ạ?`;
            } else {
                cauThoai = `Dạ, khu vực của Quý khách có mã danh bộ ${danhBoVoice} đang nằm trong vùng sự cố cúp nước ạ. Quý khách cần em hỗ trợ gì thêm nữa không ạ?`;
            }
        } else {
            cauThoai = `Dạ, hiện tại khu vực của Quý khách có mã danh bộ ${danhBoVoice} không nằm trong vùng sự cố cúp nước ạ. Quý khách cần em hỗ trợ gì thêm nữa không ạ?`;
        }
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    ma_danh_bo_digits: asteriskData.ma_danh_bo,
                    ma_danh_bo_characters: danhBoVoice,
                    message: "Tra cứu thông tin cúp nước thành công.",
                    say_verbatim: cauThoai
                }),
            }
        });

        send_message({
            type: "response.create",
            response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
        });
        return;
    }
    // 2. TRƯỜNG HỢP API TRẢ VỀ KHÔNG HỢP LỆ HOẶC LỖI
    const errorCode = kq?.error_code || "NOT_FOUND";
    let thongBaoLoi = "";
    switch (errorCode) {
        case "CUSTOMER_NOT_FOUND":
            thongBaoLoi = `Dạ, hệ thống không tìm thấy thông tin khách hàng với mã danh bộ ${danhBoVoice} ạ. Quý khách vui lòng kiểm tra có đúng không ạ, và đọc lại số danh bộ đúng giúp em ạ!`;
            // Reset trạng thái xác nhận để bot yêu cầu cung cấp lại danh bộ
            asteriskData.ma_danh_bo_confirmed = false;
            break;
        case "CONNECTION_ERROR":
        case "TIMEOUT":
        case "INVALID_RESPONSE":
            thongBaoLoi = `Dạ, hiện tại hệ thống tra cứu đang gián đoạn kết nối. Quý khách vui lòng liên hệ lại sau ít phút giúp em ạ!`;
            break;
        default:
            thongBaoLoi = `Dạ, hiện tại hệ thống chưa thể tra cứu thông tin sự cố cúp nước cho số danh bộ ${danhBoVoice} ạ. Quý khách cần em hỗ trợ gì thêm không ạ?`;
            break;
    }

    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({
                success: false,  // Vẫn báo success cho LLM
                ma_danh_bo_digits: asteriskData.ma_danh_bo,
                ma_danh_bo_characters: danhBoVoice,
                message: kq?.message || "Không thể lấy thông tin cúp nước.",
                say_verbatim: thongBaoLoi
            }),
        }
    });

    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
    });
    //     {
    //     "success": true,
    //     "http_code": 200,
    //     "data": {
    //         "success": true,
    //         "message": "Lấy thông tin cúp nước thành công.",
    //         "data": {
    //             "coSuCo": false,
    //             "thongBao": "Khách hàng không nằm trong vùng bị sự cố.",
    //             "thoiGianDuKienHoanThanh": ""
    //         }
    //     }
    // }

    // {
    //     "success": true,
    //     "message": "Lấy thông tin cúp nước thành công.",
    //     "data": {
    //         "coSuCo": true,
    //         "thongBao": "Khách hàng nằm trong vùng bị sự cố.",
    //         "thoiGianDuKienHoanThanh": "22/05/2026 16:00"
    //     }
    // }

    // if (!kq.success) {
    //     const data = kq.data || {};
    //     const { coSuCo, thongBao, thoiGianDuKienHoanThanh } = data;
    //     let cauThoai = "";
    //     if (coSuCo) {
    //         let cauThoai = `Dạ, khu vực của Quý khách có mã danh bộ ${format_danh_bo_voice(asteriskData.ma_danh_bo)} đang nằm trong vùng sự cố, thời gian dự kiến hoàn thành ${thoiGianDuKienHoanThanh} ạ!. Quý khách cần em hỗ trợ gì thêm nữa không ạ?`;
    //     } else {
    //         let cauThoai = `Dạ, hiện tại khu vực của Quý khách có mã danh bộ ${format_danh_bo_voice(asteriskData.ma_danh_bo)} không có thông tin sự cố ạ!. Quý khách cần em hỗ trợ gì thêm nữa không ạ?`;
    //     }
    //     send_message({
    //         type: "conversation.item.create",
    //         item: {
    //             type: "function_call_output",
    //             call_id: call_id,
    //             output: JSON.stringify({
    //                 success: true,
    //                 message: "Tra cứu thông tin cúp nước thành công.",
    //                 say_verbatim: cauThoai
    //             }),
    //         }
    //     });

    //     send_message({
    //         type: "response.create",
    //         response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
    //     });
    //     return;
    // }
    // send_message({
    //     type: "conversation.item.create",
    //     item: {
    //         type: "function_call_output",
    //         call_id: call_id,
    //         output: JSON.stringify(kq),
    //     }
    // });

    // send_message({
    //     type: "response.create",
    //     response: { instructions: `trả lời theo kết quả trả về của call function output giúp mình` }
    // });


}

export async function get_outages_handler(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }



    // A. Nếu ĐÃ XÁC NHẬN mã danh bộ -> Tra cứu trực tiếp từ API
    if (asteriskData.ma_danh_bo_confirmed && asteriskData.ma_danh_bo) {
        return await get_outages(function_event, asteriskData, send_message);
    }

    // B. Nếu CHƯA CÓ hoặc CHƯA XÁC NHẬN mã danh bộ:
    // Đánh dấu pending_action để sau khi xác nhận số danh bộ xong sẽ tự động tra cứu hóa đơn
    console.log("[tools][get_outages_handler] Chưa có mã danh bộ đã xác nhận -> chuyển tiếp sang get_so_danh_bo");
    asteriskData.pending_action = "get_outages";
    return await get_so_danh_bo_handler(function_event, asteriskData, send_message, "get_outages");
}