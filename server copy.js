import "dotenv/config";
import express from "express";
import WebSocket from "ws";
import { verifyWebhookSignature } from "./src/webhook-verify.js";
import {
    getTrangThaiTT,
    getSoSanhTangGiam,
    getThongBaoCupNuoc,
    baoSuCo,
    getAvailableAgents,
} from "./src/integrations/tongdai-api.js";

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || "/webhook";
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini";
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
const TRANSCRIBE_LANGUAGE = "vi";
const TRANSCRIBE_PROMPT =
    "Cuộc gọi tổng đài chăm sóc khách hàng công ty cấp nước tại TP.HCM, toàn bộ bằng tiếng Việt.";

if (!API_KEY) {
    console.error("[server] Thieu OPENAI_API_KEY trong .env - copy tu .env.example roi dien key that.");
    process.exit(1);
}
const GREETING_TEXT =
    "Alo! Alo! Xin chào Quý Khách, Cảm ơn Quý Khách đã gọi đến Tổng đài Công ty Cổ phần Cấp nước Trung An. " +
    "Em là Trợ lý Ảo Ây Ai, Quý khách cần em hỗ trợ gì ạ?";
const MUTE_RECOVERY_INSTRUCTIONS =
    "Xin lỗi Quý Khách thật ngắn gọn vì vừa im lặng hơi lâu, sau đó hỏi lại xem Quý Khách cần hỗ trợ gì hoặc " +
    "nhắc lại điều Quý Khách vừa nói, giọng điệu nhân viên chăm sóc khách hàng tự nhiên, không giải thích lý do kỹ thuật.";

const STUB_INSTRUCTIONS = `# Vai trò và giọng điệu
Bạn là "em" - trợ lý ảo tổng đài Công ty Cổ phần Cấp nước Trung An (CNTA). Gọi khách hàng là "Quý Khách", giọng lịch sự, tự nhiên như tổng đài viên CSKH thật, câu ngắn gọn.

[STUB TẠM THỜI - Giai đoạn 8, CHƯA phải system prompt đầy đủ của Giai đoạn 5 - hiện CHƯA thể tra hóa đơn/thủ tục/chuyển máy]

# Mã danh bộ (11 chữ số)
Khi khách đọc một chuỗi số cho mã danh bộ, làm theo đúng quy trình:
1. Chuẩn hoá những gì nghe RÕ thành 1 chuỗi 11 chữ số liên tục. Không đoán phần nghe không rõ.
2. Tự đọc lại TỪNG CHỮ SỐ một cho khách nghe (có ngăn cách rõ giữa các số), rồi hỏi khách xác nhận đúng/sai.
3. Chỉ sau khi khách xác nhận ĐÚNG, gọi tool confirm_danh_bo với value là đúng chuỗi vừa đọc lại.
4. Nếu khách nói sai hoặc muốn sửa: hỏi lại số đúng, đọc lại TOÀN BỘ số đã sửa, xin xác nhận lại từ đầu trước khi gọi tool.
Không bao giờ gọi confirm_danh_bo với giá trị đoán, chưa đọc lại, hoặc chưa được khách xác nhận rõ ràng.

# Âm thanh không cần trả lời
Nếu âm thanh vừa nghe không hướng tới bạn (im lặng, tạp âm, tiếng thở, echo, nhạc chờ) - gọi tool wait_for_user, không nói gì thêm.

# Kết thúc cuộc gọi
Khi khách chào tạm biệt hoặc hết nhu cầu, nói lời tạm biệt rồi gọi tool end_call.`;

// [giu nguyen tu voice_bot/src/system-prompt.js ban cu, khong doi noi dung]
const END_CALL_TOOL = {
    type: "function",
    name: "end_call",
    description: "Kết thúc cuộc gọi. GỌI NGAY khi khách chào tạm biệt hoặc hết nhu cầu, sau khi đã nói lời chào tạm biệt.",
    parameters: {
        type: "object",
        properties: { ly_do: { type: "string", description: "Lý do kết thúc" } },
    },
};

// [giu nguyen tu voice_bot/src/system-prompt.js ban cu, khong doi noi dung]
const WAIT_FOR_USER_TOOL = {
    type: "function",
    name: "wait_for_user",
    description:
        "Gọi tool này khi âm thanh vừa nghe KHÔNG cần Trợ lý trả lời bằng lời — ví dụ: " +
        "khách đang đọc dở mã danh bộ, im lặng, tạp âm nền, tiếng thở, tiếng echo, nhạc chờ, " +
        "hoặc lời nói không hướng tới Trợ lý. KHÔNG dùng khi khách rõ ràng đang nói với Trợ lý " +
        "nhưng nội dung nghe không rõ — trường hợp đó hỏi lại thay vì gọi tool này. " +
        "Sau khi gọi, KHÔNG nói gì thêm, chờ khách nói tiếp.",
    parameters: { type: "object", properties: {}, required: [] },
};

const CONFIRM_DANH_BO_TOOL = {
    type: "function",
    name: "confirm_danh_bo",
    description:
        "Gọi tool này CHỈ NGAY SAU KHI khách đã xác nhận bằng lời (ví dụ nói " +
        "'đúng', 'đúng rồi', 'phải') cho ĐÚNG mã danh bộ em vừa đọc lại từng " +
        "chữ số xin xác nhận. Không gọi tool này để tra cứu dữ liệu - tool tra " +
        "cứu hóa đơn là tool khác, riêng biệt. Không tự gọi tool này khi khách " +
        "chưa xác nhận, khi khách nói một mã danh bộ khác hoặc muốn sửa lại, " +
        "hoặc chỉ vì muốn kiểm tra/chắc ăn thêm.",
    parameters: {
        type: "object",
        properties: {
            value: {
                type: "string",
                description:
                    "Đúng 11 chữ số của mã danh bộ, đúng y hệt chuỗi em vừa đọc lại " +
                    "cho khách nghe (chỉ gồm chữ số, không dấu cách/gạch ngang). " +
                    "Ví dụ: '22023251775'.",
            },
        },
        required: ["value"],
    },
};
const STUB_TOOLS = [CONFIRM_DANH_BO_TOOL, WAIT_FOR_USER_TOOL, END_CALL_TOOL];
function extractAsteriskHeaders(payload) {
    try {
        const headers = payload?.data?.sip_headers || [];
        const headerMap = headers.reduce((acc, current) => {
            acc[current.name] = current.value;
            return acc;
        }, {});
        let phoneNumber = null;
        if (headerMap['From']) {
            const match = headerMap['From'].match(/sip:([^@]+)@/);
            phoneNumber = match ? match[1] : null;
        }
        const kq = {
            uniqueid: headerMap['Uniqueid'] || headerMap['X-Uniqueid'] || null,
            recordPath: headerMap['RecordPath'] || headerMap['X-RecordPath'] || null,
            phoneNumber: '0967777638',// tel for test
            phoneNumber_real: phoneNumber // <-- Đã bổ sung số điện thoại
        };
        return kq;
    } catch (error) {
        return { uniqueid: null, recordPath: null, phoneNumber: null };
    }
}
const app = express();
app.use(
    express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }),
);
app.post(WEBHOOK_PATH, (req, res) => {
    if (!verifyWebhookSignature(req.rawBody, req.headers)) {
        console.warn("[server] Webhook: chu ky khong hop le - tu choi request.");
        return res.status(400).json({ error: "Invalid signature" });
    }
    const event = req.body;
    if (event.type !== "realtime.call.incoming") {
        return res.status(200).end(); // Ack cac event khac, khong xu ly.
    }
    res.sendStatus(200);
    const asteriskData = extractAsteriskHeaders(event);
    const callId = event.data?.call_id;
    const fromHeader = event.data?.sip_headers?.find((h) => h.name === "From")?.value || "unknown";
    if (!callId) {
        console.error("[server] Webhook realtime.call.incoming nhung thieu call_id - bo qua.", JSON.stringify(event));
        return;
    }
    handleIncomingCall(callId, fromHeader, asteriskData).catch((err) => {
        console.error(`[server][${callId}] Loi xu ly cuoc goi: ${err.message}`);
    });
});

app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
async function handleIncomingCall(callId, fromHeader, asteriskData) {
    const { phoneNumber } = asteriskData;
    if (!phoneNumber) {
        console.error(`[server][${callId}] Khong the lay so dien thoai tu header - ket thuc cuoc goi.`);
        await closeCall(callId, "MISSING_PHONE");
        return;
    }

    console.log(`[server][${callId}] Cuoc goi moi tu ${fromHeader} (sdt: ${phoneNumber}, callId: ${callId})`);
    function log(directionOrLevel, payload) {
        const label = directionOrLevel === "out" ? "->" : directionOrLevel === "in" ? "<-" : `[${directionOrLevel}]`;
        const desc = typeof payload === "string" ? payload : (payload && payload.type) || JSON.stringify(payload);
        console.log(`[server][${callId}] ${label} ${desc}`);
    }

};
app.listen(PORT, () => {
    console.log(`[server] Dang chay tai port ${PORT}`);
    console.log(`[server] Webhook endpoint: POST http://0.0.0.0:${PORT}${WEBHOOK_PATH}`);
    console.log(`[server] SIP endpoint: sip:${process.env.OPENAI_PROJECT_ID || "<PROJECT_ID>"}@sip.api.openai.com;transport=tls`);
});
// ── Luoi an toan: khong de loi async sot lai lam sap server giua cuoc goi ──
process.on("unhandledRejection", (reason) => {
    console.error("[server] unhandledRejection:", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
    console.error("[server] uncaughtException:", err?.message || err);
});