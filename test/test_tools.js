import "dotenv/config";
import { tool_function_handler } from "../src/tools.js";

// Hàm helper tạo hàm send_message giả lập để hứng kết quả
function createMockSender(testName) {
    const receivedMessages = [];
    const send_message = (msg) => {
        receivedMessages.push(msg);
        console.log(`\n  [${testName}] 📤 Output gửi về OpenAI:`);
        console.dir(msg, { depth: null });
    };
    return { send_message, receivedMessages };
}

async function runTests() {
    console.log("================ BẮT ĐẦU TEST CÁC TOOL HANDLER ================\n");

    // TEST 1: Tra cứu tiền nước khi ĐÃ CÓ mã danh bộ
    // {
    //     console.log("▶ TEST 1: get_bill (Đã có mã danh bộ)");
    //     const { send_message } = createMockSender("TEST 1");
    //     const event = {
    //         name: "get_bill",
    //         call_id: "call_test_01",
    //         arguments: JSON.stringify({ ky: 8, nam: 2026 })
    //     };
    //     const asteriskData = {
    //         ma_danh_bo: "15122890724",
    //         ma_danh_bo_confirmed: true
    //     };
    //     await tool_function_handler(event, asteriskData, send_message);
    // }
    // return;
    // TEST 2: Tra cứu cúp nước
    // {
    //     console.log("\n▶ TEST 2: get_outages (Tra cứu cúp nước)");
    //     const { send_message } = createMockSender("TEST 2");
    //     const event = {
    //         name: "get_outages",
    //         call_id: "call_test_02",
    //         arguments: "{}"
    //     };
    //     const asteriskData = {
    //         ma_danh_bo: "15122890724",
    //         ma_danh_bo_confirmed: true
    //     };
    //     await tool_function_handler(event, asteriskData, send_message);
    // }
    // return;
    // TEST 3: So sánh sản lượng
    // {
    //     console.log("\n▶ TEST 3: compare_usage (So sánh sản lượng)");
    //     const { send_message } = createMockSender("TEST 3");
    //     const event = {
    //         name: "compare_usage",
    //         call_id: "call_test_03",
    //         arguments: JSON.stringify({ ky: 7, nam: 2026 })
    //     };
    //     const asteriskData = {
    //         ma_danh_bo: "15122890724",
    //         ma_danh_bo_confirmed: true
    //     };
    //     await tool_function_handler(event, asteriskData, send_message);
    // }
    // return;

    // TEST 4: Tra cứu thủ tục định mức nước hộ gia đình
    {
        console.log("\n▶ TEST 4: get_procedure_info_for_family");
        const { send_message } = createMockSender("TEST 4");
        const event = {
            name: "get_procedure_info_for_family",
            call_id: "call_test_04",
            arguments: JSON.stringify({ loai_thu_tuc: "dinh_muc_nuoc", doi_tuong: "ho_gia_dinh" })
        };
        const asteriskData = {};
        await tool_function_handler(event, asteriskData, send_message);
    }

    return;
    // TEST 5: Kiểm tra đối chiếu giấy tờ còn thiếu
    {
        console.log("\n▶ TEST 5: check_missing_docs (Khách đã có CCCD)");
        const { send_message } = createMockSender("TEST 5");
        const event = {
            name: "check_missing_docs",
            call_id: "call_test_05",
            arguments: JSON.stringify({
                loai_thu_tuc: "dinh_muc_nuoc",
                doi_tuong: "ho_gia_dinh",
                giay_to_da_co: ["Căn cước công dân"]
            })
        };
        const asteriskData = {};
        await tool_function_handler(event, asteriskData, send_message);
    }

    // TEST 6: Báo sự cố / Tạo phiếu
    {
        console.log("\n▶ TEST 6: create_ticket (Báo rò rỉ nước)");
        const { send_message } = createMockSender("TEST 6");
        const event = {
            name: "create_ticket",
            call_id: "call_test_06",
            arguments: JSON.stringify({
                ma_danh_bo: "15122890724",
                loai: "Rò rỉ nước",
                mo_ta: "Nước tràn ra trước cửa nhà"
            })
        };
        const asteriskData = { caller_phone: "0901234567" };
        await tool_function_handler(event, asteriskData, send_message);
    }

    console.log("\n================ HOÀN THÀNH TẤT CẢ CÁC BÀI TEST ================");
}

runTests().catch(console.error);
