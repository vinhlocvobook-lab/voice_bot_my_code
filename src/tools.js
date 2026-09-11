import { log } from "./logger.js";

import { transfer_to_agent_handler, wait_for_user_handler, end_call_handler } from "./tool_handler/tool_call.js"
import { get_bill_handler } from "./tool_handler/bill.js"
import { get_outages_handler } from "./tool_handler/outages.js"
import { get_so_danh_bo_handler } from "./tool_handler/resolve_mdb.js"
import { create_ticket_handler } from "./tool_handler/create_ticket.js"

import { compare_usage_handler } from "./tool_handler/compare_usage.js"
import { get_procedure_info_for_family_handler, check_missing_docs_handler } from "./tool_handler/procedure_info_for_family.js"
import { get_procedure_info_for_organization_handler } from "./tool_handler/procedure_info_for_organization.js"

const TOOL_HANDLERS = {
    get_so_danh_bo: get_so_danh_bo_handler,
    get_bill: get_bill_handler,
    get_outages: get_outages_handler,
    wait_for_user: wait_for_user_handler,
    transfer_to_agent: transfer_to_agent_handler,
    create_ticket: create_ticket_handler,
    end_call: end_call_handler,
    compare_usage: compare_usage_handler,
    get_procedure_info_for_family: get_procedure_info_for_family_handler,
    get_procedure_info_for_organization: get_procedure_info_for_organization_handler,
    check_missing_docs: check_missing_docs_handler,
};
export async function tool_function_handler(function_event, asteriskData, send_message) {
    const handler = TOOL_HANDLERS[function_event.name];
    if (handler) {
        return await handler(function_event, asteriskData, send_message);
    }
    log.warn(`[Tool] Chưa có handler cho tool: ${function_event.name}`);
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({ status: "not_implemented", message: `Tính năng ${function_event.name} đang được hoàn thiện.` })
        }
    });
    send_message({ type: "response.create" });


    // else {
    //     log.warn(`[Tool] Chưa có handler cho tool: ${function_event.name}(call_id: ${function_event.call_id})`);
    //     // Phản hồi tạm để OpenAI không bị treo
    //     send_message({
    //         type: "conversation.item.create",
    //         item: {
    //             type: "function_call_output",
    //             call_id: function_event.call_id,
    //             output: JSON.stringify({ status: "not_implemented", message: `Tính năng ${function_event.name} đang được nâng cấp.` })
    //         }
    //     });
    //     send_message({ type: "response.create" });
    // }
}

