# Review: Ghi log cuộc gọi vào DB — voice_bot_my_code so với voice_bot (gốc)

Ngày review: 2026-09-12. Phạm vi: `db/schema.sql`, `src/db.js`, `src/log-api.js`, `src/conversation-logger.js`, `src/session-ws.js` (project `voice_bot` — bản gốc/tham khảo) đối chiếu với `src/integrations/calllog-api.js`, `src/call-handle.js`, `src/ws.js`, `src/logger.js`, `server.js` (project `voice_bot_my_code` — bản đang phát triển).

## 1. Kết luận quan trọng nhất

**`voice_bot_my_code` hiện KHÔNG ghi bất kỳ dòng nào vào DB (bảng `voicebot_calllog`, `voicebot_toolcall`, `ticket`).** File `src/integrations/calllog-api.js` đã port đầy đủ và đúng 4 hàm từ `log-api.js` gốc (`insertCallStub`, `finalizeCallLog`, `insertTicket`, `getDanhBoHistory`, `closeDb`), nhưng trong toàn bộ project chỉ có `getDanhBoHistory` và `closeDb` (no-op) được import và gọi. `insertCallStub`, `finalizeCallLog`, `insertTicket` được export nhưng **không có nơi nào import/gọi chúng** — đã kiểm tra bằng grep toàn bộ `*.js`/`*.mjs` ngoài `node_modules`.

Hệ quả thực tế:
- Không có dòng "mầm" nào được tạo trong `voicebot_calllog` khi cuộc gọi bắt đầu → không thể tra cứu SĐT, thời điểm gọi, uniqueid/recordpath ghi âm từ DB.
- Không có upsert đầy đủ khi cuộc gọi kết thúc → không có transcript, cost, tool_call_count, outcome, đánh giá AI... trong DB.
- Bảng `voicebot_toolcall` (chi tiết từng lần gọi tool: args, output, thời gian) rỗng hoàn toàn.
- Bảng `ticket` (bản lưu nội bộ phiếu báo sự cố, dùng để đối soát khi remote `bao-su-co` không tin cậy) cũng rỗng — `create_ticket_handler` gọi thẳng `baoSuCo()` (remote) nhưng không gọi `insertTicket()` để lưu bản nội bộ, nên nếu remote báo sai/không phản hồi, không có cách nào đối chiếu lại.
- Dashboard/báo cáo dựa trên các view `v_call_overview`, `v_current_price` (nếu có ở phía API) sẽ luôn trống với dữ liệu từ bot này.

Log hiện tại của `voice_bot_my_code` chỉ là **text log phẳng** ghi ra đĩa máy chủ (`logs/*.txt`, `logs/conversations/yyyy/m/d/*.mermaid`, `logs/sequenceDiagram/...`) — không có JSON log có cấu trúc như `conversation_summary/yyyy/mm/dd/{tel}_{callId}.json` bên bản gốc, nên **không có nguồn nào để sau này backfill vào DB** nếu muốn.

## 2. Kiến trúc ghi log — bản gốc `voice_bot` hoạt động thế nào

Ba lớp phối hợp với nhau:

1. **`ConversationLogger` (`conversation-logger.js`)** — 1 instance/cuộc gọi, tạo lúc `handleIncomingCall` bắt đầu. Gom transcript (`addCustomerTurn`, `flushAI`), tool call (`addToolCall` — ghi args/output/durationMs/apiCalls), token usage (`addUsage`, `addTranscriptionUsage`), sự kiện kỹ thuật (`addEvent`), lỗi (`addError`). Khi cuộc gọi kết thúc, `save()`:
   - Tính cost 3 thành phần (realtime, transcription, summary) qua `pricing.js`.
   - Gọi OpenAI Chat API tóm tắt cuộc gọi (`_generateSummary`, dùng `gpt-4o-mini`).
   - Ghi file JSON đầy đủ ra `conversation_summary/yyyy/mm/dd/{tel}_{callId}.json`.
   - Gọi `finalizeCallLog(document, filePath, relativeLogPath)` — đây là điểm nối duy nhất từ logger sang DB/API.

2. **`db.js` / `log-api.js`** — cùng chữ ký hàm, khác cơ chế ghi (MariaDB trực tiếp vs REST qua `voicebot-log-api.php`). `voice_bot_my_code` đã chọn đúng theo bản REST (`log-api.js`, KHÔNG phải `db.js`) — điều này khớp với chú thích đầu file `calllog-api.js` ("db.js KHONG con duoc port nua"), tức là quyết định kiến trúc này đã đúng, chỉ là **chưa gọi**.
   - `insertCallStub(p)`: gọi lúc **mở cuộc gọi**, fire-and-forget (không `await`), tạo dòng mầm với `callId, customerTel, uniqueid, recordPath, voiceModel, startTime`.
   - `finalizeCallLog(document, jsonFilePath, relativeLogPath)`: gọi lúc **kết thúc cuộc gọi** (trong `logger.save()`), gửi nguyên `document` (object JSON đầy đủ) lên `voicebot-log-api.php` — server tự lo dedupe `prompt_logs`, tra `llm_price`, ghi từng dòng `voicebot_toolcall`.
   - `insertTicket(p)`: gọi mỗi khi tool `create_ticket` (hoặc `leave_callback_message`) chạy xong, **dù remote thành công hay thất bại** — mục đích chính là bản lưu đối soát nội bộ.

3. **`session-ws.js`** — nơi thực sự "wire" 3 điểm gọi trên vào vòng đời cuộc gọi:
   - Dòng ~77-84: tạo `new ConversationLogger(...)` và gọi `insertCallStub({...})` ngay sau khi accept call.
   - Dòng ~1039: gọi `await logger.save()` khi cuộc gọi kết thúc (WS đóng).
   - Dòng ~1311: gọi `insertTicket({...})` sau khi tool tạo ticket/để lại lời nhắn chạy xong.

## 3. Schema DB (`db/schema.sql`) — 4 bảng cần nhớ

- **`llm_price`**: giá model theo phiên bản (versioned), seed sẵn giá `gpt-realtime-2.1-mini` (project đang dùng) **chưa có trong seed** — chỉ thấy `gpt-realtime-mini`, `gpt-realtime-2`, `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, `whisper-1`, `gpt-4o-mini` (summary). Cần thêm dòng giá cho `gpt-realtime-2.1-mini` và `gpt-4o-transcribe` (model transcription mà `voice_bot_my_code` đang dùng trong `call-handle.js`) nếu muốn `finalizeCallLog` tra được `price_realtime_id`/`price_transcript_id` đúng — nếu không tra được, cột vẫn `NULL` (không lỗi, nhưng mất truy vết giá).
- **`prompt_logs`**: versioned theo hash SHA-256 nội dung `instructions`. `voice_bot_my_code` build `instructions` động (chèn ngày/tháng/năm hiện tại vào đầu prompt mỗi cuộc gọi) → **mỗi ngày sẽ sinh 1 hash mới** dù nội dung logic không đổi, vì chuỗi ngày tháng nằm ngay đầu prompt. Không sai, nhưng nếu muốn dùng `prompt_logs` để so sánh phiên bản prompt về sau, nên tách phần "Context & Realtime Date" ra khỏi phần hash (ví dụ hash chỉ phần instructions cố định, ngày tháng gửi riêng) — đây là điểm khác biệt so với bản gốc nên lưu ý nếu áp dụng y nguyên `upsertPromptLog`.
- **`voicebot_calllog`**: 1 dòng/cuộc gọi, khóa unique `voicebot_callid`. Ghi 2 pha (INSERT lúc mở, UPSERT đầy đủ lúc đóng) để dù cuộc gọi rớt giữa chừng (crash, mất mạng) vẫn có ít nhất dòng mầm.
- **`ticket`**: FK mềm về `voicebot_calllog` qua subquery theo `voicebot_callid` — nên **thứ tự gọi quan trọng**: `insertCallStub` phải chạy trước thì `insertTicket` mới join được `voicebot_calllog_id` (nếu gọi `insertTicket` mà chưa có dòng stub, `voicebot_calllog_id` sẽ là `NULL`, ticket vẫn được ghi nhưng mất liên kết).

## 4. So sánh nhanh 2 project

| | voice_bot (gốc) | voice_bot_my_code (đang phát triển) |
|---|---|---|
| Client ghi log DB | `log-api.js` (REST) | `integrations/calllog-api.js` (REST, port gần như y nguyên) |
| `insertCallStub` gọi ở đâu | `session-ws.js` lúc mở call | **Không gọi ở đâu cả** |
| `finalizeCallLog` gọi ở đâu | `conversation-logger.js#save()` | **Không tồn tại hàm/luồng tương đương, không gọi** |
| `insertTicket` gọi ở đâu | `session-ws.js` sau khi tạo ticket | **Không gọi** (`create_ticket_handler.js` chỉ gọi remote `baoSuCo`, bỏ qua bản nội bộ) |
| Transcript có cấu trúc (JSON) | Có (`conversation_summary/.../*.json`) | Không — chỉ text log (`.mermaid`, `.txt`) |
| Theo dõi token usage / cost | Có (`pricing.js`, `addUsage`) | Không có |
| Tóm tắt AI cuối cuộc gọi | Có (`_generateSummary`, gpt-4o-mini) | Không có |
| Theo dõi từng tool call (args/output/duration) | Có (`ConversationLogger.addToolCall`, ghi vào `voicebot_toolcall`) | Không — `asteriskData.functioncall` chỉ push raw event, chỉ `console.dir` lúc đóng WS, không lưu bền |

## 5. Đề xuất nâng cấp — theo thứ tự ưu tiên

### Việc cần làm ngay (ít công sức, giá trị cao)

1. **Wire `insertCallStub`** trong `src/call-handle.js#handleIncomingCall`, ngay sau khi `acceptCall()` thành công (trước hoặc song song `get_so_danh_bo`). Dữ liệu đã có sẵn trong `asteriskData`:
   ```js
   import { insertCallStub } from "./integrations/calllog-api.js";
   // ...
   insertCallStub({
     callId,
     customerTel: asteriskData.phoneNumber,
     uniqueid: asteriskData.uniqueid,
     recordPath: asteriskData.recordPath,
     voiceModel: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini",
   }); // fire-and-forget, KHÔNG await — giống bản gốc
   ```
   Việc này không cần refactor gì khác, chỉ cần 5 dòng code, và ngay lập tức có dữ liệu cuộc gọi (SĐT, giờ gọi, model, recordPath) hiện trong DB để tra cứu/đối soát ghi âm.

2. **Wire `insertTicket`** trong `src/tool_handler/create_ticket.js`, ngay sau khi có kết quả `r` từ `baoSuCo(...)` (cả nhánh thành công lẫn thất bại — đây chính là mục đích của bảng `ticket`, đối soát khi remote không đáng tin):
   ```js
   import { insertTicket } from "../integrations/calllog-api.js";
   // sau khi có r = await baoSuCo(...)
   insertTicket({
     callId: call_id, // lưu ý: đây là call_id của FUNCTION CALL (OpenAI), cần map đúng
     customerTel: asteriskData.caller_phone, // hoặc asteriskData.phoneNumber, kiểm tra tên field cho khớp
     args: { ma_danh_bo, loai, mo_ta },
     output: r,
   });
   ```
   Lưu ý quan trọng: `callId` mà `insertTicket` cần là **call ID của cuộc gọi** (`realtime call_id`, khớp `voicebot_callid`), không phải `call_id` trong `function_event` (đó là ID của function call, khác định danh). Cần lấy `asteriskData.callId` (đã có sẵn, gán trong `handleIncomingCall`) chứ không phải biến `call_id` destructure từ `function_event`.

3. **Kiểm tra biến môi trường thật** (không phải bản `.env` local đang trống): `LOG_API_BASE`, `LOG_API_KEY`, `LOG_API_INSECURE_TLS`, `VOICEBOT_LOG_FOLDER_ON_API_SERVER` — nếu các biến này chưa cấu hình trên server production, dù có wire code đúng thì `isLogApiEnabled()` vẫn `false` và mọi lệnh ghi log bị bỏ qua âm thầm (đúng theo nguyên tắc "lỗi ghi log không làm sập cuộc gọi", nhưng cần xác nhận đã bật đúng ý).

### Việc nên làm tiếp theo (công sức trung bình, để có `finalizeCallLog` đầy đủ)

4. **Xây một "logger" tối giản cho mỗi cuộc gọi** — không cần port nguyên `ConversationLogger` (có cả phần cost/summary phức tạp), có thể bắt đầu bản rút gọn chỉ đủ để gọi `finalizeCallLog`:
   - Thêm vào `asteriskData` (đã là object sống theo từng cuộc gọi, tương tự `callState` bên gốc): `toolCalls: []`, `transcript: []`, `errors: []`, `startTime: new Date()`.
   - Trong `src/tools.js#tool_function_handler`, bọc quanh việc gọi `handler(...)` để đo `durationMs` và đẩy vào `asteriskData.toolCalls.push({ time, seq, name, args, output, durationMs })` — hiện tại code có `asteriskData.functioncall.push(event)` nhưng chỉ lưu **request** (raw event), không lưu **output** (kết quả) hay `durationMs`. Đây là thay đổi có giá trị nhất vì `voicebot_toolcall` cần cả args lẫn output để debug được vì sao 1 cuộc gọi tra cứu sai.
   - Trong `src/ws.js`, các case `conversation.item.input_audio_transcription.completed` (khách nói) và `conversation.item.done`/`response.audio_transcript.done` (AI nói) đã có text — chỉ cần thêm 1 dòng `asteriskData.transcript.push({ time, speaker, text })` song song với `log_conversation(...)` hiện có (không cần bỏ `log_conversation`, chỉ thêm tích lũy có cấu trúc).
   - Ở sự kiện `ws.on("close", ...)`, dựng `document` tối giản (có thể bỏ qua `token_usage`/`cost_usd`/`summary` ở giai đoạn đầu, để `null`) và gọi `finalizeCallLog(document, null, null)`:
     ```js
     const document = {
       meta: {
         callId, tel: asteriskData.phoneNumber,
         startTime: asteriskData.startTime, endTime: new Date(),
         durationSec: Math.round((Date.now() - asteriskData.startTime) / 1000),
         outcome: asteriskData.outcome || "disconnected", // cần set ở end_call_handler / hangupCall
         model: process.env.OPENAI_REALTIME_MODEL,
         asterisk: { uniqueid: asteriskData.uniqueid, recordPath: asteriskData.recordPath, phoneNumber: asteriskData.phoneNumber },
       },
       stats: {
         totalTurns: asteriskData.transcript.length,
         toolCallCount: asteriskData.toolCalls.length,
         errorCount: (asteriskData.errors || []).length,
       },
       conversation: asteriskData.transcript.map(t => `[${t.speaker}] ${t.text}`),
       transcript: asteriskData.transcript,
       toolCalls: asteriskData.toolCalls,
       errors: asteriskData.errors || [],
     };
     finalizeCallLog(document);
     ```
   - Server (`voicebot-log-api.php`) đọc `document.meta`, `document.stats`, `document.toolCalls`... nên miễn là các field đúng tên/đúng path, không cần đủ 100% các field như bản gốc (cost, summary có thể để trống — cột tương ứng trong `voicebot_calllog` sẽ là `NULL`).

5. **Set `outcome` đúng lúc kết thúc cuộc gọi** — hiện `end_call_handler`, `hangupCall`, `referCall` không set `asteriskData.outcome`. Nên set `"completed"` trong `end_call_handler`, `"transferred"` trong `transfer_to_agent_handler` (nhánh chuyển máy thành công), giữ mặc định `"disconnected"` nếu WS đóng mà không qua các nhánh trên — khớp đúng ENUM của cột `outcome`.

### Việc có thể làm sau (nâng cao, không cấp thiết)

6. Port `pricing.js` + `addUsage`/token usage nếu muốn theo dõi chi phí — cần bắt `event.response.usage` trong case `response.done` (hiện case này chỉ log, chưa đọc `usage`).
7. Thêm bước tóm tắt AI cuối cuộc gọi (`_generateSummary`) nếu muốn cột `danh_gia_cuoc_goi` có dữ liệu để chấm chất lượng.
8. Thêm seed giá cho `gpt-realtime-2.1-mini` và `gpt-4o-transcribe` vào `llm_price` (mục 3 ở trên) — việc DB/API, không phải việc sửa code Node.

## 6. Rủi ro cần lưu ý khi wire

- Giữ đúng nguyên tắc xuyên suốt của cả 2 project: **lỗi ghi log/DB không được làm sập cuộc gọi**. Các hàm trong `calllog-api.js` đã tự nuốt lỗi (không throw), nên gọi `insertCallStub`/`insertTicket` **không cần try/catch thêm**, và **không cần `await`** (fire-and-forget) — làm đúng như bản gốc.
- `finalizeCallLog` NÊN `await` (như bản gốc `await finalizeCallLog(...)` trong `logger.save()`), vì thường gọi ngay trước khi tiến trình có thể bị dọn dẹp (WS đóng, request kết thúc) — nhưng do bản thân `finalizeCallLog` cũng tự nuốt lỗi nên `await` chỉ để đảm bảo request kịp gửi đi, không phải để bắt lỗi.
- Nhớ đúng thứ tự: `insertCallStub` phải chạy trước `insertTicket`/`finalizeCallLog` của cùng 1 `callId` để các dòng `ticket`/`voicebot_toolcall` join được vào đúng `voicebot_calllog_id` (xem mục 3, bảng `ticket`).
