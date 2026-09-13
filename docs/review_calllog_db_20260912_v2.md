# Review lần 2: kiểm tra bản cập nhật ghi log DB — voice_bot_my_code

Ngày review: 2026-09-12 (sau khi bạn wire `insertCallStub`, `insertTicket`, `finalizeCallLog`). File tham chiếu: `docs/review_calllog_db_20260912.md` (review lần 1).

## 1. Kết luận chung: đã làm ĐÚNG hướng, và làm nhiều hơn cả đề xuất ban đầu

Đã kiểm tra lại toàn bộ (grep + đọc từng file + chạy `node --check` để chắc không lỗi cú pháp). Tin tốt: cả 3 điểm quan trọng nhất trong review lần 1 đều đã được wire đúng:

- `insertCallStub` — gọi trong `call-handle.js` ngay sau `acceptCall()`, fire-and-forget (không `await`, đúng nguyên tắc). Điểm cộng: bạn dùng `asteriskData.phoneNumber_real || asteriskData.phoneNumber` cho `customerTel` — **đúng hơn cả đề xuất ban đầu của mình**, vì `phoneNumber` có thể bị ghi đè bởi `TEST_PHONE_NUMBER` (xem `server.js`), còn `phoneNumber_real` luôn là SĐT thật.
- `insertTicket` — gọi trong `create_ticket.js` sau khi có kết quả `baoSuCo`, dùng đúng `asteriskData.callId` (không nhầm với `call_id` của function call — đây chính là lỗi mình đã cảnh báo trước, bạn đã tránh đúng).
- `finalizeCallLog` — bạn tự dựng hẳn 1 object `sessionLogger` trong `ws.js` để gom transcript, tool call, token usage realtime + transcription, rồi build `document` và gọi `await finalizeCallLog(...)` lúc WebSocket đóng. Đây chính xác là việc "xây logger tối giản" mà mình đề xuất ở mục ưu tiên 2 — bạn còn làm thêm cả phần token usage (mục ưu tiên 3) mà mình xếp là "nâng cao, chưa cấp thiết".
- Bonus ngoài đề xuất: bạn tạo hẳn `api-trace.js` (dùng `AsyncLocalStorage`) để tự động gom các request/response backend API phát sinh trong mỗi tool call — đúng tinh thần cột `api_calls` trong bảng `voicebot_toolcall` bên bản gốc.
- `outcome` được set đúng chỗ: `"completed"` trong `end_call_handler`, `"transferred"` trong `transfer_to_agent_handler` (nhánh có tổng đài viên rảnh) — khớp đúng ENUM của cột `outcome`.

**Không cần sửa gì ở 4 điểm trên.** Phần dưới đây là vài chỗ nhỏ nên tinh chỉnh thêm — không phải lỗi nghiêm trọng, cuộc gọi vẫn chạy bình thường dù bạn có sửa hay không, nhưng sửa sẽ giúp dữ liệu ghi vào DB đầy đủ/chính xác hơn.

## 2. Việc NÊN làm — hướng dẫn từng bước

### 2.1. Một số tool không trả (return) kết quả → cột `output` trong `voicebot_toolcall` sẽ trống

**Vì sao có vấn đề này:** trong `src/tools.js`, hàm `tool_function_handler` lấy `output` của mỗi tool call từ **giá trị mà handler `return`** (dòng `output: result || null`). Bạn đã thêm `return r;` đúng cho `create_ticket_handler`, nhưng các handler sau thì **không có lệnh `return`** ở cuối hàm, nên `output` của chúng sẽ luôn là `null` trong DB dù bot có trả lời khách đầy đủ:
- `get_procedure_info_for_family_handler` và `check_missing_docs_handler` (file `src/tool_handler/procedure_info_for_family.js`)
- `get_procedure_info_for_organization_handler` (file `src/tool_handler/procedure_info_for_organization.js`)
- `wait_for_user_handler` (file `src/tool_handler/tool_call.js`) — cái này không quan trọng lắm vì tool này chỉ để "im lặng chờ", không có dữ liệu gì đáng lưu.

**Cách sửa triệt để (khuyến nghị) — sửa 1 chỗ duy nhất, không cần sửa từng file handler:**

Thay vì phải nhớ thêm `return` ở mọi handler hiện tại lẫn tương lai (dễ quên — đúng nỗi lo "yếu tay nghề" bạn nói), ta sửa ngay trong `tools.js` để **tự động "bắt" lại** nội dung mà handler gửi cho OpenAI qua `send_message`, không phụ thuộc việc handler có `return` hay không. Mở file `src/tools.js`, thay toàn bộ hàm `tool_function_handler` bằng bản sau:

```js
export async function tool_function_handler(function_event, asteriskData, send_message) {
    const handler = TOOL_HANDLERS[function_event.name];
    const t0 = Date.now();

    let result = null;
    let trace = [];

    // "Bắt" lại nội dung function_call_output mà handler gửi cho OpenAI,
    // để không phụ thuộc việc handler có return đúng giá trị hay không.
    let capturedOutput = null;
    const wrappedSend = (message) => {
        if (message?.type === "conversation.item.create" && message?.item?.type === "function_call_output") {
            try {
                capturedOutput = JSON.parse(message.item.output);
            } catch {
                capturedOutput = message.item.output;
            }
        }
        send_message(message);
    };

    if (handler) {
        const res = await runWithApiTrace(async () => {
            return await handler(function_event, asteriskData, wrappedSend);
        });
        result = res.result;
        trace = res.trace;
    } else {
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
    }

    const durationMs = Date.now() - t0;
    let parsedArgs = {};
    try { parsedArgs = JSON.parse(function_event.arguments || "{}"); } catch { }

    // Ghi nhận vào toolCalls của session
    if (asteriskData?.sessionLogger?.toolCalls) {
        asteriskData.sessionLogger.toolCalls.push({
            time: new Date().toISOString(),
            seq: asteriskData.sessionLogger.toolCalls.length + 1,
            name: function_event.name,
            args: parsedArgs,
            output: result ?? capturedOutput ?? null, // 👈 ưu tiên return, fallback sang giá trị bắt được
            durationMs,
            apiCalls: trace || [],
        });
    }

    return result;
}
```

**Chỉ có 3 chỗ thay đổi so với bản hiện tại của bạn**, để bạn dễ đối chiếu:
1. Thêm biến `let capturedOutput = null;` và hàm `wrappedSend` ngay trước khối `if (handler)`.
2. Trong lời gọi `handler(function_event, asteriskData, wrappedSend)` — đổi `send_message` thành `wrappedSend` (chỉ đổi tên biến truyền vào, không đổi gì khác).
3. Dòng `output: result || null` đổi thành `output: result ?? capturedOutput ?? null`.

Cách làm này có lợi: **mọi tool hiện tại và tương lai** (kể cả nếu bạn quên `return` khi viết handler mới) đều tự động được ghi `output` đúng, vì bản chất mọi handler đều phải gọi `send_message(...)` với `function_call_output` để trả lời cho OpenAI — bắt đúng chỗ đó là chắc chắn nhất.

*(Không bắt buộc, nhưng nếu muốn gọn gàng hơn, bạn có thể để nguyên `return r;` đã thêm trong `create_ticket.js` — không xung đột gì với cách sửa trên, `result` vẫn được ưu tiên dùng trước.)*

### 2.2. `error_count` trong DB sẽ luôn bằng 0

**Vì sao:** `sessionLogger.errors` được khai báo (`errors: []`) và dùng để tính `stats.errorCount`, nhưng không có chỗ nào trong code thực sự `push` vào mảng này. Nên dù OpenAI có trả lỗi giữa cuộc gọi, cột `error_count` trong `voicebot_calllog` vẫn luôn là 0 — mất đi 1 tín hiệu hữu ích để phát hiện cuộc gọi có vấn đề.

**Cách sửa:** mở `src/ws.js`, tìm đến `case "error":` (khoảng dòng 428), sửa thành:

```js
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
```

Chỉ thêm 6 dòng (khối `if`), giữ nguyên mọi thứ khác trong case này.

### 2.3. `cost_usd` đang gửi `0` thay vì "chưa có dữ liệu"

**Vì sao đáng lưu ý:** trong `ws.js`, `document.cost_usd` đang là:
```js
cost_usd: {
    total: 0,
    realtime: { cost: 0 },
    transcription: { cost: 0 },
},
```
Vì hiện tại bạn chưa tính chi phí thật (chưa port `pricing.js`), gửi `0` sẽ khiến cột `cost_total`, `cost_realtime`... trong DB lưu đúng số `0.000000` — tức là "cuộc gọi này miễn phí", **khác nghĩa** với "chưa biết chi phí". Nếu sau này ai đó dùng cột này để tính "chi phí trung bình/cuộc gọi", số liệu sẽ bị kéo thấp giả tạo vì lẫn rất nhiều dòng "0 giả".

**Cách sửa (không bắt buộc ngay, nhưng nên làm trước khi có ai dùng số liệu chi phí để báo cáo):** đổi thành:
```js
cost_usd: null,
```
(Bỏ hẳn 3 dòng `total/realtime/transcription`, chỉ để `null`.) Cột tương ứng trong DB sẽ là `NULL` (đúng nghĩa "chưa tính"), thay vì `0`. Việc này an toàn vì tất cả các hàm đọc `cost_usd` phía server chỉ nên đọc khi có — dùng `null` là giá trị chuẩn cho "chưa có" trong JSON.

Đây là việc có thể để dành làm sau, khi nào bạn quyết định port phần tính chi phí (mình từng đề xuất ở review lần 1, mục "nâng cao").

## 3. Việc cần bạn tự xác nhận (không phải sửa code)

- **Biến môi trường trên server thật** (`LOG_API_BASE`, `LOG_API_KEY`, `VOICEBOT_LOG_FOLDER_ON_API_SERVER`) đã cấu hình đúng chưa. File `.env` mình xem local đang để trống các biến này — nếu server production cũng đang trống, mọi lệnh ghi log sẽ **bị bỏ qua âm thầm** (đúng thiết kế "lỗi ghi log không làm sập cuộc gọi", nhưng nghĩa là bạn sẽ không thấy dữ liệu nào trong DB dù code đã đúng 100%). Việc này mình không tự kiểm tra được vì không được đọc nội dung `.env` — bạn tự mở file `.env` trên server thật và kiểm tra 3 biến trên có giá trị chưa.
- **Bảng `llm_price`** (bên DB) vẫn chưa có dòng giá cho model `gpt-realtime-2.1-mini` (model bạn đang dùng) và `gpt-4o-transcribe` (model transcription bạn đang dùng) — ghi chú lại từ review lần 1, chưa cần xử lý ngay vì bạn đang để `cost_usd` = 0/null (chưa tính giá), nhưng nhớ bổ sung khi nào làm tới phần tính chi phí.

## 4. Cách kiểm tra sau khi sửa (test thử)

Không cần công cụ đặc biệt, chỉ cần gọi thử 1 cuộc gọi test rồi xem log console của server:

1. Sau khi cuộc gọi kết thúc (bot cúp máy hoặc khách cúp máy), tìm dòng log dạng:
   `[LogAPI] Đã ghi voicebot_calllog: <callId> (tool_calls X/Y)` — nếu thấy dòng này nghĩa là `finalizeCallLog` đã gửi thành công lên server, và số tool_calls X/Y phản ánh đúng số tool đã gọi trong cuộc gọi đó.
2. Nếu thay vào đó thấy `[LogAPI] LOG_API_BASE trống → bỏ qua ghi log qua API` — nghĩa là biến môi trường (mục 3 ở trên) chưa cấu hình, cần bổ sung trên server.
3. Nếu thấy `[LogAPI] ... lỗi: ...` (không phải "OK") — đọc thêm phần lỗi để biết là lỗi mạng, lỗi xác thực (401 do thiếu `LOG_API_KEY`), hay lỗi từ chính `voicebot-log-api.php`.
4. Nếu có quyền truy vấn DB, sau khi test có thể chạy thử:
   ```sql
   SELECT voicebot_callid, customer_tel, start_time, outcome, tool_call_count, transcript IS NOT NULL AS co_transcript
   FROM voicebot_calllog ORDER BY id DESC LIMIT 5;

   SELECT tool_name, success, called_at FROM voicebot_toolcall
   WHERE voicebot_callid = '<callId vừa test>' ORDER BY seq;
   ```
   để xác nhận dữ liệu vào đúng, đủ.
