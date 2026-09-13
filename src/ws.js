import fs from "fs";
import path from "path";
import WebSocket from "ws";
import { audio_prompt } from "./prompt.js";
import { tool_function_handler } from "./tools.js";
import { log, log_sequenceDiagram, log_conversation } from "./logger.js";
import { finalizeCallLog } from "./integrations/calllog-api.js";
const OPENAI_WS_URL = "wss://api.openai.com/v1/realtime";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function send_message(ws, message, callId = "") {
    if (ws.readyState === WebSocket.OPEN) {
        // log_sequenceDiagram(`Note over Code,OpenAI:${JSON.stringify(message)} `,);
        ws.send(JSON.stringify(message));
        log.info(`[WS][${callId}] Message sent: ${JSON.stringify(message)}`);
    } else {
        log.warn(`[WS][${callId}] Khong the gui message vi WebSocket chua OPEN (state=${ws.readyState})`);
    }
}
export function handle_WebSocket_to_OpenAI(callId, asteriskData) {

    let hasGreetingStarted = false; // Đánh dấu bot đã bắt đầu phản hồi/nói
    let userHasSpoken = false;      // Đánh dấu khách đã cất tiếng
    let greetingTimeout = null;
    asteriskData.count_call_Function = 0;
    asteriskData.functioncall = [];
    asteriskData.conversation = "";
    asteriskData.input_transcript_is_completed = false;

    const sessionLogger = {
        callId,
        startTime: new Date(),
        transcript: [],       // [{ time, speaker: "AI"|"KH", text }]
        toolCalls: [],        // [{ time, seq, name, args, output, durationMs, apiCalls }]
        errors: [],
        outcome: "disconnected",
        realtimeUsage: { input_tokens: 0, output_tokens: 0, input_token_details: {}, output_token_details: {} },
        transcriptionUsage: { audio_input_tokens: 0, text_output_tokens: 0, count: 0 },
    };
    asteriskData.sessionLogger = sessionLogger;
    // Hàm kích hoạt câu chào
    function triggerGreeting() {
        if (hasGreetingStarted || userHasSpoken) return;

        log.info(`[WS][${callId}] Triggering initial greeting...`);
        const greetingInstruction = 'Nói CHÍNH XÁC từng từ của câu chào sau đây, không thêm bớt, không diễn giải lại: " Alo! Alo! Xin chào Quý Khách, Cảm ơn Quý Khách đã gọi đến Tổng đài Công ty Cổ phần Cấp nước Trung An. Em là Trợ lý Ảo Ây Ai, Quý khách cần em hỗ trợ gì ạ? Nếu Quý Khách muốn gặp trực tiếp tổng đài viên thì nói em chuyển máy cho tổng đài viên nhé!"';
        log_sequenceDiagram(`Code-->>OpenAI: Triggering initial greeting... response.create`, asteriskData.fileName);
        log_sequenceDiagram(`Note over Code,OpenAI: ${JSON.stringify({ instructions: greetingInstruction })}`, asteriskData.fileName);
        log_conversation(`Code: ${JSON.stringify({ instructions: greetingInstruction })}`, asteriskData.fileName);
        send_message(ws, {
            type: "response.create",
            response: { instructions: greetingInstruction },
        }, callId);
    }
    /**
     * Kiểm tra xem transcript có phải là echo từ audio_prompt hay không
     */
    function isPromptEcho(transcript, audioPrompt) {
        if (!transcript || !audioPrompt) return false;

        // Chuẩn hóa: bỏ dấu chấm câu, chuyển chữ thường, bỏ khoảng trắng thừa
        const clean = (str) =>
            str.toLowerCase()
                .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
                .replace(/\s+/g, " ")
                .trim();

        const t = clean(transcript);
        const p = clean(audioPrompt);

        // 1. Khớp hoàn toàn
        if (t === p) return true;

        // 2. Transcript là một đoạn con dài trích từ Prompt (từ 20 ký tự trở lên)
        if (p.includes(t) && t.length >= 20) return true;

        // 3. Đo lường tỷ lệ trùng từ (Word Overlap / Jaccard similarity)
        const wordsT = t.split(" ");
        const wordsP = new Set(p.split(" "));
        let matchCount = 0;

        for (const w of wordsT) {
            if (wordsP.has(w)) matchCount++;
        }

        // Nếu hơn 70% số từ trong transcript xuất hiện trong prompt (và có ít nhất 4 từ)
        const ratio = matchCount / wordsT.length;
        return ratio >= 0.7 && wordsT.length >= 4;
    }

    const url = `${OPENAI_WS_URL}?call_id=${callId}`;
    console.log("[handle_WebSocket_to_OpenAI]: connecting to Websocket URL =", url, callId);
    log_sequenceDiagram(`Code-->>OpenAI: connect to Websocket`, asteriskData.fileName);
    log_sequenceDiagram(`Note over Code,OpenAI: ${url}`, asteriskData.fileName);
    const ws = new WebSocket(url, {
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1",
        },
    });

    ws.on("unexpected-response", (_req, res) => {
        let body = "";
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => {
            log_sequenceDiagram(`OpenAI->>Code: unexpected-response HTTP`, asteriskData.fileName);
            log_sequenceDiagram(`Note over Code,OpenAI: ${res.statusCode}: ${body}`, asteriskData.fileName);
            log.error(`[WS][${callId}] unexpected-response HTTP ${res.statusCode}: ${body}`);
        });
    });
    ws.on("close", async (code, reason) => {
        log_sequenceDiagram(`OpenAI->>Code: close`, asteriskData.fileName);
        log_sequenceDiagram(`Note over Code,OpenAI: ${code} ${reason?.toString()}`, asteriskData.fileName);
        log.info(`[WS][${callId}]WebSocket đóng: ${code} ${reason?.toString()}`);
        log.info('========================= close========================');
        log.info(asteriskData.fileName);
        log.info("asteriskData.count_call_Function=", asteriskData.count_call_Function);
        console.dir(asteriskData.functioncall, { depth: null });
        log.info('========================= close========================');
        if (greetingTimeout) clearTimeout(greetingTimeout);

        // ✅ LƯU CALL SUMMARY VÀO DATABASE
        const durationSec = Math.round((Date.now() - sessionLogger.startTime.getTime()) / 1000);
        const document = {
            meta: {
                callId,
                tel: asteriskData.phoneNumber_real || asteriskData.phoneNumber,
                startTime: sessionLogger.startTime.toISOString(),
                endTime: new Date().toISOString(),
                durationSec,
                outcome: sessionLogger.outcome,
                model: asteriskData.acceptParams?.model,
                asterisk: {
                    uniqueid: asteriskData.uniqueid,
                    recordPath: asteriskData.recordPath,
                    phoneNumber: asteriskData.phoneNumber,
                },
            },
            stats: {
                totalTurns: sessionLogger.transcript.length,
                toolCallCount: sessionLogger.toolCalls.length,
                errorCount: sessionLogger.errors.length,
                danh_bo_value: asteriskData.ma_danh_bo_confirmed ? asteriskData.ma_danh_bo : null,
            },
            token_usage: {
                realtime: {
                    model: asteriskData.acceptParams?.model,
                    response_count: sessionLogger.realtimeUsage.response_count || 0,
                    input_tokens: sessionLogger.realtimeUsage.input_tokens,
                    output_tokens: sessionLogger.realtimeUsage.output_tokens,
                    input_details: {
                        text_tokens: sessionLogger.realtimeUsage.text_input_tokens,
                        audio_tokens: sessionLogger.realtimeUsage.audio_input_tokens,
                        cached_text_tokens: sessionLogger.realtimeUsage.cached_text_input_tokens,
                        cached_audio_tokens: sessionLogger.realtimeUsage.cached_audio_input_tokens,
                    },
                    output_details: {
                        text_tokens: sessionLogger.realtimeUsage.text_output_tokens,
                        audio_tokens: sessionLogger.realtimeUsage.audio_output_tokens,
                    },
                },
                transcription: {
                    audio_input_tokens: sessionLogger.transcriptionUsage.audio_input_tokens,
                    text_output_tokens: sessionLogger.transcriptionUsage.text_output_tokens,
                }
            },
            cost_usd: {
                total: 0,
                realtime: { cost: 0 },
                transcription: { cost: 0 },
            },
            summary: null,
            transcript: sessionLogger.transcript,
            toolCalls: sessionLogger.toolCalls,
            call_params: {
                accept: asteriskData.acceptParams,
            },
        };

        // 1. Lưu file JSON cục bộ
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
        const relativeLogPath = `${dateStr}/${asteriskData.phoneNumber}_${callId}.json`;
        const localFilePath = path.join("logs", "conversation_summary", relativeLogPath);
        fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
        fs.writeFileSync(localFilePath, JSON.stringify(document, null, 2), "utf-8");

        // 2. Gọi Pha 2 gửi lên API ghi DB
        await finalizeCallLog(document, localFilePath, relativeLogPath);


    });

    ws.on("error", (err) => {
        log_sequenceDiagram(`OpenAI->>Code: error`, asteriskData.fileName);
        log_sequenceDiagram(`Note over Code,OpenAI: ${err.message}`, asteriskData.fileName);
        log.error(`[WS][${callId}] WebSocket lỗi: ${err.message} `);
    });
    ws.on("open", async () => {
        log_sequenceDiagram(`OpenAI->>Code: open`, asteriskData.fileName);
        console.log(`[WebSocket][${callId}]: Socket opened`);
        let session_update_message = {
            type: "session.update",
            session: {
                type: "realtime",
                audio: {
                    input: {
                        "turn_detection": {
                            "type": "semantic_vad",
                            "eagerness": "low",//"auto",
                            "create_response": true,
                            "interrupt_response": true
                        }
                    }
                }
            }
        }
        log_sequenceDiagram(`Code-->>OpenAI: session.update`, asteriskData.fileName);
        log_sequenceDiagram(`Note over Code,OpenAI: ${JSON.stringify(session_update_message)}`, asteriskData.fileName);
        send_message(ws, session_update_message, callId);
        // 2. Bắn câu chào NGAY LẬP TỨC (không chờ sleep 1s)
        triggerGreeting();
        greetingTimeout = setTimeout(() => {
            if (!hasGreetingStarted && !userHasSpoken) {
                log.warn(`[WS][${callId}] Sau 3.5s chưa thấy AI bắt đầu nói, thử trigger greeting lại...`);
                triggerGreeting();
            }
        }, 3500);


    });
    ws.on("message", async (raw) => {
        let event;
        try {
            event = JSON.parse(raw.toString());
        } catch {
            return;
        }

        switch (event.type) {
            case "response.created":
                log_sequenceDiagram(`OpenAI->>Code: response.created`, asteriskData.fileName);
                log.info(" ....response.created....: AI bắt đầu sinh phản hồi, do VAD kích hoạt hoặc do code yêu cầu");
                hasGreetingStarted = true;
                if (greetingTimeout) clearTimeout(greetingTimeout);
                log.info(`[WS][${callId}] AI bắt đầu tạo phản hồi.`);
                break;
            case "response.done": {
                log_sequenceDiagram(`OpenAI->>Code: response.done`, asteriskData.fileName);
                log_sequenceDiagram(`Note over Code,OpenAI: ${JSON.stringify({ status: event?.response?.status })}`, asteriskData.fileName);
                log.info("....response.done....: AI đã nói xong trọn vẹn câu thoại hoặc bị ngắt/hủy");

                console.log("...response.done....:event.response.status = ", { status: event?.response?.status });
                //completed : mô hình sinh xong văn bản, không bị gián đoạn
                //cancelled : Khách ngắt nói hoặc code gởi lệnh huỷ
                //incomplete : bị giới hạn token, bị kiểm duyệt, audio stream bị lỗi


                // ✅ 1. GOM TOKEN USAGE VÀO sessionLogger.realtimeUsage
                const usage = event?.response?.usage;
                if (usage) {
                    const d = usage.input_token_details ?? {};
                    const od = usage.output_token_details ?? {};
                    const cd = d.cached_tokens_details ?? {}; // Chi tiết cached từ Realtime API
                    sessionLogger.realtimeUsage.input_tokens += usage.input_tokens ?? 0;
                    sessionLogger.realtimeUsage.output_tokens += usage.output_tokens ?? 0;
                    sessionLogger.realtimeUsage.text_input_tokens += d.text_tokens ?? 0;
                    sessionLogger.realtimeUsage.audio_input_tokens += d.audio_tokens ?? 0;
                    sessionLogger.realtimeUsage.cached_text_input_tokens += (cd.text_tokens ?? d.cached_text_tokens ?? 0);
                    sessionLogger.realtimeUsage.cached_audio_input_tokens += (cd.audio_tokens ?? d.cached_audio_tokens ?? 0);
                    sessionLogger.realtimeUsage.text_output_tokens += od.text_tokens ?? 0;
                    sessionLogger.realtimeUsage.audio_output_tokens += od.audio_tokens ?? 0;
                    sessionLogger.realtimeUsage.response_count = (sessionLogger.realtimeUsage.response_count || 0) + 1;
                }

                const output = event?.response?.output;
                if (!Array.isArray(output) || output.length === 0) {
                    log.warn(`[WS][${callId}] response.done KHÔNG có output nào (bot không nói gì, không gọi tool) `);
                    break;
                }

                break;
            }

            case "response.function_call_arguments.done":
                asteriskData.count_call_Function++;
                log.info("  ....response.function_call_arguments.done....");
                console.dir(event, { depth: null });
                // const kq_event_function = {
                //     type: 'response.function_call_arguments.done',
                //     event_id: 'event_EHxXPjPbQb9fSnLTL2cIZ',
                //     response_id: 'resp_EHxXON1qFjBOWCl3ed8UE',
                //     item_id: 'item_EHxXPYPEVgFa2vJXes2o7',
                //     output_index: 1,
                //     call_id: 'call_kAKvI6oce6M5DuIa',
                //     name: 'get_bill',
                //     arguments: '{"ma_danh_bo":"12345678910"}'
                // }
                let { name, event_id, response_id, item_id, output_index, call_id, arguments: function_arg } = event;
                log_sequenceDiagram(`OpenAI->>Code: response.function_call_arguments.done : ${name} `, asteriskData.fileName);
                log_sequenceDiagram(`Note over Code,OpenAI: ${JSON.stringify({ name, event_id, response_id, item_id, output_index, call_id, function_arg })}`, asteriskData.fileName);
                log.info(`[WS][${callId}][tool-call-requested]: `, { name, event_id, response_id, item_id, output_index, call_id, function_arg });
                asteriskData.functioncall.push(event);
                tool_function_handler(event, asteriskData, (message) => send_message(ws, message, callId));
                // return {
                //     kind: "tool-call-requested",
                //     responseId: rawEvent.response_id ?? null,
                //     itemId: rawEvent.item_id ?? null,
                //     callId: rawEvent.call_id ?? null,
                //     name: rawEvent.name ?? null,
                //     // Chuoi JSON tho, CHUA parse - xem chu thich dau file.
                //     arguments: rawEvent.arguments ?? "",
                // };
                break;
            case "input_audio_buffer.dtmf_event_received": {
                log.info("....input_audio_buffer.dtmf_event_received....");
                const digit = String(event.event ?? "").trim();
                log.info("DTMF received:", digit);
                log_sequenceDiagram(`OpenAI->>Code: input_audio_buffer.dtmf_event_received ${JSON.stringify({ digit })}`, asteriskData.fileName);
                log_conversation(`KH[NHẤN PHÍM]: ${digit}`, asteriskData.fileName);
                asteriskData.conversation += `Khách nhấn phím: ${digit}\n`;
                break;
            }
            // ── Transcription để log cuộc hội thoại ───────────────────────────────
            case "conversation.item.input_audio_transcription.completed": {
                console.log("\n\r \n\r");
                log.info("....conversation.item.input_audio_transcription.completed....");
                log_sequenceDiagram(`OpenAI->>Code: conversation.item.input_audio_transcription.completed`, asteriskData.fileName);
                log_sequenceDiagram(`Note over Code,OpenAI: ${JSON.stringify({ transcript: event.transcript?.trim() })}`, asteriskData.fileName);
                log.info("[conversation.item.input_audio_transcription.completed]: input_text_customer.transcript=", event.transcript?.trim());
                log_conversation(`Khách: ${event.transcript?.trim()}`, asteriskData.fileName);
                const txt = event.transcript?.trim();




                sessionLogger.transcript.push({ time: new Date().toISOString(), speaker: "KH", text: txt });
                if (event.usage) {
                    sessionLogger.transcriptionUsage.audio_input_tokens += event.usage.input_token_details?.audio_tokens ?? 0;
                    sessionLogger.transcriptionUsage.text_output_tokens += event.usage.output_token_details?.text_tokens ?? 0;
                    sessionLogger.transcriptionUsage.count++;
                }


                // KIỂM TRA ECHO PROMPT
                // const audioPrompt = asteriskData.audio_prompt || "Cuộc gọi tổng đài chăm sóc khách hàng công ty cấp nước tại TP.HCM...";

                if (isPromptEcho(txt, audio_prompt)) {
                    log.warn(`[WS][${callId}] ⚠️ PHÁT HIỆN ECHO PROMPT! Tiến hành hủy response và xóa item rác: "${txt}"`);

                    // 1. Hủy ngay lập tức phản hồi AI đang sinh (nếu có)
                    send_message(ws, { type: "response.cancel" }, callId);
                    // 2. Xóa item này khỏi session Realtime để AI không ghi nhớ
                    if (event.item_id) {
                        send_message(ws, {
                            type: "conversation.item.delete",
                            item_id: event.item_id
                        }, callId);
                    }
                    // 3. Bỏ qua, KHÔNG cộng vào asteriskData.conversation
                    break;
                }

                if (txt) {
                    asteriskData.conversation += `Khách: ${txt}\n`;
                    asteriskData.input_transcript_is_completed = true;
                }
                break;
            }
            case "conversation.item.done": {
                log.info("....conversation.item.done....");
                log_sequenceDiagram(`OpenAI->>Code: conversation.item.done`, asteriskData.fileName);
                log_sequenceDiagram(`Note over Code,OpenAI: ${JSON.stringify({ content: event?.item?.content })}`, asteriskData.fileName);
                const content = event?.item?.content;
                if (Array.isArray(content)) {
                    const aiPart = content.find((c) => c?.type === "output_audio" && c?.transcript);
                    if (aiPart?.transcript?.trim()) {
                        const txt = aiPart.transcript.trim();
                        log.info(`[WS][${callId}][AI nói]: ${txt}`);
                        log_conversation(`AI: ${txt}`, asteriskData.fileName);
                        asteriskData.conversation += `AI: ${aiPart.transcript.trim()}\n`;
                        // ✅ 2. LƯU CÂU THOẠI AI VÀO TRANSCRIPT (Tránh ghi trùng lặp)
                        const lastTurn = sessionLogger.transcript[sessionLogger.transcript.length - 1];
                        if (!(lastTurn && lastTurn.speaker === "AI" && lastTurn.text === txt)) {
                            sessionLogger.transcript.push({
                                time: new Date().toISOString(),
                                speaker: "AI",
                                text: txt
                            });
                        }
                    }
                }
                break;
            }

            case "response.audio_transcript.done": {
                log.info("....response.audio_transcript.done....");
                const aiText = event.transcript?.trim();
                log.info(`[WS][${callId}][AI nói]: ${aiText}`);
                log_sequenceDiagram(`OpenAI->>Code: response.audio_transcript.done`, asteriskData.fileName);
                log_sequenceDiagram(`Note over Code,OpenAI: ${JSON.stringify({ transcript: aiText })}`, asteriskData.fileName);
                break;
            }

            case "input_audio_buffer.speech_started":
                asteriskData.input_transcript_is_completed = false;
                log.info("....input_audio_buffer.speech_started....");
                log_sequenceDiagram(`OpenAI->>Code: input_audio_buffer.speech_started`, asteriskData.fileName);
                userHasSpoken = true;
                if (greetingTimeout) clearTimeout(greetingTimeout);
                log.info(`[WS][${callId}] Khách hàng bắt đầu nói.`);
                break;


            case "input_audio_buffer.speech_stopped":
                log_sequenceDiagram(`OpenAI->>Code: input_audio_buffer.speech_stopped`, asteriskData.fileName);
                log.info("....input_audio_buffer.speech_stopped....");
                break;

            case "input_audio_buffer.committed":
                log_sequenceDiagram(`OpenAI->>Code: input_audio_buffer.committed`, asteriskData.fileName);
                log.info("....input_audio_buffer.committed....");
                break;

            case "conversation.item.input_audio_transcription.failed":
                log_sequenceDiagram(`OpenAI->>Code: conversation.item.input_audio_transcription.failed`, asteriskData.fileName);
                log.info("....conversation.item.input_audio_transcription.failed....");
                break;
            case "error":
                log_sequenceDiagram(`OpenAI->>Code: error`, asteriskData.fileName);
                log_sequenceDiagram(`Note over Code,OpenAI: ${JSON.stringify({ error: event.error })}`, asteriskData.fileName);
                log.info("....error....");
                log.error(`[WS][${callId}]OpenAI error: `, event.error);
                // 👉 Ghi nhận lỗi vào sessionLogger để error_count trong DB phản ánh đúng
                if (asteriskData?.sessionLogger) {
                    asteriskData.sessionLogger.errors.push({
                        time: new Date().toISOString(),
                        where: "openai_error_event",
                        message: JSON.stringify(event.error || {}),
                    });
                }
                break;

            case "session.created":
                log.info("....session.created....");
                log_sequenceDiagram(`OpenAI->>Code: session.created`, asteriskData.fileName);
                log_sequenceDiagram(`Note over Code,OpenAI: ${JSON.stringify({ session: event.session })}`, asteriskData.fileName);
                log.info(`[WS][${callId}]session.created: ${event.session?.id}`);
                break;

            case "session.updated": {
                log.info("....session.updated....");
                log_sequenceDiagram(`OpenAI->>Code: session.updated`, asteriskData.fileName);
                break;
            }

            default:
                // log.info("....default....");
                break;
        }
    });

}
