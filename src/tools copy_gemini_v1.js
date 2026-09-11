import { log, log_sequenceDiagram } from "./logger.js";
import { get_so_danh_bo } from "./gpt.js";
import { getTrangThaiTT } from "./api.js";

// Helper tách số để AI phát âm ngắt nhịp dễ nghe (ví dụ: "2 2 0 2, 3 2 5 1, 7 7 5")
function format_danh_bo_voice(s) {
    if (!s || s.length !== 11) return s;
    return `${s.slice(0, 4).split('').join(' ')}, ${s.slice(4, 8).split('').join(' ')}, ${s.slice(8).split('').join(' ')}`;
}

// 1. Kiểm tra 11 chữ số
function valid_ma_danh_bo(ma_danh_bo) {
    if (!ma_danh_bo) return null;
    const clean = String(ma_danh_bo).replace(/\D/g, "");
    return clean.length === 11 ? clean : null;
}

// 2. Các helper gửi thoại cưỡng chế cho OpenAI
function sdb_doc_chua_co(function_event, send_message) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({ success: false, error: "chua_co_danh_bo", message: "Yêu cầu khách đọc mã danh bộ" }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: `Đọc CHÍNH XÁC câu sau, không thêm bớt: "Dạ, Quý khách vui lòng đọc mã danh bộ gồm 11 chữ số giúp em ạ!"` }
    });
}

function sdb_doc_sai_hoac_thieu(function_event, send_message, msg = "") {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({ success: false, error: "thieu_hoac_sai_so", message: msg || "Đọc lại danh bộ" }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: `Đọc CHÍNH XÁC câu sau, không thêm bớt: "Dạ em nghe chưa rõ hoặc chưa đủ 11 chữ số, Quý khách vui lòng đọc lại giúp em nhé!"` }
    });
}

function sdb_doc_xac_nhan(function_event, send_message, ma_danh_bo) {
    const voiceText = format_danh_bo_voice(ma_danh_bo);
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({ success: false, status: "cho_xac_nhan", ma_danh_bo: ma_danh_bo }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: `Đọc CHÍNH XÁC câu sau, không thêm bớt: "Dạ, mã danh bộ của Quý khách là ${voiceText}, có đúng không ạ?"` }
    });
}

function chuyen_tong_dai(function_event, send_message, ly_do) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({ success: false, action: "transfer_to_agent", message: ly_do }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: `Đọc CHÍNH XÁC câu sau, không thêm bớt: "Dạ để hỗ trợ tốt nhất, em xin phép chuyển cuộc gọi đến tổng đài viên, Quý khách vui lòng giữ máy ạ!"` }
    });
}

// 3. Hàm gọi API tra cứu tiền nước
async function get_trang_thai_thanh_toan(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    const args = JSON.parse(function_arg || "{}");
    let { ky, nam } = args;

    const now = new Date();
    if (!ky) ky = now.getMonth() + 1;
    if (!nam) nam = now.getFullYear();

    console.log(`[get_bill] Gọi API ma_danh_bo: ${asteriskData.ma_danh_bo}, kỳ: ${ky}/${nam}`);
    const kq = await getTrangThaiTT(asteriskData.ma_danh_bo, ky, nam);
    console.log(`[get_bill] Kết quả API:`, kq);

    if (kq && kq.success) {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({ success: true, data: kq.data || kq }),
            }
        });
        send_message({
            type: "response.create",
            response: { instructions: `Đọc tóm tắt ngắn gọn số tiền nước và trạng thái đã thanh toán hay chưa theo dữ liệu vừa nhận. Không nói dài dòng.` }
        });
    } else {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({ success: false, error: kq?.message || "Không tìm thấy hóa đơn" }),
            }
        });
        send_message({
            type: "response.create",
            response: { instructions: `Đọc câu: "Dạ, hiện tại hệ thống chưa tìm thấy thông tin tiền nước của kỳ này, Quý khách vui lòng kiểm tra lại ạ!"` }
        });
    }
}

// 4. Hàm xử lý chính get_bill_handler
export async function get_bill_handler(function_event, asteriskData, send_message) {
    // A. Nếu ĐÃ XÁC NHẬN từ trước đó -> Tra cứu trực tiếp
    if (asteriskData.ma_danh_bo_confirmed && asteriskData.ma_danh_bo) {
        return await get_trang_thai_thanh_toan(function_event, asteriskData, send_message);
    }

    // B. Gọi Arbiter phân tích toàn bộ hội thoại
    const kq_arbiter = await get_so_danh_bo(asteriskData);
    console.log("[tools][get_bill_handler] kq_arbiter:", kq_arbiter);
    const { ma_danh_bo: mdb_gpt, xac_nhan } = kq_arbiter || {};
    const valid_mdb = valid_ma_danh_bo(mdb_gpt);

    // C. Kiểm tra nếu ĐANG Ở TRẠNG THÁI CHỜ XÁC NHẬN (Phase 2)
    if (asteriskData.ma_danh_bo_checking) {
        // 1. Khách xác nhận "ĐÚNG"
        if (xac_nhan === "đúng") {
            asteriskData.ma_danh_bo = asteriskData.ma_danh_bo_checking;
            asteriskData.ma_danh_bo_confirmed = true;
            console.log(`[get_bill] ĐÃ XÁC NHẬN THÀNH CÔNG: ${asteriskData.ma_danh_bo}`);
            return await get_trang_thai_thanh_toan(function_event, asteriskData, send_message);
        }

        // 2. Khách bảo "SAI" hoặc đọc một mã mới khác
        if (xac_nhan === "sai" || (valid_mdb && valid_mdb !== asteriskData.ma_danh_bo_checking)) {
            asteriskData.ma_danh_bo_count = (asteriskData.ma_danh_bo_count || 0) + 1;
            if (asteriskData.ma_danh_bo_count >= 3) {
                return chuyen_tong_dai(function_event, send_message, "Xác nhận sai mã danh bộ quá 3 lần");
            }

            if (valid_mdb) {
                // Khách đọc luôn mã mới -> chuyển sang hỏi xác nhận mã mới
                asteriskData.ma_danh_bo_checking = valid_mdb;
                return sdb_doc_xac_nhan(function_event, send_message, valid_mdb);
            } else {
                // Khách chỉ bảo sai mà chưa đọc mã mới -> reset và xin đọc lại
                asteriskData.ma_danh_bo_checking = "";
                return sdb_doc_sai_hoac_thieu(function_event, send_message, "Khách xác nhận sai mã danh bộ");
            }
        }
    }

    // D. CHƯA CÓ MÃ / ĐANG THU THẬP MÃ (Phase 1)
    if (!valid_mdb) {
        // Chưa có số nào trong hội thoại
        if (!mdb_gpt) {
            return sdb_doc_chua_co(function_event, send_message);
        }
        // Có số nhưng không đủ 11 chữ số
        asteriskData.ma_danh_bo_count = (asteriskData.ma_danh_bo_count || 0) + 1;
        if (asteriskData.ma_danh_bo_count >= 3) {
            return chuyen_tong_dai(function_event, send_message, "Khách đọc không đủ 11 số quá 3 lần");
        }
        return sdb_doc_sai_hoac_thieu(function_event, send_message, "Mã không đủ 11 chữ số");
    }

    // E. ĐÃ BẮT ĐƯỢC MÃ 11 SỐ HỢP LỆ LẦN ĐẦU -> Đọc lại xin xác nhận
    asteriskData.ma_danh_bo_checking = valid_mdb;
    return sdb_doc_xac_nhan(function_event, send_message, valid_mdb);
}

// 5. Handler wait_for_user
export function tool_wait_for_user_handler(function_event, asteriskData, send_message) {
    const { call_id } = function_event;
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({ status: "acknowledged", action: "waiting_for_user" }),
        },
    });
}

// 6. Router tool
export function tool_function_handler(function_event, asteriskData, send_message) {
    if (function_event.name === "get_bill") {
        return get_bill_handler(function_event, asteriskData, send_message);
    } else if (function_event.name === "wait_for_user") {
        return tool_wait_for_user_handler(function_event, asteriskData, send_message);
    } else {
        log.warn(`[Tool] Chưa có handler cho tool: ${function_event.name} (call_id: ${function_event.call_id})`);
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: function_event.call_id,
                output: JSON.stringify({ status: "not_implemented", message: `Tính năng ${function_event.name} đang được nâng cấp.` })
            }
        });
        send_message({ type: "response.create" });
    }
}
