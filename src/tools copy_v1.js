import { log, log_sequenceDiagram } from "./logger.js";
import { get_so_danh_bo } from "./gpt.js"
import { getTrangThaiTT } from "./api.js"

async function get_trang_thai_thanh_toan(function_event, asteriskData, send_message) {
    const { name, event_id, response_id, item_id, output_index, call_id, arguments: function_arg } = function_event;
    const args = JSON.parse(function_arg || "{}");
    let { ma_danh_bo, ky, nam } = args;
    console.log("[tools][get_trang_thai_thanh_toan] ma_danh_bo: ", { ma_danh_bo: asteriskData.ma_danh_bo, ky, nam });

    // nếu ky là null hoặc '' thì cài đặc mặc định là tháng hiện tại
    if (!ky || ky == null || ky == "" || ky == "undefined") {
        const now = new Date();
        ky = now.getMonth() + 1;
        nam = now.getFullYear();
    }
    //nếu nam là null hoặc '' thì cài đặt mặc định là năm hiện tại
    if (!nam || nam == null || nam == "" || nam == "undefined") {
        const now = new Date();
        nam = now.getFullYear();
    }
    console.log("\n\r \n\r [tools][get_trang_thai_thanh_toan] arguments: ", { ma_danh_bo: asteriskData.ma_danh_bo, ky, nam });
    const kq = await getTrangThaiTT(asteriskData.ma_danh_bo, ky, nam);
    console.log("\n\r \n\r [tools][get_trang_thai_thanh_toan] kq: ", kq);
    if (kq.success) {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    data: kq,
                }),
            }
        })
        console.log("[tools][get_trang_thai_thanh_toan] kq: ", kq);
        send_message({
            type: "response.create",
            response: { instructions: `trả lời thông tin theo data nhận được ` }
        })
    } else {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: false,
                    error: kq.message,
                }),
            }
        })
        send_message({
            type: "response.create",
            response: { instructions: `trả lời thông tin theo data nhận được ` }
        })
    }
}
//mã danh bộ là 11 chữ số
function valid_ma_danh_bo(ma_danh_bo) {

    if (typeof ma_danh_bo == "number") {
        ma_danh_bo = String(ma_danh_bo);
    }
    else {
        //chỉ giữ lại số
        ma_danh_bo = ma_danh_bo.replace(/\D/g, "");
    }
    if (typeof ma_danh_bo == "string") {
        if (ma_danh_bo.length != 11) {
            throw new Error("Mã danh bộ là 11 chữ số, vui lòng đọc lại mã danh bộ !");
        } else if (!/^[0-9]{11}$/.test(ma_danh_bo)) {
            throw new Error("Mã danh bộ là 11 chữ số, vui lòng đọc lại mã danh bộ !");
        } else {
            return ma_danh_bo;
        }
    }
    throw new Error("Mã danh bộ là 11 chữ số, vui lòng đọc lại mã danh bộ !");
}
function sdb_doc_mdb_chua_co(function_event, send_message) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: false,
                error: "Chưa có mã danh bộ, cần nhờ khách hàng đọc mã danh bộ",
                message: "Dạ, Quý khách vui lòng đọc mã danh bộ giúp em ạ !"
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Đọc câu chính xác câu và không thêm bất cứ lời dẫn dắt nào khác : "Dạ, Quý khách vui lòng đọc mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quãng giúp em ạ ! "` }
    })

}

function sdb_chuaro(function_event, send_message, mdb_gpt) {
    if (typeof mdb_gpt == "undefined" || mdb_gpt == null || mdb_gpt == "") {
        sdb_doc_mdb_chua_co(function_event, send_message)
        return;
    }
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: false,
                ma_danh_bo: mdb_gpt,
                error: "Cần khách đọc lại mã danh bộ để xác nhận",
                message: "Dạ, Quý khách vui lòng đọc lại 11 số mã danh bộ, để em xác nhận đúng mã giúp em ạ !"
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Đọc câu chính xác câu và không thêm bất cứ lời dẫn dắt nào khác : "Dạ, Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắn quảng giúp em ạ ! "` }
    })

}
function sdb_vanchuaro(function_event, send_message, mdb_gpt) {
    if (typeof mdb_gpt == "undefined" || mdb_gpt == null || mdb_gpt == "") {
        sdb_doc_mdb_chua_co(function_event, send_message)
        return;
    }
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: false,
                ma_danh_bo: mdb_gpt,
                error: "Cần khách đọc lại mã danh bộ để xác nhận",
                message: "Dạ, Quý khách vui lòng đọc lại 11 số mã danh bộ giúp em một lần nữa, để em xác nhận đúng mã danh bộ ạ"
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Đọc câu chính xác câu và không thêm bất cứ lời dẫn dắt nào khác : "Dạ, Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quảng giúp em một lần nữa nhé!"` }
    })

}
function sdb_doc_xacnhan(function_event, send_message, ma_danh_bo) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: false,
                ma_danh_bo: ma_danh_bo,
                error: "Cần xác nhận số danh bộ",
                message: `Dạ, Mã danh bộ của quý khách là ${ma_danh_bo}, quý khách xác nhận giúp em có đúng không ạ!`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Đọc câu chính xác câu và không thêm bất cứ lời dẫn dắt nào khác : "Dạ, Mã danh bộ của quý khách là ${ma_danh_bo}, quý khách xác nhận giúp em có đúng không ạ!` }
    })

}

export async function get_bill_handler(function_event, asteriskData, send_message) {

    let ma_danh_bo = "";
    let { name, event_id, response_id, item_id, output_index, call_id, arguments: function_arg } = function_event;
    const args = JSON.parse(function_arg || "{}");
    const { ma_danh_bo: mdb_arg, ky, nam } = args;
    const kq_get_so_danh_bo = await get_so_danh_bo(asteriskData);

    console.log("\n\r \n\r\n \r [tools][get_bill_handler] kq_get_so_danh_bo: ", kq_get_so_danh_bo);
    console.log(" [function_event]: ", function_event);
    console.log("\n\r \n\r");
    const { ma_danh_bo: mdb_gpt, xac_nhan, do_tin_cay, ly_do } = kq_get_so_danh_bo



    try {
        if (mdb_gpt == "" || mdb_gpt == null || mdb_gpt == "undefined") {
            sdb_doc_mdb_chua_co(function_event, send_message)
            return;
        }
        ma_danh_bo = valid_ma_danh_bo(mdb_gpt);
    }
    catch (error) {
        console.log("\n\r n\r 1./ Mã Danh Bộ không hợp lệ nên cần đọc lại", { mdb_gpt });
        if (asteriskData.ma_danh_bo_phase == 1) {
            console.log("\n\r n\r 2./ phase 1 : Đọc lại vì không hợp lệ", { mdb_gpt });
            sdb_chuaro(function_event, send_message, mdb_gpt);
        }
        else {
            console.log("\n\r n\r 3./ phase 2 : Đọc lại vì không hợp lệ", { mdb_gpt });
            sdb_vanchuaro(function_event, send_message, mdb_gpt);
        }
        asteriskData.ma_danh_bo_count++;
        asteriskData.ma_danh_bo_phase = 2;
        return;
    }
    // mdb_gpt hợp lệ
    if (asteriskData.ma_danh_bo == "") {
        // chưa có mã danh bộ đã confirmed
        if (asteriskData.ma_danh_bo_checking == "") {
            //chưa có mã danh bộ cần kiểm tra
            if (asteriskData.ma_danh_bo_phase == 1) {
                console.log("4./ mã danh bộ hợp lệ, phase 1, Đọc lại cho chắc", { mdb_gpt });
                sdb_chuaro(function_event, send_message, mdb_gpt);
            }
            else {
                console.log("5./ mã danh bộ hợp lệ, phase 2, Đọc lại lần nữa cho chắc", { mdb_gpt });
                sdb_vanchuaro(function_event, send_message, mdb_gpt);
            }
            asteriskData.ma_danh_bo_checking = mdb_gpt;
            asteriskData.ma_danh_bo_count++;
            asteriskData.ma_danh_bo_phase = 3; // chuyển sang giai đoạn nhờ khách hàng đọc lại mã danh bộ
            return;
        } else {
            if (mdb_gpt == asteriskData.ma_danh_bo_checking) {
                asteriskData.ma_danh_bo_confirmed = true;
                asteriskData.ma_danh_bo = mdb_gpt;
                asteriskData.ma_danh_bo_phase = 4;
                console.log("6./ mã danh bộ hợp lệ, phase 3, Đã confirmed, chuyển sang giai đoạn get_trang_thai_thanh_toan", { mdb_gpt });
                get_trang_thai_thanh_toan(function_event, asteriskData, send_message);
                return;
            } else {
                console.log("7./ mã danh bộ hợp lệ, Đọc lại vì không khớp với mã danh bộ cần kiểm tra", { mdb_gpt });
                sdb_vanchuaro(function_event, send_message, mdb_gpt);
                asteriskData.ma_danh_bo_count++;
                return;
            }
        }


    }
    else {
        //đã có mã danh bộ cần kiểm tra
        if (asteriskData.ma_danh_bo == mdb_gpt) {
            //đã confirmed
            asteriskData.ma_danh_bo_confirmed = true;
            asteriskData.ma_danh_bo = mdb_gpt;
            asteriskData.ma_danh_bo_phase = 4;
            console.log("8./ mã danh bộ hợp lệ, phase 4, Đã confirmed & khớp, chuyển sang giai đoạn get_trang_thai_thanh_toan", { mdb_gpt });
            get_trang_thai_thanh_toan(function_event, asteriskData, send_message);
            return;

        } else {
            // mã danh bộ khác với mã danh bộ cần kiểm tra
            // thực hiện quy trình xác nhận lại
            console.log("9./ mã danh bộ hợp lệ, phase 4, Đã confirmed & không khớp, Đọc lại để xac nhận", { mdb_gpt });
            sdb_vanchuaro(function_event, send_message, mdb_gpt);
            return;
        }
    }


    // console.log(`[get_bill]: ma_danh_bo = ${ma_danh_bo_from_function_arguments}, ky = ${ky}, nam = ${nam}`);
}
export function tool_wait_for_user_handler(function_event, asteriskData, send_message) {
    let { name, event_id, response_id, item_id, output_index, call_id, arguments: function_arg } = function_event;

    const outputMessage = {
        type: "conversation.item.create",
        item: {
            type: "function_callq_output",
            call_id: call_id,
            output: JSON.stringify({ status: "acknowledged", action: "waiting_for_user" }),
        },
    };
    log.info(`[Tool][wait_for_user] Nhận diện tạp âm/chờ người dùng (call_id: ${call_id}). Giữ im lặng, không trigger response.`);
    log_sequenceDiagram(`Code-->>OpenAI: conversation.item.create (function_call_output: wait_for_user)`, asteriskData?.fileName);

    send_message(outputMessage);

}
export function tool_function_handler(function_event, asteriskData, send_message) {

    if (function_event.name == "get_bill") {
        return get_bill_handler(function_event, asteriskData, send_message);
    }
    else if (function_event.name == "wait_for_user") {
        return tool_wait_for_user_handler(function_event, asteriskData, send_message);
    } else {
        log.warn(`[Tool] Chưa có handler cho tool: ${function_event.name} (call_id: ${function_event.call_id})`);
        // Phản hồi tạm để OpenAI không bị treo
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