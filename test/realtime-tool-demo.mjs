import WebSocket from "ws";
import "dotenv/config";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    throw new Error("Thiếu OPENAI_API_KEY");
}

const ws = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-realtime",
    {
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            // "OpenAI-Beta": "realtime=v1",
        },
    }
);

// ============================================================
// 1. ĐỊNH NGHĨA TOOLS
// ============================================================

const getCustomerTool = {
    type: "function",

    name: "get_customer",

    description:
        "Tra cứu thông tin khách hàng bằng mã danh bộ.",

    parameters: {
        type: "object",

        properties: {
            danh_bo: {
                type: "string",
                description: "Mã danh bộ gồm 11 chữ số.",
            },
        },

        required: ["danh_bo"],
    },
};

const createTicketTool = {
    type: "function",

    name: "create_ticket",

    description:
        "Tạo phiếu báo mất nước cho khách hàng.",

    parameters: {
        type: "object",

        properties: {
            noi_dung: {
                type: "string",
                description: "Nội dung khách hàng báo.",
            },
        },

        required: ["noi_dung"],
    },
};


// ============================================================
// 2. HÀM GỬI EVENT
// ============================================================

function sendEvent(event) {
    console.log("\n>>> SEND");
    console.dir(event, { depth: null });

    ws.send(JSON.stringify(event));
}


// ============================================================
// 3. THAY ĐỔI TOOLS
// ============================================================

function updateTools(tools) {
    sendEvent({
        type: "session.update",

        session: {
            tools,

            tool_choice: tools.length > 0
                ? "auto"
                : "none",
        },
    });
}


// ============================================================
// 4. Khi WebSocket kết nối
// ============================================================

ws.on("open", () => {
    console.log("Connected to OpenAI Realtime");

    // ----------------------------------------------------------
    // Ban đầu:
    // Không cho GPT gọi tool nào
    // ----------------------------------------------------------

    updateTools([]);

    // ----------------------------------------------------------
    // Sau 3 giây:
    // Chuyển sang nghiệp vụ TRA CỨU KHÁCH HÀNG
    // ----------------------------------------------------------

    setTimeout(() => {
        console.log("\n=== CHUYỂN SANG TRA CỨU KHÁCH HÀNG ===");

        updateTools([
            getCustomerTool,
        ]);

        // Cho GPT nói tiếp
        sendEvent({
            type: "response.create",
            response: {
                instructions:
                    "Hãy hỏi Quý Khách cung cấp mã danh bộ để tra cứu.",
            },
        });

    }, 3000);


    // ----------------------------------------------------------
    // Sau 15 giây:
    // Chuyển sang nghiệp vụ BÁO MẤT NƯỚC
    // ----------------------------------------------------------

    setTimeout(() => {
        console.log("\n=== CHUYỂN SANG BÁO MẤT NƯỚC ===");

        updateTools([
            createTicketTool,
        ]);

        sendEvent({
            type: "response.create",
            response: {
                instructions:
                    "Hãy hỏi Quý Khách mô tả tình trạng mất nước để tạo phiếu.",
            },
        });

    }, 15000);


    // ----------------------------------------------------------
    // Sau 30 giây:
    // Tắt toàn bộ tool
    // ----------------------------------------------------------

    setTimeout(() => {
        console.log("\n=== TẮT TOÀN BỘ TOOL ===");

        updateTools([]);

    }, 30000);
});


// ============================================================
// 5. NHẬN EVENT TỪ OPENAI
// ============================================================

ws.on("message", (data) => {
    const event = JSON.parse(data.toString());

    console.log("\n<<< RECEIVE");
    console.dir(event, { depth: null });

    // ----------------------------------------------------------
    // OpenAI xác nhận session.update
    // ----------------------------------------------------------

    if (event.type === "session.updated") {
        console.log("\nSession đã được cập nhật.");
    }

    // ----------------------------------------------------------
    // GPT yêu cầu gọi tool
    // ----------------------------------------------------------

    if (event.type === "response.function_call_arguments.done") {

        const name = event.name;
        const callId = event.call_id;

        let args = {};

        try {
            args = JSON.parse(event.arguments);
        } catch (err) {
            console.error("Arguments không hợp lệ:", event.arguments);
        }

        console.log("\n=== TOOL CALL ===");
        console.log("Tool:", name);
        console.log("Call ID:", callId);
        console.log("Arguments:", args);

        handleToolCall(name, callId, args);
    }
});


// ============================================================
// 6. XỬ LÝ TOOL CALL
// ============================================================

async function handleToolCall(name, callId, args) {

    let result;

    // ----------------------------------------------------------
    // get_customer
    // ----------------------------------------------------------

    if (name === "get_customer") {

        console.log(
            `Tra cứu khách hàng với danh bộ: ${args.danh_bo}`
        );

        // Giả lập API
        result = {
            success: true,

            danh_bo: args.danh_bo,

            ten_khach_hang: "Nguyễn Văn A",

            dia_chi: "123 Nguyễn Trãi",

            trang_thai: "Đang sử dụng",
        };
    }


    // ----------------------------------------------------------
    // create_ticket
    // ----------------------------------------------------------

    else if (name === "create_ticket") {

        console.log(
            `Tạo phiếu: ${args.noi_dung}`
        );

        // Giả lập API
        result = {
            success: true,

            ticket_id: "TICKET-123456",

            message: "Đã tạo phiếu báo mất nước.",
        };
    }


    // ----------------------------------------------------------
    // Tool không tồn tại
    // ----------------------------------------------------------

    else {

        result = {
            success: false,
            error: `Unknown tool: ${name}`,
        };
    }


    // ----------------------------------------------------------
    // Trả kết quả tool cho GPT
    // ----------------------------------------------------------

    sendEvent({
        type: "conversation.item.create",

        item: {
            type: "function_call_output",

            call_id: callId,

            output: JSON.stringify(result),
        },
    });


    // ----------------------------------------------------------
    // Cho GPT xử lý kết quả
    // ----------------------------------------------------------

    sendEvent({
        type: "response.create",
    });
}


// ============================================================
// 7. ERROR / CLOSE
// ============================================================

ws.on("error", (err) => {
    console.error("WebSocket error:", err);
});

ws.on("close", () => {
    console.log("WebSocket closed");
});