// test-intent-routing.js
//
// Demo đơn giản:
// Customer
//    ↓
// Intent
//    ↓
// Router
//    ↓
// Allowed Tools
//    ↓
// Tool Guard
//    ↓
// Execute Tool
//
// Chạy:
//   node test-intent-routing.js


// ============================================================
// 1. INTENT
// ============================================================
// freeze đẻ đóng băng value của INTENT và không thể thay đổi value INTENT
const INTENT = Object.freeze({
    BILL: "bill",
    PROCEDURE: "procedure",
});


// ============================================================
// 2. INTENT -> TOOLS
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
// 3. CALL STATE
// ============================================================

function createCallState() {
    return {
        intent: null,

        allowedTools: [],

        danhBo: {
            value: null,
            status: "none",
        },
    };
}


// ============================================================
// 4. INTENT ROUTER
// ============================================================

function setIntent(callState, intent) {

    if (!INTENT_TOOLS[intent]) {
        throw new Error(`Intent không hợp lệ: ${intent}`);
    }

    callState.intent = intent;

    callState.allowedTools = [
        ...INTENT_TOOLS[intent],
    ];

    console.log("\n[INTENT ROUTER]");
    console.log("Intent:", callState.intent);
    console.log(
        "Allowed tools:",
        callState.allowedTools
    );
}


// ============================================================
// 5. DANH BỘ
// ============================================================

function setDanhBo(callState, danhBo) {

    if (!/^\d{11}$/.test(danhBo)) {
        throw new Error(
            `Mã danh bộ phải đúng 11 chữ số: ${danhBo}`
        );
    }

    callState.danhBo.value = danhBo;
    callState.danhBo.status = "confirmed";

    console.log("\n[DANH BỘ]");
    console.log(
        "Mã danh bộ:",
        callState.danhBo.value
    );
    console.log(
        "Status:",
        callState.danhBo.status
    );
}


// ============================================================
// 6. TOOL GUARD
// ============================================================

function assertToolAllowed(callState, toolName) {

    // ----------------------------------------
    // Kiểm tra intent
    // ----------------------------------------

    if (!callState.intent) {
        throw new Error(
            "Chưa xác định intent."
        );
    }


    // ----------------------------------------
    // Kiểm tra tool có được phép hay không
    // ----------------------------------------

    if (!callState.allowedTools.includes(toolName)) {

        throw new Error(
            `Tool "${toolName}" không được phép ` +
            `với intent "${callState.intent}".`
        );
    }


    // ----------------------------------------
    // Nếu là get_bill
    // thì bắt buộc danh bộ
    // ----------------------------------------

    if (toolName === "get_bill") {

        if (
            callState.danhBo.status !== "confirmed"
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
        `[TOOL GUARD] Cho phép gọi: ${toolName}`
    );
}


// ============================================================
// 7. BUSINESS TOOLS
// ============================================================

function getBill(callState) {

    assertToolAllowed(
        callState,
        "get_bill"
    );

    console.log("\n[GET BILL]");

    console.log(
        "Đang tra cứu tiền nước cho danh bộ:",
        callState.danhBo.value
    );

    // Giả lập API
    const result = {
        ma_danh_bo: callState.danhBo.value,
        tien_nuoc: 185000,
        thanh_toan: "Chưa thanh toán",
        san_luong: 18,
    };

    console.log("Kết quả API:");
    console.log(result);

    return result;
}


function getProcedureInfo(callState, procedure) {

    assertToolAllowed(
        callState,
        "get_procedure_info"
    );

    console.log("\n[GET PROCEDURE INFO]");

    console.log(
        "Thủ tục khách hỏi:",
        procedure
    );

    // Giả lập API
    const result = {
        thu_tuc: procedure,
        can_danh_bo: false,
        thong_tin:
            "Quý Khách có thể thực hiện thủ tục này " +
            "mà không cần cung cấp mã danh bộ.",
    };

    console.log("Kết quả API:");
    console.log(result);

    return result;
}


// ============================================================
// 8. TEST 1
// ============================================================
//
// Nghiệp vụ:
// Tra cứu tiền nước
//
// Yêu cầu:
// Có mã danh bộ
// ============================================================

function testBill() {

    console.log("\n");
    console.log("==========================================");
    console.log(" TEST 1 - TRA CỨU TIỀN NƯỚC");
    console.log("==========================================");

    const callState = createCallState();

    console.log("\nCallState ban đầu:");
    console.log(callState);


    // Khách nói:
    //
    // "Em kiểm tra tiền nước giúp anh."

    console.log(
        '\nKhách: "Em kiểm tra tiền nước giúp anh."'
    );


    // Model xác định intent

    setIntent(
        callState,
        INTENT.BILL
    );


    // Chưa có danh bộ

    console.log("\nKhách chưa cung cấp mã danh bộ.");

    console.log(
        "\nThử gọi get_bill..."
    );

    try {

        getBill(callState);

    } catch (error) {

        console.log(
            "[BLOCKED]",
            error.message
        );
    }


    // Khách cung cấp danh bộ

    console.log(
        '\nKhách: "Mã danh bộ là 12345678901."'
    );

    setDanhBo(
        callState,
        "12345678901"
    );


    // Gọi lại get_bill

    console.log(
        "\nThử gọi get_bill lần 2..."
    );

    getBill(callState);
}


// ============================================================
// 9. TEST 2
// ============================================================
//
// Nghiệp vụ:
// Tra cứu thủ tục
//
// Không yêu cầu mã danh bộ
// ============================================================

function testProcedure() {

    console.log("\n");
    console.log("==========================================");
    console.log(" TEST 2 - TRA CỨU THỦ TỤC");
    console.log("==========================================");

    const callState = createCallState();

    console.log("\nCallState ban đầu:");
    console.log(callState);


    // Khách nói:
    //
    // "Em cho anh hỏi thủ tục sang tên đồng hồ."

    console.log(
        '\nKhách: "Em cho anh hỏi thủ tục sang tên đồng hồ."'
    );


    // Model xác định intent

    setIntent(
        callState,
        INTENT.PROCEDURE
    );


    // Không cần danh bộ

    console.log(
        "\nKhách không cung cấp mã danh bộ."
    );


    // Gọi tool

    getProcedureInfo(
        callState,
        "sang_ten_dong_ho"
    );
}


// ============================================================
// 10. TEST 3 - THỬ GỌI SAI TOOL
// ============================================================
//
// Test này rất quan trọng.
//
// Intent = PROCEDURE
//
// Nhưng cố tình gọi:
// get_bill
//
// Backend phải BLOCK.
// ============================================================

function testWrongTool() {

    console.log("\n");
    console.log("==========================================");
    console.log(" TEST 3 - GỌI SAI TOOL");
    console.log("==========================================");

    const callState = createCallState();


    // Intent = PROCEDURE

    setIntent(
        callState,
        INTENT.PROCEDURE
    );


    console.log(
        "\nCố tình gọi get_bill..."
    );

    try {

        getBill(callState);

    } catch (error) {

        console.log(
            "[BLOCKED]",
            error.message
        );
    }
}


// ============================================================
// 11. MAIN
// ============================================================

console.log("\n");
console.log("##########################################");
console.log("# SIMPLE INTENT ROUTING DEMO");
console.log("##########################################");


testBill();

testProcedure();

testWrongTool();


console.log("\n");
console.log("##########################################");
console.log("# TEST FINISHED");
console.log("##########################################");