import { getTrangThaiTT, getThongBaoCupNuoc, getAvailableAgents } from "../api.js"
import { referCall, hangupCall } from "../call-handle.js"
import { log, log_sequenceDiagram } from "../logger.js";
export async function check_avaliable_agents(function_event, asteriskData, send_message) {
    let availableAgents = null;
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 4500)
        );
        availableAgents = await Promise.race([getAvailableAgents(), timeoutPromise]);
        log.debug(`[tools][transfer_to_agent] availableAgents=`, availableAgents);
    } catch (e) {
        log.warn(`[tools][transfer_to_agent] Không lấy được trạng thái tổng đài viên (${e.message}) — coi như không có ai rảnh.`);
    }
    //  data: { available_agents: 0, queue: 'GroupDay5' }
    let { available_agents, queue } = availableAgents?.data || {};
    // available_agents = 1;
    if (available_agents > 0) {
        log.info(`[tools][transfer_to_agent] Có tổng đài viên rảnh. Chuyển máy cho khách.`);

        return true;

    }
    // tổng đài viên bận thì tạo ticket


    return false;
}
export async function transfer_to_agent_handler(function_event, asteriskData, send_message) {
    let availableAgents = null;
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }

    const { ly_do } = args;

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 4500)
        );
        availableAgents = await Promise.race([getAvailableAgents(), timeoutPromise]);
        log.debug(`[tools][transfer_to_agent] availableAgents=`, availableAgents);
    } catch (e) {
        log.warn(`[tools][transfer_to_agent] Không lấy được trạng thái tổng đài viên (${e.message}) — coi như không có ai rảnh.`);
    }
    //  data: { available_agents: 0, queue: 'GroupDay5' }
    let { available_agents, queue } = availableAgents?.data || {};
    // available_agents = 1;
    if (available_agents > 0) {
        log.info(`[tools][transfer_to_agent] Có tổng đài viên rảnh. Chuyển máy cho khách.`);
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: function_event.call_id,
                output: JSON.stringify({
                    success: true, action: "transfer_to_agent", ly_do: ly_do,
                    say_verbatim_for_user: `Dạ, em đang chuyển máy cho tổng đài viên, Quý Khách giữ máy giúp em ạ.`,
                }),
            }
        });
        send_message({
            type: "response.create",
            response: { instructions: `Nói nguyên văn trường "say_verbatim_for_user" trong kết quả tool vừa nhận được` }
        });

        referCall(asteriskData.callId, process.env.AGENT_SIP_URI || "sip:200@asterisk");
        if (asteriskData?.sessionLogger) {
            asteriskData.sessionLogger.outcome = "transferred"; // 👉 Đánh dấu chuyển máy
        }
        return;

    }
    // tổng đài viên bận thì tạo ticket
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                status: "các tổng đài viên đang bận, không thể tiếp nhận cuộc gọi.",
                action: "create_ticket",
                say_verbatim_for_user:
                    "Dạ, hiện tại các tổng đài viên đều bận. Quý Khách có muốn " +
                    "để lại lời nhắn để nhân viên liên hệ lại không ạ?",
            }),
        }
    });

    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim_for_user" trong kết quả tool vừa nhận được` }
    });
}
export async function end_call_handler(function_event, asteriskData, send_message) {
    let availableAgents = null;
    const { call_id, arguments: function_arg } = function_event;
    let args = {};
    try {
        args = JSON.parse(function_arg || "{}");
    } catch (e) {
        args = {};
    }


    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                status: "call hangup",
                action: "end_call",
                say_verbatim_for_user:
                    "Dạ, em cảm ơn Quý Khách đã liên hệ. Chúc quý khách một ngày tốt lành. Em xin cúp máy ạ.",
            }),
        }
    });

    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim_for_user" trong kết quả tool vừa nhận được` }
    });
    hangupCall(asteriskData.callId);
    if (asteriskData?.sessionLogger) {
        asteriskData.sessionLogger.outcome = "completed"; // 👉 Đánh dấu cuộc gọi hoàn thành trọn vẹn
    }
}
export function wait_for_user_handler(function_event, asteriskData, send_message) {
    let { name, event_id, response_id, item_id, output_index, call_id, arguments: function_arg } = function_event;

    const outputMessage = {
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify({ status: "acknowledged", action: "waiting_for_user" }),
        },
    };
    log.info(`[Tool][wait_for_user] Nhận diện tạp âm/ chờ người dùng(call_id: ${call_id}).Giữ im lặng, không trigger response.`);
    log_sequenceDiagram(`Code-- >> OpenAI: conversation.item.create(function_call_output: wait_for_user)`, asteriskData?.fileName);

    send_message(outputMessage);

}