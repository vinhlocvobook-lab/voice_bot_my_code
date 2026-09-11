import "dotenv/config";
import { log, log_sequenceDiagram } from "./logger.js";
const ARBITER_MODEL = process.env.DANH_BO_ARBITER_MODEL || "gpt-5.1";

const ARBITER_TIMEOUT_MS = Number(process.env.DANH_BO_ARBITER_TIMEOUT_MS || 20000);
const ARBITER_REASONING_EFFORT = process.env.DANH_BO_ARBITER_REASONING_EFFORT || "low";
const VERDICT_SCHEMA = {
    type: "json_schema",
    json_schema: {
        name: "danh_bo_verdict",
        strict: true,
        schema: {
            type: "object",
            properties: {
                intent: {
                    type: "string",
                    enum: ["compare_usage", "get_bill", "get_outages", "create_ticket", "khác"],
                    description: "Mục đích ban đầu của cuộc gọi: 'compare_usage' nếu khách hàng yêu cầu so sánh sản lượng nước, 'get_bill' nếu khách hàng yêu cầu tra cứu tiền nước / hóa đơn / sản lượng, 'get_outages' nếu khách hàng yêu cầu tra cứu tình hình cúp nước, 'create_ticket' nếu khách hàng yêu cầu tạo ticket, 'khác' nếu khách hàng yêu cầu dịch vụ khác.",
                },
                ma_danh_bo: {
                    type: ["string", "null"],
                    description: "Chuỗi ĐÚNG 11 chữ số suy ra được, hoặc null nếu không đủ tin cậy để ghép.",
                },
                ma_danh_bo_length: {
                    type: ["number"],
                    description: "Tổng số chữ số khách hàng cung cấp, nếu chưa cung cấp thì trả về là 0"
                },
                xac_nhan: {
                    type: "string",
                    description: `Xác nhận số danh bộ, trả về 
                    - 'đúng' nếu khách hàng đã xác nhận đúng mã danh bộ, 
                    - 'sai' nếu khách hàng xác nhận là sai hoặc  
                    - 'chưa_xác_nhận' nếu mã danh bộ chưa được xác nhận.`,
                    enum: ['đúng', 'sai', 'chưa_xác_nhận']
                },
                do_tin_cay: {
                    type: "number",
                    description: "Độ tin cậy từ 0.0 đến 1.0 rằng ma_danh_bo là đúng.",
                },
                ly_do: {
                    type: "string",
                    description: "Giải thích ngắn gọn cách ghép/suy luận.",
                },
            },
            required: ["intent", "ma_danh_bo", "xac_nhan", "ma_danh_bo_length", "do_tin_cay", "ly_do"],
            additionalProperties: false,
        },
    },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function get_so_danh_bo(asteriskData) {
    const ctrl = asteriskData.gptController;

    for (let i = 0; i < 5; i++) {
        if (ctrl?.signal?.aborted) {
            throw new Error("old_tool");

        }
        if (!asteriskData.input_transcript_is_completed) {
            await sleep(500);
            if (ctrl?.signal?.aborted) {
                throw new Error("old_tool");

            }
            continue;
        } else {
            break;
        }
    }
    if (ctrl?.signal?.aborted) {
        throw new Error("old_tool");

    }
    if (!asteriskData.input_transcript_is_completed) {
        log.warn("[get_so_danh_bo]: input_transcript_is_completed is false");
        return null;
    }
    let conversation = asteriskData.conversation;
    const prompt = `Hãy dựa vào toàn bộ cuộc hội thoại sau đây để lấy thông tin mã danh bộ khách hàng cung cấp

${conversation}

Trả về DUY NHẤT JSON:
{"intent": "intent",
 "ma_danh_bo": "chuỗi 11 chữ số hoặc null nếu không suy ra được",
 "ma_danh_bo_length":"Tổng số chữ số khách hàng cung cấp, nếu chưa cung cấp thì trả về là 0",
 "xac_nhan": 'đúng' nếu mã danh bộ đã được xác nhận, ngược lại trả về 'sai' hoặc 'chưa_xác_nhận'.",
  "do_tin_cay": 0.0-1.0, 
  "ly_do": "giải thích ngắn cách ghép"}`;


    console.log("=================ArbitrateDanhbo=================");
    console.log("[arbitrateDanhBo]:prompt = ", prompt);
    console.log("=================================================");
    // const ctrl =  new AbortController();

    const timer = setTimeout(() => ctrl.abort("timeout"), ARBITER_TIMEOUT_MS);
    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            signal: ctrl.signal,
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: ARBITER_MODEL,
                messages: [{ role: "user", content: prompt }],
                response_format: VERDICT_SCHEMA,
                reasoning_effort: ARBITER_REASONING_EFFORT,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            log.warn(`[Arbiter] API lỗi ${res.status}: ${err.slice(0, 300)}`);
            return null;
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        // log.debug(`[Arbiter] raw content: ${content}`);
        if (!content) return null;
        const out = JSON.parse(content);
        // log.info(
        //     `[Arbiter] model=${ARBITER_MODEL} → ma_danh_bo=${out.ma_danh_bo} ` +
        //     `| xac_nhan=${out.xac_nhan} | do_tin_cay=${out.do_tin_cay} | tokens=${data.usage?.total_tokens ?? "?"} | ly_do=${out.ly_do}`
        // );
        return { ...out, _usage: data.usage ?? null };
    } catch (err) {
        const reason = ctrl?.signal?.reason;

        console.log(
            `ℹ️ Arbiter bị hủy. Lý do: ${reason}`
        );

        log.warn(`[Arbiter] Lỗi: ${err.name === "AbortError" ? `timeout ${ARBITER_TIMEOUT_MS}ms` : err.message}`);
        if (reason === "old_tool") {
            throw new Error(`old_tool`)
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}