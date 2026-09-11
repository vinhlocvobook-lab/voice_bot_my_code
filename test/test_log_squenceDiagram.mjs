import { log_sequenceDiagram } from "../src/logger.js"
const filename = "test3.mermaid";
log_sequenceDiagram(`sequenceDiagram`, filename);
log_sequenceDiagram(`%% checkpoint5a-1787470917606.txt`, filename);
log_sequenceDiagram(`participant Code`, filename);
log_sequenceDiagram(`participant OpenAI`, filename);
log_sequenceDiagram(`Code->>OpenAI: session.update (+1121ms)`, filename);
log_sequenceDiagram(`OpenAI-->>Code: session.created (+1132ms)`, filename);
log_sequenceDiagram(`OpenAI-->>Code: session.updated (+1340ms)`, filename);
log_sequenceDiagram(`Code->>OpenAI: conversation.item.create (+1340ms)`, filename);
log_sequenceDiagram(`Code->>OpenAI: response.create (+1341ms)`, filename);
log_sequenceDiagram(`Note over Code,OpenAI: Da gui cau hoi text + say() - cho model xin goi tool.`, filename);
log_sequenceDiagram(`OpenAI-->>Code: conversation.item.added (+1553ms)`, filename);
log_sequenceDiagram(`OpenAI-->>Code: conversation.item.done (+1553ms)`, filename);
log_sequenceDiagram(`OpenAI-->>Code: response.created (+1590ms)`, filename);

// log_sequenceDiagram(`
// @startuml
// actor "Khách hàng"
// participant "IVR / Voice Bot" as Bot
// participant "OpenAI Assistant" as LLM
// participant "Hệ thống phần mềm " as API

// == Giai đoạn 1: Nhận lệnh ==
// Khách hàng -> Bot: Alo, tôi muốn hỏi tiền nước
// Bot -> LLM: Bạn muốn làm gì?
// LLM -> Bot: Tôi là IVR, đã có thông tin cuộc gọi từ hệ thống

// == Giai đoạn 2: Thu thập mã danh bộ ==
// LLM -> Bot: Quý khách vui lòng cho em xin số danh bộ?
// Khách hàng -> Bot: 123456
// Bot -> LLM: Xác nhận số danh bộ là 123456

// == Giai đoạn 3: Phân tích ý định ==
// LLM -> Bot: Hãy phân tích ý định khách hàng
// Bot -> LLM: Khách muốn tra cứu tiền nước

// == Giai đoạn 4: Gọi tool tra cứu ==
// LLM -> Bot: Hãy gọi tool get_bill
// Bot -> API: get_bill(ma_danh_bo=123456)
// API --> Bot: { "tiền_nước": 500000, "trạng_thái": "đã_thanh_toán", "kỳ": 7 }

// == Giai đoạn 5: Trả lời khách ==
// LLM -> Bot: Hãy trả lời khách hàng
// Bot -> Khách hàng: Tiền nước kỳ 7 là 500.000đ, đã thanh toán

// @enduml
// `)