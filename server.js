import "dotenv/config";
import express from "express";
import WebSocket from "ws";
import { verifyWebhookSignature } from "./src/webhook-verify.js";
import { handleIncomingCall } from "./src/call-handle.js";
import { log, log_sequenceDiagram } from "./src/logger.js";
// import { getThongTinKhachHang, getAvailableAgents } from "./src/integrations/tongdai-api.js";
// import { closeDb, getDanhBoHistory } from "./src/integrations/calllog-api.js";

const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || "/webhook";


const app = express();
app.use(
    express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }),
);
// async function get_so_danh_bo(tel, callId = '') {
//     let knownDanhBo = [];
//     if (tel && tel !== "Unknown") {
//         try {
//             const timeoutPromise = new Promise((_, reject) =>
//                 setTimeout(() => reject(new Error("timeout")), 3000)
//             );
//             const r = await Promise.race([getThongTinKhachHang(null, tel), timeoutPromise]);
//             console.log('==getThongTinKhachHang===tel: ', tel);
//             console.log('==getThongTinKhachHang===r : ', r);

//             knownDanhBo = (Array.isArray(r?.data) ? r.data : [])
//                 .map((c) => String(c?.danhBa ?? "").replace(/\D/g, ""))
//                 .filter(Boolean);
//             log.info(`[Call][${callId}] Lookup SĐT ${tel}: ${r?.data?.length ?? 0} hợp đồng`);
//         } catch (err) {
//             log.warn?.(`[Call][${callId}] Lookup SĐT thất bại (${err.message}), tiếp tục không có context`);
//         }
//     }

//     console.log("1./: ", { tel, knownDanhBo });
//     if (tel && tel !== "Unknown" && knownDanhBo.length === 0) {
//         try {
//             const timeoutPromise = new Promise((_, reject) =>
//                 setTimeout(() => reject(new Error("timeout")), 2000)
//             );
//             const candidates = await Promise.race([getDanhBoHistory(tel, { limit: 1, days: 180 }), timeoutPromise]);
//             console.log("[getDanhBoHistory]: candidates===: ", candidates);
//             const list = Array.isArray(candidates) ? candidates : [];
//             knownDanhBo = list
//                 .map((c) => String(c?.ma_danh_bo ?? "").replace(/\D/g, ""))
//                 .filter(Boolean);
//             if (knownDanhBo.length) {
//                 log.info(`[Call][${callId}] Lịch sử SĐT ${tel}: ${knownDanhBo.length} mã danh bộ từng xác nhận — đưa vào customerContext.`);
//             }
//         } catch (err) {
//             log?.warn?.(`[Call][${callId}] Tra lịch sử danh bộ theo SĐT thất bại (${err.message}), bỏ qua.`);
//         }
//     }
//     console.log("2./ historyDanhBo===: ", { tel, knownDanhBo });
//     return knownDanhBo;
// }
async function extractAsteriskHeaders(payload, callId = "") {
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
            // phoneNumber: '0967777638',// tel for test
            phoneNumber: process.env.TEST_PHONE_NUMBER || phoneNumber,
            phoneNumber_real: phoneNumber, // <-- Đã bổ sung số điện thoại
            ma_danh_bo: '',
            ma_danh_bo_checking: '',
            ma_danh_bo_count: 0,
            ma_danh_bo_confirmed: false,
            ma_danh_bo_phase: 1,// lần 1 = chưa xác nhận, lần 2 = chờ đọc lại, lần 3 =chờ xác nhận
            ma_danh_bo_list: []
        };
        const now = new Date();
        let formattedTime = now.toLocaleString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false // Định dạng 24 giờ
        });

        formattedTime = formattedTime.replace(":", "_");
        let fileName = `${formattedTime}-${kq.phoneNumber}-${kq.uniqueid}.mermaid`;
        // let knowDanhbo = await get_so_danh_bo(kq.phoneNumber, callId);
        // if (knowDanhbo?.length > 0) {
        //     kq.ma_danh_bo_list = knowDanhbo;
        //     // kq.ma_danh_bo_count = knowDanhbo.length;
        //     // kq.ma_danh_bo_checking = knowDanhbo[0];
        //     // kq.ma_danh_bo_phase = 2;
        // }

        log_sequenceDiagram("sequenceDiagram", fileName);
        log_sequenceDiagram("autonumber", fileName);
        log_sequenceDiagram("participant OpenAI", fileName);
        log_sequenceDiagram("participant Code", fileName);

        // log_sequenceDiagram("participant API", fileName);
        log_sequenceDiagram(`OpenAI->>Code: Incoming call (webhook) [${kq.phoneNumber}]`, fileName);
        return { ...kq, fileName };
    } catch (error) {
        return { uniqueid: null, recordPath: null, phoneNumber: null, fileName: null };
    }
}
app.post(WEBHOOK_PATH, async (req, res) => {
    console.log("1.[server] : WEBHOOK_PATH=", WEBHOOK_PATH);
    if (!verifyWebhookSignature(req.rawBody, req.headers)) {
        console.warn("[server] Webhook: chu ky khong hop le - tu choi request.");
        return res.status(400).json({ error: "Invalid signature" });
    }

    const event = req.body;
    if (event.type !== "realtime.call.incoming") {
        return res.status(200).end(); // Ack cac event khac, khong xu ly.
    }
    res.sendStatus(200);

    const callId = event.data?.call_id;
    const asteriskData = await extractAsteriskHeaders(event);
    asteriskData.callId = callId;

    console.log("1.[server] callId: ", callId);
    const fromHeader = event.data?.sip_headers?.find((h) => h.name === "From")?.value || "unknown";
    if (!callId) {
        console.error("[server] Webhook realtime.call.incoming nhung thieu call_id - bo qua.", JSON.stringify(event));
        return;
    }

    handleIncomingCall(callId, fromHeader, asteriskData);
});

app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

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