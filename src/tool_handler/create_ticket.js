import { baoSuCo } from "../api.js";

export async function create_ticket_handler(function_event, asteriskData, send_message) {
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
    const { ma_danh_bo, loai, mo_ta } = args;

    const noiDung = loai ? `[${loai}] ${mo_ta}` : mo_ta;
    const r = await baoSuCo(ma_danh_bo, noiDung, asteriskData.caller_phone);
    console.log("[handleCreateTicket]:kq_baoSuCo=", r);
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
        return;
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
    // return JSON.stringify({
    //     success: true,
    //     message: r.message || "Phiếu tiếp nhận sự cố đã được ghi nhận.",
    //     data: r.data,
    // });
}