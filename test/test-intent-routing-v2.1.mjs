// test-intent-routing-v2.mjs
//
// ============================================================
// DEMO V2 - INTENT ROUTING + TOOL GUARD + REALTIME
// ============================================================
//
// Mục tiêu:
//
//   Khách hàng
//       |
//       v
//   Realtime Model
//       |
//       | set_intent()
//       v
//   Backend
//       |
//       v
//   CallState
//       |
//       v
//   Intent Router
//       |
//       v
//   Tool Guard
//       |
//       v
//   Business Tool
//
// Có 2 nghiệp vụ:
//
// 1. BILL
//    - Tra cứu tiền nước
//    - BẮT BUỘC mã danh bộ 11 số
//
// 2. PROCEDURE
//    - Tra cứu thủ tục
//    - KHÔNG bắt buộc mã danh bộ
//
// ------------------------------------------------------------
//
// Cách chạy:
//
//   npm install ws
//
//   export OPENAI_API_KEY="sk-..."
//   node test-intent-routing-v2.mjs
//
// ------------------------------------------------------------
//
// Các lệnh đặc biệt:
//
//   /state
//       Xem CallState hiện tại
//
//   /danhbo 12345678901
//       Giả lập khách đã xác nhận mã danh bộ
//
//   /reset
//       Reset cuộc gọi
//
//   /quit
//       Thoát
//
// ============================================================


import WebSocket from "ws";
import readline from "readline";
import "dotenv/config";

// ============================================================
// 1. CONFIG
// ============================================================

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
    console.error(
        "ERROR: Chưa có OPENAI_API_KEY."
    );

    console.error(
        'Ví dụ: export OPENAI_API_KEY="sk-..."'
    );

    process.exit(1);
}


// Có thể thay bằng model Realtime mà bạn đang sử dụng.
//
// Ví dụ:
//   gpt-realtime
//   gpt-realtime-2
//
// Nếu project của bạn đang dùng model khác:
//
//   OPENAI_REALTIME_MODEL=... node test-intent-routing-v2.mjs

const MODEL =
    process.env.OPENAI_REALTIME_MODEL ||
    "gpt-realtime";


// Realtime WebSocket

const WS_URL =
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`;


// ============================================================
// 2. INTENT
// ============================================================

const INTENT = Object.freeze({

    BILL: "bill",

    PROCEDURE: "procedure",

});


// ============================================================
// 3. INTENT -> ALLOWED TOOLS
// ============================================================
//
// Đây là phần rất quan trọng.
//
// Intent BILL
//      |
//      +--> get_bill
//
// Intent PROCEDURE
//      |
//      +--> get_procedure_info
//
// ============================================================

const INTENT_TOOLS = Object.freeze({

    [INTENT.BILL]: [
        "get_bill",
    ],

    [INTENT.PROCEDURE]: [
        "get_procedure_info",
    ],

});


// ============================================================
// 4. CALL STATE
// ============================================================
//
// Đây là "bộ nhớ" của backend.
//
// Model không được tự sửa object này.
//
// Backend là nơi quản lý.
//
// ============================================================

function createCallState() {

    return {

        intent: null,

        previousIntent: null,

        allowedTools: [],

        danhBo: {

            value: null,

            status: "none",

        },

    };
}


let callState =
    createCallState();


// ============================================================
// 5. PRINT CALL STATE
// ============================================================

function printCallState() {

    console.log("\n");
    console.log("========================================");
    console.log(" CALL STATE");
    console.log("========================================");

    console.dir(
        callState,
        {
            depth: null,
        }
    );

    console.log("========================================");
}


// ============================================================
// 6. INTENT ROUTER
// ============================================================
//
// Khi model gọi:
//
//   set_intent({
//       intent: "bill"
//   })
//
// Backend chạy:
//
//   setIntent(callState, "bill")
//
// Và kết quả:
//
//   callState.intent = "bill"
//
//   callState.allowedTools = [
//       "get_bill"
//   ]
//
// ============================================================

function setIntent(
    state,
    intent
) {

    if (!INTENT_TOOLS[intent]) {

        throw new Error(
            `Intent không hợp lệ: ${intent}`
        );
    }


    state.previousIntent =
        state.intent;


    state.intent =
        intent;


    state.allowedTools =
        [
            ...INTENT_TOOLS[intent],
        ];


    console.log("\n");
    console.log("----------------------------------------");
    console.log("[INTENT ROUTER]");
    console.log("----------------------------------------");

    console.log(
        "Previous intent:",
        state.previousIntent
    );

    console.log(
        "Current intent:",
        state.intent
    );

    console.log(
        "Allowed tools:",
        state.allowedTools
    );
}


// ============================================================
// 7. DANH BỘ
// ============================================================
//
// Trong demo này:
//
//   /danhbo 12345678901
//
// giả lập:
//
//   khách đã đọc
//   backend đã kiểm tra
//   khách đã xác nhận
//
// ============================================================

function confirmDanhBo(
    state,
    danhBo
) {

    if (!/^\d{11}$/.test(danhBo)) {

        throw new Error(
            `Mã danh bộ phải đúng 11 chữ số. Nhận được: ${danhBo}`
        );
    }


    state.danhBo.value =
        danhBo;


    state.danhBo.status =
        "confirmed";


    console.log("\n");
    console.log("----------------------------------------");
    console.log("[DANH BỘ]");
    console.log("----------------------------------------");

    console.log(
        "Danh bộ:",
        state.danhBo.value
    );

    console.log(
        "Status:",
        state.danhBo.status
    );
}


// ============================================================
// 8. TOOL GUARD
// ============================================================
//
// Đây là lớp bảo vệ.
//
// Model có thể yêu cầu:
//
//   get_bill
//
// Nhưng backend phải kiểm tra:
//
//   1. Có intent chưa?
//   2. Tool có nằm trong allowedTools không?
//   3. Nếu get_bill:
//        - danh bộ đã confirmed chưa?
//        - có đúng 11 số không?
//
// ============================================================

function assertToolAllowed(
    state,
    toolName
) {

    console.log("\n");
    console.log("----------------------------------------");
    console.log("[TOOL GUARD]");
    console.log("----------------------------------------");

    console.log(
        "Requested tool:",
        toolName
    );

    console.log(
        "Current intent:",
        state.intent
    );

    console.log(
        "Allowed tools:",
        state.allowedTools
    );


    // --------------------------------------------------------
    // 1. Phải có intent
    // --------------------------------------------------------

    if (!state.intent) {

        throw new Error(
            "Chưa xác định intent."
        );
    }


    // --------------------------------------------------------
    // 2. Tool phải được phép
    // --------------------------------------------------------

    if (
        !state.allowedTools.includes(
            toolName
        )
    ) {

        throw new Error(
            `Tool "${toolName}" KHÔNG được phép ` +
            `với intent "${state.intent}".`
        );
    }


    // --------------------------------------------------------
    // 3. get_bill bắt buộc danh bộ
    // --------------------------------------------------------

    if (
        toolName === "get_bill"
    ) {

        if (
            state.danhBo.status !==
            "confirmed"
        ) {

            throw new Error(
                "get_bill yêu cầu mã danh bộ " +
                "đã được xác nhận."
            );
        }


        if (
            !/^\d{11}$/.test(
                state.danhBo.value
            )
        ) {

            throw new Error(
                "Mã danh bộ không hợp lệ."
            );
        }
    }


    console.log(
        "RESULT: TOOL ALLOWED"
    );
}


// ============================================================
// 9. BUSINESS TOOL: GET BILL
// ============================================================
//
// Đây chỉ là API giả.
//
// Sau này bạn thay bằng:
//
//   await getThongTinKhachHang(...)
//
// hoặc:
//
//   await getBill(...)
//
// ============================================================

async function getBill(
    state
) {

    assertToolAllowed(
        state,
        "get_bill"
    );


    console.log("\n");
    console.log("========================================");
    console.log(" BUSINESS TOOL: get_bill");
    console.log("========================================");


    console.log(
        "Đang tra cứu danh bộ:",
        state.danhBo.value
    );


    // --------------------------------------------------------
    // Giả lập API
    // --------------------------------------------------------

    const result = {

        success: true,

        ma_danh_bo:
            state.danhBo.value,

        tien_nuoc:
            185000,

        thanh_toan:
            "Chưa thanh toán",

        san_luong:
            18,

    };


    console.log(
        "API RESULT:"
    );

    console.dir(
        result,
        {
            depth: null,
        }
    );


    return result;
}


// ============================================================
// 10. BUSINESS TOOL: GET PROCEDURE INFO
// ============================================================
//
// Không cần danh bộ.
//
// ============================================================

async function getProcedureInfo(
    state,
    procedure
) {

    assertToolAllowed(
        state,
        "get_procedure_info"
    );


    console.log("\n");
    console.log("========================================");
    console.log(" BUSINESS TOOL: get_procedure_info");
    console.log("========================================");


    console.log(
        "Procedure:",
        procedure
    );


    // --------------------------------------------------------
    // Giả lập API
    // --------------------------------------------------------

    const result = {

        success: true,

        procedure,

        requires_danh_bo:
            false,

        information:
            "Đây là thông tin thủ tục giả lập. " +
            "Nghiệp vụ này không yêu cầu mã danh bộ.",

    };


    console.log(
        "API RESULT:"
    );

    console.dir(
        result,
        {
            depth: null,
        }
    );


    return result;
}


// ============================================================
// 11. REALTIME TOOLS
// ============================================================
//
// Lưu ý:
//
// V2 vẫn expose cả 3 function cho model.
//
// Nhưng backend mới là nơi quyết định:
//
//   intent
//       ↓
//   allowedTools
//       ↓
//   Tool Guard
//
// Vì vậy nếu model gọi sai:
//
//   PROCEDURE
//       ↓
//   get_bill
//
// backend sẽ BLOCK.
//
// Đây chính là điều chúng ta muốn test.
//
// ============================================================

const REALTIME_TOOLS = [

    // --------------------------------------------------------
    // TOOL 1: SET INTENT
    // --------------------------------------------------------

    {

        type: "function",

        name: "set_intent",

        description:
            "Xác định nghiệp vụ chính mà khách hàng đang yêu cầu. " +
            "Chỉ sử dụng khi đã hiểu rõ mục đích của khách hàng.",

        parameters: {

            type: "object",

            properties: {

                intent: {

                    type: "string",

                    enum: [

                        "bill",

                        "procedure",

                    ],

                    description:
                        "bill = tra cứu tiền nước. " +
                        "procedure = hỏi thủ tục.",

                },

            },

            required: [
                "intent",
            ],

            additionalProperties: false,

        },

    },


    // --------------------------------------------------------
    // TOOL 2: GET BILL
    // --------------------------------------------------------

    {

        type: "function",

        name: "get_bill",

        description:
            "Tra cứu tiền nước, trạng thái thanh toán " +
            "và sản lượng của mã danh bộ đã được xác nhận.",

        parameters: {

            type: "object",

            properties: {},

            additionalProperties: false,

        },

    },


    // --------------------------------------------------------
    // TOOL 3: GET PROCEDURE
    // --------------------------------------------------------

    {

        type: "function",

        name: "get_procedure_info",

        description:
            "Tra cứu thông tin thủ tục của công ty cấp nước. " +
            "Không yêu cầu mã danh bộ.",

        parameters: {

            type: "object",

            properties: {

                procedure: {

                    type: "string",

                    description:
                        "Tên thủ tục khách muốn hỏi.",

                },

            },

            required: [
                "procedure",
            ],

            additionalProperties: false,

        },

    },

];


// ============================================================
// 12. SYSTEM INSTRUCTIONS
// ============================================================

const INSTRUCTIONS = `

Bạn là nhân viên chăm sóc khách hàng của Công ty Cấp nước Trung An.

Bạn xưng "em".
Gọi khách hàng là "Quý Khách".
Luôn nói tiếng Việt.

============================================================
CÁC INTENT
============================================================

Có 2 intent:

1. bill

Dùng khi khách hỏi:

- tiền nước
- hóa đơn
- thanh toán
- đã thanh toán chưa
- sản lượng nước

2. procedure

Dùng khi khách hỏi:

- thủ tục
- hồ sơ
- giấy tờ
- sang tên
- lắp đặt
- các thủ tục dịch vụ

============================================================
QUY TẮC INTENT
============================================================

Khi hiểu rõ khách đang muốn làm gì,
hãy gọi set_intent.

Ví dụ:

"Em kiểm tra tiền nước giúp anh."

→ set_intent({ "intent": "bill" })

Ví dụ:

"Cho anh hỏi thủ tục sang tên đồng hồ."

→ set_intent({ "intent": "procedure" })

Nếu khách thay đổi nhu cầu,
có thể gọi set_intent lại.

============================================================
QUY TẮC BILL
============================================================

Sau khi intent = bill:

Nếu chưa có mã danh bộ đã xác nhận:

→ yêu cầu Quý Khách cung cấp mã danh bộ.

Không được gọi get_bill
khi mã danh bộ chưa được xác nhận.

============================================================
QUY TẮC PROCEDURE
============================================================

Sau khi intent = procedure:

Có thể gọi get_procedure_info
mà không cần mã danh bộ.

============================================================
QUY TẮC QUAN TRỌNG
============================================================

Không tự tạo mã danh bộ.

Không đoán mã danh bộ.

Không tự cho rằng mã danh bộ đã được xác nhận.

Backend sẽ kiểm tra việc này.

`;


// ============================================================
// 13. CONNECT TO REALTIME
// ============================================================

console.log("\n");
console.log("========================================");
console.log(" CONNECTING TO OPENAI REALTIME");
console.log("========================================");

console.log(
    "Model:",
    MODEL
);


const ws =
    new WebSocket(
        WS_URL,
        {
            headers: {
                Authorization:
                    `Bearer ${API_KEY}`,


            },
        }
    );


// ============================================================
// 14. SEND EVENT
// ============================================================

function sendEvent(
    event
) {

    if (
        ws.readyState !==
        WebSocket.OPEN
    ) {

        console.error(
            "WebSocket chưa OPEN."
        );

        return;
    }


    ws.send(
        JSON.stringify(event)
    );
}


// ============================================================
// 15. SESSION CONFIGURATION
// ============================================================

function configureSession() {

    sendEvent({

        type:
            "session.update",

        session: {

            type:
                "realtime",

            instructions:
                INSTRUCTIONS,

            tools:
                REALTIME_TOOLS,

            tool_choice:
                "auto",

            // Demo chỉ cần text.
            //
            // Không cần microphone.
            //
            output_modalities:
                ["text"],

        },

    });


    console.log(
        "\n✓ Session configured."
    );

    console.log(
        "\nBạn có thể nhập câu khách hàng."
    );

    console.log(
        'Ví dụ: "Em kiểm tra tiền nước giúp anh."'
    );

    console.log(
        'Hoặc: "Cho anh hỏi thủ tục sang tên đồng hồ."'
    );

    console.log("\n");
}


// ============================================================
// 16. WEBSOCKET OPEN
// ============================================================

ws.on(
    "open",
    () => {

        console.log(
            "✓ WebSocket connected."
        );

        configureSession();

        rl.prompt();

    }
);


// ============================================================
// 17. TOOL CALL HANDLER
// ============================================================
//
// Khi model gọi function:
//
//   set_intent
//   get_bill
//   get_procedure_info
//
// chúng ta xử lý ở đây.
//
// ============================================================

async function handleToolCall(
    item
) {

    const toolName =
        item.name;

    const callId =
        item.call_id;

    let args = {};


    try {

        if (
            item.arguments
        ) {

            args =
                JSON.parse(
                    item.arguments
                );
        }

    } catch (error) {

        console.error(
            "\nKhông parse được arguments:",
            error.message
        );


        sendToolOutput(
            callId,
            {
                success: false,

                error:
                    "Invalid JSON arguments.",
            }
        );

        return;
    }


    console.log("\n");
    console.log("========================================");
    console.log(" MODEL WANTS TO CALL TOOL");
    console.log("========================================");

    console.log(
        "Tool:",
        toolName
    );

    console.log(
        "Arguments:",
        args
    );


    let result;


    try {

        // ====================================================
        // SET INTENT
        // ====================================================

        if (
            toolName ===
            "set_intent"
        ) {

            setIntent(
                callState,
                args.intent
            );


            result = {

                success: true,

                intent:
                    callState.intent,

                allowed_tools:
                    callState.allowedTools,

            };

        }


        // ====================================================
        // GET BILL
        // ====================================================

        else if (
            toolName ===
            "get_bill"
        ) {

            result =
                await getBill(
                    callState
                );

        }


        // ====================================================
        // GET PROCEDURE
        // ====================================================

        else if (
            toolName ===
            "get_procedure_info"
        ) {

            result =
                await getProcedureInfo(
                    callState,
                    args.procedure
                );

        }


        // ====================================================
        // UNKNOWN
        // ====================================================

        else {

            throw new Error(
                `Tool không tồn tại: ${toolName}`
            );
        }


    } catch (error) {

        console.log("\n");
        console.log(
            "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        );

        console.log(
            "[TOOL BLOCKED]"
        );

        console.log(
            error.message
        );

        console.log(
            "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
        );


        result = {

            success: false,

            blocked: true,

            error:
                error.message,

        };
    }


    // --------------------------------------------------------
    // Gửi kết quả tool về Realtime
    // --------------------------------------------------------

    sendToolOutput(
        callId,
        result
    );
}


// ============================================================
// 18. SEND TOOL OUTPUT
// ============================================================

function sendToolOutput(
    callId,
    result
) {

    sendEvent({

        type:
            "conversation.item.create",

        item: {

            type:
                "function_call_output",

            call_id:
                callId,

            output:
                JSON.stringify(
                    result
                ),

        },

    });


    // --------------------------------------------------------
    // Sau khi tool chạy xong,
    // yêu cầu model tiếp tục response.
    // --------------------------------------------------------

    sendEvent({

        type:
            "response.create",

    });
}


// ============================================================
// 19. HANDLE REALTIME MESSAGE
// ============================================================

ws.on(
    "message",
    async (raw) => {

        let event;


        try {

            event =
                JSON.parse(
                    raw.toString()
                );

        } catch (error) {

            console.error(
                "Invalid JSON event."
            );

            return;
        }


        // ----------------------------------------------------
        // Error
        // ----------------------------------------------------

        if (
            event.type ===
            "error"
        ) {

            console.error("\n");
            console.error(
                "========================================"
            );

            console.error(
                " OPENAI ERROR"
            );

            console.error(
                "========================================"
            );

            console.error(
                event.error
            );

            return;
        }


        // ----------------------------------------------------
        // Session created
        // ----------------------------------------------------

        if (
            event.type ===
            "session.created"
        ) {

            console.log(
                "\n[Realtime] session.created"
            );

            return;
        }


        // ----------------------------------------------------
        // Function call arguments completed
        //
        // Đây là event thường gặp khi model gọi function.
        // ----------------------------------------------------

        if (
            event.type ===
            "response.function_call_arguments.done"
        ) {

            await handleToolCall(
                event
            );

            return;
        }


        // ----------------------------------------------------
        // Một số flow/model có thể trả function_call
        // trong response.output_item.done.
        // ----------------------------------------------------

        if (
            event.type ===
            "response.output_item.done"
        ) {

            const item =
                event.item;


            if (
                item &&
                item.type ===
                "function_call"
            ) {

                await handleToolCall(
                    item
                );

            }

            return;
        }


        // ----------------------------------------------------
        // Text output
        // ----------------------------------------------------

        if (
            event.type ===
            "response.output_text.delta"
        ) {

            process.stdout.write(
                event.delta
            );

            return;
        }


        // ----------------------------------------------------
        // Response completed
        // ----------------------------------------------------

        if (
            event.type ===
            "response.done"
        ) {

            console.log("\n");

            return;
        }

    }
);


// ============================================================
// 20. WEBSOCKET ERROR
// ============================================================

ws.on(
    "error",
    (error) => {

        console.error(
            "\nWebSocket ERROR:",
            error.message
        );

    }
);


// ============================================================
// 21. WEBSOCKET CLOSE
// ============================================================

ws.on(
    "close",
    (
        code,
        reason
    ) => {

        console.log("\n");

        console.log(
            "WebSocket closed."
        );

        console.log(
            "Code:",
            code
        );

        if (reason) {

            console.log(
                "Reason:",
                reason.toString()
            );

        }

    }
);


// ============================================================
// 22. CLI
// ============================================================

const rl =
    readline.createInterface({

        input:
            process.stdin,

        output:
            process.stdout,

        prompt:
            "Customer > ",

    });


// ============================================================
// 23. SEND USER TEXT
// ============================================================

function sendUserText(
    text
) {

    sendEvent({

        type:
            "conversation.item.create",

        item: {

            type:
                "message",

            role:
                "user",

            content: [

                {

                    type:
                        "input_text",

                    text,

                },

            ],

        },

    });


    sendEvent({

        type:
            "response.create",

    });
}


// ============================================================
// 24. CLI INPUT
// ============================================================

rl.on(
    "line",
    (line) => {

        const text =
            line.trim();


        if (!text) {

            rl.prompt();

            return;
        }


        // ----------------------------------------------------
        // /quit
        // ----------------------------------------------------

        if (
            text ===
            "/quit"
        ) {

            rl.close();

            return;
        }


        // ----------------------------------------------------
        // /state
        // ----------------------------------------------------

        if (
            text ===
            "/state"
        ) {

            printCallState();

            rl.prompt();

            return;
        }


        // ----------------------------------------------------
        // /reset
        // ----------------------------------------------------

        if (
            text ===
            "/reset"
        ) {

            callState =
                createCallState();


            console.log(
                "\n✓ CallState đã reset."
            );


            printCallState();

            rl.prompt();

            return;
        }


        // ----------------------------------------------------
        // /danhbo
        // ----------------------------------------------------
        //
        // Ví dụ:
        //
        // /danhbo 12345678901
        //
        // Đây là shortcut để test.
        //
        // Không phải customer thật.
        //
        // ----------------------------------------------------

        if (
            text.startsWith(
                "/danhbo "
            )
        ) {

            const danhBo =
                text
                    .substring(
                        "/danhbo ".length
                    )
                    .trim();


            try {

                confirmDanhBo(
                    callState,
                    danhBo
                );


            } catch (error) {

                console.error(
                    "\nERROR:",
                    error.message
                );

            }


            rl.prompt();

            return;
        }


        // ----------------------------------------------------
        // Gửi câu khách hàng cho Realtime
        // ----------------------------------------------------

        sendUserText(
            text
        );


        rl.prompt();

    }
);


// ============================================================
// 25. CLI CLOSE
// ============================================================

rl.on(
    "close",
    () => {

        console.log(
            "\nĐang đóng chương trình..."
        );


        if (
            ws.readyState ===
            WebSocket.OPEN
        ) {

            ws.close();

        }

    }
);