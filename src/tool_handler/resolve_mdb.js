import { get_so_danh_bo } from "../gpt.js";
import { log } from "../logger.js";
import { valid_ma_danh_bo, format_danh_bo_voice } from "./tool_helper.js";

function sdb_doc_mdb_chua_co(function_event, send_message) {
    const cauThoai = "Dạ, Quý khách vui lòng đọc mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quãng giúp em ạ!";
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                status: "Khách chưa có mã danh bộ",
                say_verbatim: cauThoai
            }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: `Nói CHÍNH XÁC từng từ của câu sau, không thêm bớt: "${cauThoai}"` }
    });
}
function sdb_doc_mdb_chua_du(function_event, send_message) {
    const cauThoai = "Dạ, em đang nghe ạ, mời Quý khách tiếp tục hoặc đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch giúp em ạ!";
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                status: "chưa ghi nhận đủ số mã danh bộ",
                say_verbatim: cauThoai
            }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }

    });
}
function sdb_doc_mdb_sai(function_event, send_message) {
    const cauThoai = "Dạ, em xin lỗi! Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quãng giúp em ạ!";
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                status: "Mã danh bộ trước đó bị sai",
                next_step: "cần khách hàng cung cấp lại mã danh bộ",
                say_verbatim: cauThoai
            }),
        }
    });
    send_message({
        type: "response.create",
        response: { instructions: `Nói CHÍNH XÁC từng từ của câu sau, không thêm bớt: "${cauThoai}"` }
    });
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
                success: true,
                ma_danh_bo: mdb_gpt,
                status: "Cần khách đọc lại mã danh bộ để xác nhận",
                say_verbatim: `Dạ, Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắn quảng giúp em ạ !`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
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
                success: true,
                status: "chưa nghe rõ số danh bộ",
                ma_danh_bo: mdb_gpt,
                next_step: "Cần khách đọc lại mã danh bộ để xác nhận",
                say_verbatim: `Dạ, Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quảng giúp em một lần nữa nhé!`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
    })

}
function sdb_mdb_chua_dung(function_event, send_message, mdb_gpt) {
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
                success: true,
                ma_danh_bo: mdb_gpt,
                status: "mã danh bộ chưa đúng",
                next_step: "cần khách đọc lại mã danh bộ",
                say_verbatim: `Dạ, em nghe chưa được, Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quảng giúp em một lần nữa nhé!`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
    })

}
function sdb_doc_xacnhan_v0(function_event, send_message, ma_danh_bo) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: false,
                error: "Chưa xác nhận số danh bộ",
                ma_danh_bo: ma_danh_bo,
                note: `mã danh bộ cần khách hàng xác nhận là ${ma_danh_bo}`,
                message: `cần khách hàng xác nhận số danh bộ ${ma_danh_bo} có đúng hay không?"`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Đọc câu chính xác câu để khách hàng xác nhận và không thêm bất cứ lời dẫn dắt nào khác: "Dạ, Mã danh bộ của Quý khách là ${format_danh_bo_voice(ma_danh_bo)}, Quý khách xác nhận giúp em có đúng không ạ!"` }
    })

}
function sdb_doc_xacnhan(function_event, send_message, ma_danh_bo) {
    const loi_thoai = `Dạ, Mã danh bộ của Quý khách là ${format_danh_bo_voice(ma_danh_bo)}, Quý khách xác nhận giúp em có đúng không ạ!`;
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                next_step: "Cần khách hàng xác nhận mã danh bộ",
                ma_danh_bo: ma_danh_bo,
                note: `mã danh bộ cần khách hàng xác nhận là ${ma_danh_bo}`,
                say_verbatim: loi_thoai,
            }),
        }
    });
    send_message({
        type: "response.create",
        response: {
            instructions: `Nói CHÍNH XÁC từng từ của câu sau, không thêm bớt: "${loi_thoai}"`
        }
    });
}
export async function get_so_danh_bo_handler(function_event, asteriskData, send_message, call_from = '') {
    const { call_id, name } = function_event;

    // Parse arguments từ model nếu có
    let args = {};
    try {
        args = JSON.parse(function_event.arguments || "{}");
    } catch (e) {
        args = {};
    }
    let { intent: intent_arg, ma_danh_bo: mdb_arg, xac_nhan: xac_nhan_arg } = args;

    // Quản lý AbortController chống trùng/chồng chéo tool call
    if (asteriskData.gptController) {
        asteriskData.gptController.abort("old_tool");
    }
    asteriskData.gptController = new AbortController();
    asteriskData.currentToolFunction_call_id = call_id;
    asteriskData.currentToolFunction_name = name;
    // log.info("[tools][get_so_danh_bo_handler]: asteriskData = " + `\n\r`);
    // console.log('get_so_danh_bo_handler: asteriskData= ', asteriskData);
    if (asteriskData.ma_danh_bo_phase == 1 && asteriskData.ma_danh_bo_list.length > 0) {
        console.log("do có số danh bộ theo tel hoặc lịch sử gọi nên, bắt đầu giai đoạn xác nhận");
        asteriskData.ma_danh_bo_checking = asteriskData.ma_danh_bo_list[0];
        asteriskData.ma_danh_bo_phase = 2;
        sdb_doc_xacnhan(function_event, send_message, asteriskData.ma_danh_bo_checking)
        return;
    }
    let kq_arbiter = null;
    try {
        kq_arbiter = await get_so_danh_bo(asteriskData);
    } catch (error) {
        if (error.message === "old_tool") {
            log.warn("[tools][get_so_danh_bo_handler] old_tool - cancelled");
            cancel_old_tool(call_id, send_message);
            return;
        }
        log.error("[tools][get_so_danh_bo_handler] error get_so_danh_bo:", error);
    }

    console.log("\n\r[tools][get_so_danh_bo_handler] kq_arbiter:", kq_arbiter);
    console.log("[tools][get_so_danh_bo_handler] function_event:", function_event);

    const { intent: intent_gpt, ma_danh_bo: mdb_gpt, xac_nhan: xac_nhan_gpt, ma_danh_bo_length, do_tin_cay, ly_do } = kq_arbiter || {};

    let xac_nhan = "chưa_xác_nhận";
    if (xac_nhan_gpt === "đúng" || xac_nhan_arg === "đúng") {
        xac_nhan = "đúng";
    } else if (xac_nhan_gpt === "sai" || xac_nhan_arg === "sai") {
        xac_nhan = "sai";
    }
    // Chuẩn hóa kết quả xác nhận và số danh bộ
    const xacNhanNormalized = xac_nhan;//|| (args.xac_nhan === "dung" ? "đúng" : args.xac_nhan === "sai" ? "sai" : null);
    const rawMdb = mdb_gpt || args.ma_danh_bo || "";
    const cleanMdb = String(rawMdb || "").replace(/\D/g, "");
    const valid_mdb = valid_ma_danh_bo(cleanMdb);

    // TRƯỜNG HỢP 1: Đang có mã danh bộ chờ xác nhận (phase 3)
    if (asteriskData.ma_danh_bo_checking) {
        // 1.1. Khách xác nhận ĐÚNG hoặc đọc lại trùng khớp với mã đang kiểm tra
        // if (xacNhanNormalized === "đúng" || (valid_mdb && valid_mdb === asteriskData.ma_danh_bo_checking)) {
        if (xac_nhan == "đúng") {
            asteriskData.ma_danh_bo = valid_mdb;
            asteriskData.ma_danh_bo_confirmed = true;
            asteriskData.ma_danh_bo_phase = 4;
            asteriskData.ma_danh_bo_checking = "";
            asteriskData.ma_danh_bo_count = 0;
            console.log("[tools][get_so_danh_bo_handler] ĐÃ XÁC NHẬN THÀNH CÔNG:", asteriskData.ma_danh_bo);

            // Nếu khách đang có yêu cầu tra cứu hóa đơn tiền nước chờ xử lý (pending_action === 'get_bill')
            // console.log("[tools][get_so_danh_bo_handler]: asteriskData.pending_action =  ", asteriskData.pending_action);
            if (call_from == "get_trang_thai_thanh_toan") {
                console.log("[tools][get_trang_thai_thanh_toan] Tự động tra cứu hóa đơn cho khách...");
                return await get_trang_thai_thanh_toan(function_event, asteriskData, send_message);
            } else if (call_from == "get_outages") {
                console.log("[tools][get_outages] Tự động tra cứu lịch cúp nước cho khách...");
                return await get_outages(function_event, asteriskData, send_message);
            } else if (call_from == "get_compare_usage") {
                console.log("[tools][get_compare_usage] Tự động tra cứu so sánh sản lượng cho khách...");
                return await get_compare_usage(function_event, asteriskData, send_message);
            }


            // Ngược lại, thông báo cho model Realtime biết mã đã được xác nhận để kích hoạt gọi tool tiếp theo (Cách 1)
            let intent_final = intent_gpt || intent_arg;
            if (intent_final && intent_final == 'create_ticket') {
                send_message({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: call_id,
                        output: JSON.stringify({
                            success: true,
                            status: "da_xac_nhan",
                            ma_danh_bo_digits: asteriskData.ma_danh_bo,
                            ma_danh_bo_characters: format_danh_bo_voice(asteriskData.ma_danh_bo),
                            instruction: "Mã danh bộ đã được xác nhận thành công. Bạn hãy hỏi khách hàng mô tả rõ sự cố, phản ánh hoặc khiếu nại cần hỗ trợ là gì. TUYỆT ĐỐI CHƯA gọi tool create_ticket khi khách chưa mô tả nội dung."
                        }),
                    }
                });
                send_message({
                    type: "response.create",
                    response: {
                        instructions: "Thông báo mã danh bộ đã được xác nhận. Hỏi khách hàng đang gặp sự cố gì hoặc muốn khiếu nại nội dung gì để em ghi nhận mở phiếu. Chưa gọi tool create_ticket khi khách chưa nói rõ nội dung."
                    }
                });
                return;
            }
            if (intent_final && intent_final != 'khác') {
                send_message({
                    type: "conversation.item.create",
                    item: {
                        type: "function_call_output",
                        call_id: call_id,
                        output: JSON.stringify({
                            success: true,
                            status: "da_xac_nhan",
                            ma_danh_bo_digits: asteriskData.ma_danh_bo,
                            ma_danh_bo_characters: format_danh_bo_voice(asteriskData.ma_danh_bo),
                            next_action: intent_final,
                        }),
                    }
                });
                send_message({
                    type: "response.create",
                    response: {
                        instructions: `Mã danh bộ ${asteriskData.ma_danh_bo} đã được xác nhận thành công. gọi ngay tool ${intent_final} `
                    }
                });
                return;
            }
            send_message({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: call_id,
                    output: JSON.stringify({
                        success: true,
                        status: "da_xac_nhan",
                        ma_danh_bo: asteriskData.ma_danh_bo,
                        instruction: `Mã danh bộ ${asteriskData.ma_danh_bo} đã được xác nhận thành công. Nếu khách hàng trước đó đã yêu cầu tra cứu (tiền nước, hóa đơn, cúp nước...), hãy GỌI NGAY tool nghiệp vụ tương ứng (ví dụ: 'get_bill' cho tiền nước) mà KHÔNG hỏi lại. Nếu khách chưa yêu cầu dịch vụ cụ thể nào, hãy hỏi khách cần hỗ trợ gì.`
                    }),
                }
            });
            send_message({
                type: "response.create",
                response: {
                    instructions: `Mã danh bộ ${asteriskData.ma_danh_bo} đã được xác nhận thành công. Dựa vào yêu cầu ban đầu của khách hàng trong hội thoại (ví dụ: hỏi tiền nước/hóa đơn), hãy GỌI NGAY tool tương ứng (ví dụ: 'get_bill') với mã danh bộ này. Tuyệt đối không hỏi lại khách.`
                }
            });
            return;
        }

        // 1.2. Khách xác nhận SAI hoặc đọc một mã số khác
        // if (xac_nhan == "sai" || (valid_mdb && valid_mdb !== asteriskData.ma_danh_bo_checking)) {
        if (xac_nhan == "sai") {
            asteriskData.ma_danh_bo_count = (asteriskData.ma_danh_bo_count || 0) + 1;
            if (asteriskData.ma_danh_bo_count >= 3) {
                return chuyen_tong_dai(function_event, send_message, "Xác nhận sai mã danh bộ quá 3 lần");
            }

            if (valid_mdb && valid_mdb !== asteriskData.ma_danh_bo_checking) {
                // Khách đọc luôn mã mới 11 số -> đưa vào checking và xin xác nhận mã mới
                asteriskData.ma_danh_bo_checking = valid_mdb;
                asteriskData.ma_danh_bo_phase = 3;
                return sdb_doc_xacnhan(function_event, send_message, valid_mdb);
            } else {
                // Khách chỉ báo sai -> reset checking và xin khách đọc lại
                asteriskData.ma_danh_bo_checking = "";
                asteriskData.ma_danh_bo_phase = 2;
                return sdb_doc_mdb_sai(function_event, send_message);
            }
        }
    }

    // TRƯỜNG HỢP 2: Đã có mã danh bộ xác nhận từ trước (phase 4) và khách gọi lại get_so_danh_bo
    if (asteriskData.ma_danh_bo_confirmed && asteriskData.ma_danh_bo) {
        if (valid_mdb && valid_mdb !== asteriskData.ma_danh_bo) {
            // Khách muốn đổi sang mã danh bộ mới khác
            asteriskData.ma_danh_bo_checking = valid_mdb;
            asteriskData.ma_danh_bo_phase = 3;
            return sdb_doc_xacnhan(function_event, send_message, valid_mdb);
        } else {
            // Vẫn là mã cũ hoặc đã xác nhận rồi
            const cauThoai = `Dạ, mã danh bộ của Quý khách hiện tại là ${format_danh_bo_voice(asteriskData.ma_danh_bo)}. Quý khách cần em hỗ trợ gì ạ?`;
            send_message({
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: call_id,
                    output: JSON.stringify({
                        success: true,
                        status: "da_xac_nhan",
                        ma_danh_bo: asteriskData.ma_danh_bo,
                        say_verbatim: cauThoai
                    }),
                }
            });
            send_message({
                type: "response.create",
                response: {
                    instructions: `Nói CHÍNH XÁC từng từ của câu sau, không thêm bớt: "${cauThoai}"`
                }
            });
            return;
        }
    }

    // TRƯỜNG HỢP 3: Chưa có mã danh bộ hoặc đang thu thập mã (phase 1, 2)
    if (!valid_mdb) {
        // Chưa có số nào trong hội thoại
        if (!cleanMdb && (!ma_danh_bo_length || ma_danh_bo_length === 0)) {
            asteriskData.ma_danh_bo_phase = 1;
            return sdb_doc_mdb_chua_co(function_event, send_message);
        }

        // Khách có đọc số nhưng chưa đủ 11 chữ số
        asteriskData.ma_danh_bo_count = (asteriskData.ma_danh_bo_count || 0) + 1;
        if (asteriskData.ma_danh_bo_count >= 3) {
            return chuyen_tong_dai(function_event, send_message, "Khách đọc không đủ 11 số quá 3 lần");
        }
        asteriskData.ma_danh_bo_phase = 2;
        return sdb_doc_mdb_chua_du(function_event, send_message);
    }

    // TRƯỜNG HỢP 4: Đã bắt được mã 11 số hợp lệ lần đầu -> Đọc lại xin xác nhận (phase 3)
    asteriskData.ma_danh_bo_checking = valid_mdb;
    asteriskData.ma_danh_bo_phase = 3;
    return sdb_doc_xacnhan(function_event, send_message, valid_mdb);
}
function cancel_old_tool(call_id, send_message) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({ status: "cancelled", reason: "superseded_by_newer_call" })
        }
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
