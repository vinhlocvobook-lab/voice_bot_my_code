// test-intent-routing-v2.mjs
//
// V2 - TEST INTENT ROUTING VỚI OPENAI REALTIME
//
// Mục tiêu:
//
// Customer
//    ↓
// Realtime Model
//    ↓
// set_intent()
//    ↓
// Backend CallState
//    ↓
// Intent Router
//    ↓
// Business Tool
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
// Chạy:
//
//   OPENAI_API_KEY="sk-..." node test-intent-routing-v2.mjs
//
//
// Lưu ý:
// Đây là demo để hiểu architecture.
// Chưa kết nối SIP/Asterisk.
// Chưa kết nối business API thật.
//


// ============================================================
// 1. IMPORT
// ============================================================

import WebSocket from "ws";
import readline from "readline";
import "dotenv/config";

// ============================================================
// 2. CONFIG
// ============================================================

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
    console.error(
        "Thiếu OPENAI_API_KEY."
    );

    console.error(
        'Ví dụ: OPENAI_API_KEY="sk-..." node test-intent-routing-v2.mjs'
    );

    process.exit(1);
}


const MODEL =
    process.env.OPENAI_REALTIME_MODEL ||
    "gpt-realtime";


// Realtime WebSocket endpoint.
// Nếu model/account của bạn dùng endpoint khác,
// thay giá trị này tại đây.

const WS_URL =
    `wss://api.openai.com/v1/realtime?model=${MODEL}`;


// ============================================================
// 3. INTENT
// ============================================================

const INTENT = Object.freeze({

    BILL: "bill",

    PROCEDURE: "procedure",

});


// ============================================================
// 4. INTENT -> TOOLS
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
// 5. CALL STATE
// ============================================================

function createCallState() {

    return {

        // Intent hiện tại

        intent: null,

        // Intent trước đó

        previousIntent: null,

        // Tools được phép sử dụng

        allowedTools: [],

        // Thông tin danh bộ

        danhBo: {

            value: null,

            status: "none",

        },

    };
}


// ============================================================
// 6. INTENT ROUTER
// ============================================================

function setIntent(callState, intent) {

    if (!INTENT_TOOLS[intent]) {

        throw new Error(
            `Intent không hợp lệ: ${intent}`
        );
    }


    callState.previousIntent =
        callState.intent;


    callState.intent =
        intent;


    callState.allowedTools =
        [...INTENT_TOOLS[intent]];


    console.log("\n");
    console.log("================================");
    console.log(" INTENT ROUTER");
    console.log("================================");

    console.log(
        "Previous intent:",
        callState.previousIntent
    );

    console.log(
        "Current intent:",
        callState.intent
    );

    console.log(
        "Allowed tools:",
        callState.allowedTools
    );
}


// ============================================================
// 7. DANH BỘ
// ============================================================

function setDanhBo(callState, danhBo) {

    if (!/^\d{11}$/.test(danhBo)) {

        throw new Error(
            `Mã danh bộ phải đúng 11 chữ số: ${danhBo}`
        );
    }


    callState.danhBo.value =
        danhBo;


    callState.danhBo.status =
        "confirmed";


    console.log("\n");
    console.log("[DANH BỘ]");

    console.log(
        "value:",
        callState.danhBo.value
    );

    console.log(
        "status:",
        callState.danhBo.status
    );
}


// ============================================================
// 8. TOOL GUARD
// ============================================================

function assertToolAllowed(
    callState,
    toolName
) {

    console.log("\n");
    console.log("[TOOL GUARD]");

    console.log(
        "Requested tool:",
        toolName
    );

    console.log(
        "Current intent:",
        callState.intent
    );

    console.log(
        "Allowed tools:",
        callState.allowedTools
    );


    // ----------------------------------------
    // Kiểm tra intent
    // ----------------------------------------

    if (!callState.intent) {

        throw new Error(
            "Chưa xác định intent."
        );
    }


    // ----------------------------------------
    // Kiểm tra tool
    // ----------------------------------------

    if (
        !callState.allowedTools.includes(
            toolName
        )
    ) {

        throw new Error(
            `Tool "${toolName}" không được phép ` +
            `với intent "${callState.intent}".`
        );
    }


    // ----------------------------------------
    // BILL bắt buộc danh bộ
    // ----------------------------------------

    if (
        toolName === "get_bill"
    ) {

        if (
            callState.danhBo.status !==
            "confirmed"
        ) {

            throw new Error(
                "Không thể gọi get_bill: " +
                "mã danh bộ chưa được xác nhận."
            );
        }


        if (
            !/^\d{11}$/.test(
                callState.danhBo.value
            )
        ) {

            throw new Error(
                "Mã danh bộ không hợp lệ."
            );
        }
    }


    console.log(
        "✓ TOOL ALLOWED"
    );
}


// ============================================================
// 9. BUSINESS TOOL:
//    GET BILL
// ============================================================

function getBill(callState) {

    assertToolAllowed(
        callState,
        "get_bill"
    );


    console.log("\n");
    console.log("================================");
    console.log(" GET BILL");
    console.log("================================");


    console.log(
        "Tra cứu danh bộ:",
        callState.danhBo.value
    );


    // ----------------------------------------
    // Giả lập API
    // ----------------------------------------

    const result = {

        ma_danh_bo:
            callState.danhBo.value,

        tien_nuoc:
            185000,

        thanh_toan:
            "Chưa thanh toán",

        san_luong:
            18,

    };


    console.log(
        "API RESULT:",
        result
    );


    return result;
}


// ============================================================
// 10. BUSINESS TOOL:
//     GET PROCEDURE
// ============================================================

function getProcedureInfo(
    callState,
    procedure
) {

    assertToolAllowed(
        callState,
        "get_procedure_info"
    );


    console.log("\n");
    console.log("================================");
    console.log(" GET PROCEDURE INFO");
    console.log("================================");


    console.log(
        "Procedure:",
        procedure
    );


    // ----------------------------------------
    // Giả lập API
    // ----------------------------------------

    const result = {

        procedure,

        requires_danh_bo:
            false,

        information:
            "Quý Khách có thể hỏi thông tin " +
            "thủ tục mà không cần cung cấp mã danh bộ.",

    };


    console.log(
        "API RESULT:",
        result
    );


    return result;
}


// ============================================================
// 11. REALTIME TOOLS
// ============================================================
//
// Có 3 tool:
//
// set_intent
// get_bill
// get_procedure_info
//
// Nhưng ở V2:
//
// set_intent là tool đặc biệt.
//
// Nó chỉ dùng để cập nhật state.
//
// Sau này chúng ta có thể chuyển sang
// cơ chế update allowed tools trực tiếp.
//


const REALTIME_TOOLS = [

    // --------------------------------------------------------
    // SET INTENT
    // --------------------------------------------------------

    {

        type: "function",

        name: "set_intent",

        description:
            "Xác định nghiệp vụ mà khách hàng đang yêu cầu. " +
            "Chỉ gọi khi đã hiểu rõ mục đích chính của khách.",

        parameters: {

            type: "object",

            properties: {

                intent: {

                    type: "string",

                    enum: [

                        INTENT.BILL,

                        INTENT.PROCEDURE,

                    ],

                    description:
                        "Intent của khách hàng.",

                },

            },

            required: [
                "intent",
            ],

            additionalProperties: false,

        },

    },


    // --------------------------------------------------------
    // GET BILL
    // --------------------------------------------------------

    {

        type: "function",

        name: "get_bill",

        description:
            "Tra cứu tiền nước, trạng thái thanh toán " +
            "và sản lượng nước của mã danh bộ đã xác nhận.",

        parameters: {

            type: "object",

            properties: {},

            additionalProperties: false,

        },

    },


    // --------------------------------------------------------
    // GET PROCEDURE INFO
    // --------------------------------------------------------

    {

        type: "function",

        name: "get_procedure_info",

        description:
            "Tra cứu thông tin thủ tục của công ty cấp nước.",

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
Luôn giao tiếp bằng tiếng Việt.

MỤC TIÊU CỦA DEMO:

Có 2 nghiệp vụ:

1. bill
   - Tra cứu tiền nước.
   - Bắt buộc phải có mã danh bộ 11 chữ số.

2. procedure
   - Tra cứu thủ tục.
   - Không bắt buộc mã danh bộ.

QUY TẮC INTENT:

Khi hiểu rõ khách đang muốn làm gì,
hãy gọi tool set_intent.

Nếu khách hỏi tiền nước / hóa đơn /
thanh toán / sản lượng:
→ intent = bill

Nếu khách hỏi thủ tục:
→ intent = procedure

Không tự gọi business tool trước khi
đã xác định intent.

QUY TẮC BILL:

Sau khi intent = bill,
nếu chưa có mã danh bộ đã xác nhận:

→ yêu cầu Quý Khách cung cấp mã danh bộ.

Khi khách cung cấp mã danh bộ,
hãy đọc lại và yêu cầu xác nhận.

Chỉ sau khi Quý Khách xác nhận,
mới gọi get_bill.

QUY TẮC PROCEDURE:

Sau khi intent = procedure,
có thể gọi get_procedure_info
mà không cần mã danh bộ.

QUY TẮC QUAN TRỌNG:

Không tự đoán mã danh bộ.

Không tự tạo mã danh bộ.

Không gọi get_bill nếu mã danh bộ
chưa được xác nhận.

Nếu khách thay đổi nhu cầu,
có thể gọi set_intent lại
với intent mới.

`;


// ============================================================
// 13. CONNECT REALTIME
// ============================================================

const ws = new WebSocket(
    WS_URL,
    {
        headers: {
            Authorization:
                `Bearer ${API_KEY}`,
        },
    }
);


// ============================================================
// 14. CALL STATE
// ============================================================

const callState =
    createCallState();


// ============================================================
// 15. SESSION OPEN
// ============================================================

ws.on(
    "open",
    () => {

        console.log("\n");
        console.log("================================");
        console.log(" CONNECTED TO OPENAI REALTIME");
        console.log("================================");

        console.log(
            "Model:",
            MODEL
        );


        // ----------------------------------------
        // Configure session
        // ----------------------------------------

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

            },

        });


        console.log("\n");
        console.log(
            "Session configured."
        );

        console.log(
            "Hãy nói hoặc nhập câu khách hàng."
        );

        console.log(
            "Ví dụ:"
        );

        console.log(
            '  "Em kiểm tra tiền nước giúp anh."'
        );

        console.log(
            '  "Cho anh hỏi thủ tục sang tên đồng hồ."'
        );

        console.log("\n");
    }
);


// ============================================================
// 16. RECEIVE REALTIME EVENTS
// ============================================================

ws.on(
    "message",
    (raw) => {

        let event;

        try {

            event =
                JSON.parse(
                    raw.toString()
                );

        } catch {

            console.error(
                "Không parse được event."
            );

            return;
        }


        // ----------------------------------------
        // DEBUG
        // ----------------------------------------

        console.log(
            "\n[REALTIME EVENT]",
            event.type
        );


        // ----------------------------------------
        // Function call arguments
        // ----------------------------------------

        if (
            event.type ===
            "response.function_call_arguments.done"
        ) {

            handleToolCall(
                event
            );

            return;
        }


        // ----------------------------------------
        // Text output
        // ----------------------------------------

        if (
            event.type ===
            "response.text.delta" ||
            event.type ===
            "response.audio_transcript.delta" ||
            event.type ===
            "response.output_text.delta"
        ) {

            process.stdout.write(
                event.delta || ""
            );

            return;
        }


        // ----------------------------------------
        // Response completed
        // ----------------------------------------

        if (
            event.type ===
            "response.done"
        ) {

            console.log("\n");
            rl.prompt();
            return;
        }


        // ----------------------------------------
        // Error
        // ----------------------------------------

        if (
            event.type ===
            "error"
        ) {

            console.error(
                "\n[OPENAI ERROR]"
            );

            console.error(
                event.error
            );

            return;
        }
    }
);


// ============================================================
// 17. HANDLE TOOL CALL
// ============================================================

function handleToolCall(event) {

    const toolName =
        event.name;

    const callId =
        event.call_id;

    let args = {};

    try {

        args =
            event.arguments
                ? JSON.parse(
                    event.arguments
                )
                : {};

    } catch {

        console.error(
            "Không parse được tool arguments."
        );

        return;
    }


    console.log("\n");
    console.log("================================");
    console.log(" TOOL CALL");
    console.log("================================");

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
                getBill(
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
                getProcedureInfo(
                    callState,
                    args.procedure
                );

        }


        // ====================================================
        // UNKNOWN TOOL
        // ====================================================

        else {

            throw new Error(
                `Unknown tool: ${toolName}`
            );
        }


    } catch (error) {

        console.error(
            "\n[TOOL BLOCKED]"
        );

        console.error(
            error.message
        );


        result = {

            success: false,

            error:
                error.message,

        };
    }


    // ========================================================
    // RETURN TOOL RESULT TO REALTIME
    // ========================================================

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


    // ========================================================
    // ASK MODEL TO CONTINUE
    // ========================================================

    sendEvent({

        type:
            "response.create",

    });
}


// ============================================================
// 18. SEND EVENT
// ============================================================

function sendEvent(event) {

    ws.send(
        JSON.stringify(event)
    );
}


// ============================================================
// 19. SIMPLE CLI
// ============================================================
//
// Vì đây là demo nên thay vì microphone,
// chúng ta nhập câu khách bằng terminal.
//
// Sau đó chuyển text vào conversation.
//


const rl =
    readline.createInterface({

        input:
            process.stdin,

        output:
            process.stdout,

        prompt:
            "Customer > ",

    });


rl.prompt();


rl.on(
    "line",
    (line) => {

        const text =
            line.trim();


        if (!text) {

            rl.prompt();

            return;
        }


        // ----------------------------------------
        // Special command:
        // set danh bộ
        // ----------------------------------------

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

                setDanhBo(
                    callState,
                    danhBo
                );

                console.log(
                    "\n✓ Đã xác nhận danh bộ."
                );

            } catch (error) {

                console.error(
                    "\n✗",
                    error.message
                );
            }


            rl.prompt();

            return;
        }


        // ----------------------------------------
        // Special command:
        // state
        // ----------------------------------------

        if (
            text ===
            "/state"
        ) {

            console.log(
                "\nCALL STATE:"
            );

            console.dir(
                callState,
                {
                    depth: null,
                }
            );

            rl.prompt();

            return;
        }


        // ----------------------------------------
        // Gửi text cho Realtime
        // ----------------------------------------

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


        // ----------------------------------------
        // Yêu cầu model trả lời
        // ----------------------------------------

        sendEvent({

            type:
                "response.create",

        });


        rl.prompt();
    }
);


// ============================================================
// 20. CLOSE
// ============================================================

rl.on(
    "close",
    () => {

        console.log(
            "\nĐóng chương trình."
        );

        ws.close();

    }
);


ws.on(
    "close",
    () => {

        console.log(
            "\nWebSocket closed."
        );

    }
);


ws.on(
    "error",
    (error) => {

        console.error(
            "\nWebSocket error:",
            error.message
        );

    }
);
