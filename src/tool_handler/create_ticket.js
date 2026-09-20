import { baoSuCo } from "../api.js";
import { insertTicket } from "../integrations/calllog-api.js";
import { log } from "../logger.js";

export async function create_ticket_handler_old1(function_event, asteriskData, send_message) {
    // { ma_danh_bo, loai, mo_ta }, callState) {
    // const rs = await resolveDanhBo(ma_danh_bo, callState);
    // if (!rs.ok) return rs.error;
    // Gộp loại + mô tả thành nội dung gửi lên endpoint bao-su-co.
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }
    const { ma_danh_bo, loai, mo_ta, ten, summary } = args;

    const noiDung = loai ? `[${loai}] ${mo_ta}` : mo_ta;
    const r = await baoSuCo(ma_danh_bo, noiDung, asteriskData.phoneNumber_real || asteriskData.phoneNumber);
    console.log("[handleCreateTicket]:kq_baoSuCo=", r);
    // Ghi vào bảng ticket qua API
    insertTicket({
        callId: asteriskData.callId,
        customerTel: asteriskData.phoneNumber_real || asteriskData.phoneNumber,
        args: { ma_danh_bo, loai, mo_ta },
        output: r,
    });

    if (!r.success) {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({ success: false, message: r.message || "Không tạo được phiếu sự cố." }),
            }
        });
        send_message({
            type: "response.create",
            response: { instructions: "Thông báo với khách, phiếu yêu cầu chưa được ghi nhận, mong quý khách thông cảm và gọi lại sau." }
        });
        return r;
        //return JSON.stringify({ success: false, message: r.message || "Không tạo được phiếu sự cố." });
    }
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({ success: true, message: r.message || "Phiếu tiếp nhận sự cố đã được ghi nhận.", data: r.data }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: "Thông báo với khách, phiếu yêu cầu đã được ghi nhận, hỏi khách có cần em hỗ trợ gì thêm không." }
    });
    return r; // 👉 Thêm dòng này để ghi output vào voicebot_toolcall
    // return JSON.stringify({
    //     success: true,
    //     message: r.message || "Phiếu tiếp nhận sự cố đã được ghi nhận.",
    //     data: r.data,
    // });
}
export async function create_ticket_handler(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }
    const { ma_danh_bo, loai, noi_dung_chi_tiet, ten, tel, dia_chi, so_dien_thoai_lien_he, khung_gio_lien_he } = args;

    // ⚠️ KHÔNG gọi API bao-su-co ở đây nữa. Chỉ ghi nhận tạm — phiếu thật sẽ
    // được tổng hợp (đọc lại toàn bộ transcript) và tạo khi cuộc gọi kết thúc,
    // xem hàm synthesizeTicket() trong gpt.js và ws.js (case "close").
    if (!asteriskData.pendingTicketNotes) asteriskData.pendingTicketNotes = [];
    asteriskData.pendingTicketNotes.push({
        ma_danh_bo, loai, noi_dung_chi_tiet, ten, tel, dia_chi, so_dien_thoai_lien_he, khung_gio_lien_he,
        time: new Date().toISOString(),
    });

    let instruct = "Xác nhận ngắn gọn với khách là đã ghi nhận.";
    // Sau khi lưu tạm vào pendingTicketNotes:
    // const daCoTen = ten || asteriskData.pendingTicketNotes?.some(n => n.ten && n.ten !== 'undefined');
    // const daCoDiaChi = dia_chi || asteriskData.pendingTicketNotes?.some(n => n.dia_chi && n.dia_chi !== 'undefined');
    // let nhacNho = [];

    // if (!daCoTen) nhacNho.push("tên người liên hệ");
    // if (!daCoDiaChi) nhacNho.push("địa chỉ cụ thể");


    // if (nhacNho.length > 0) {
    //     instruct += `Hãy hỏi khách bằng giọng tự nhiên xin thêm ${nhacNho.join(" và ")} để bên em tiện liên lạc với quý khách ạ.`;
    // } else {
    //     instruct = "Xác nhận ngắn gọn với khách là đã ghi nhận. Hỏi khách có cần bổ sung/chỉnh sửa gì thêm, hoặc còn cần hỗ trợ gì khác không.";
    // }
    instruct = "Xác nhận ngắn gọn với khách là đã ghi nhận. Hỏi khách có cần bổ sung/chỉnh sửa gì thêm, hoặc còn cần hỗ trợ gì khác không.";
    // instruct = "Tóm tắt lại nội dung yêu cầu của khách và hỏi khách có cần bổ sung/chỉnh sửa gì thêm, hoặc còn cần hỗ trợ gì khác không.  "
    log.info("[create_ticket_handler]:instruct=", instruct);
    // send_message({
    //     type: "response.create",
    //     response: { instructions: instruct }
    // });

    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({ success: true, message: "Đã ghi nhận thông tin." }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: instruct }
        //response: { instructions: "Xác nhận ngắn gọn với khách là đã ghi nhận thông tin (KHÔNG nói 'đã tạo phiếu'). Hỏi khách có cần bổ sung/chỉnh sửa gì thêm, hoặc còn cần hỗ trợ gì khác không." }
    });
    return { success: true, pending: true };
}