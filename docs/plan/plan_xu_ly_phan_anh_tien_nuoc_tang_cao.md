# Kế Hoạch Nâng Cấp VoiceBot: Xử Lý Phản Ánh Tiền Nước Tăng Cao & Phát Hiện Tiêu Thụ Bất Thường

- **Tài liệu:** Kế hoạch kỹ thuật & giải pháp nghiệp vụ
- **Vị trí lưu:** `docs/plan/plan_xu_ly_phan_anh_tien_nuoc_tang_cao.md`
- **Mục tiêu:** Giúp VoiceBot giải đáp thông minh, chính xác khi khách hàng gọi lên thắc mắc/phàn nàn: *"Sao tiền nước tháng này nhiều quá?"*, *"Sao tháng này nước lên dữ vậy?"*, tự động đối chiếu lịch sử để phát hiện mức tiêu thụ là **Bình thường** hay **Bất thường**.

---

## 1. Hiện Trạng & Nguyên Nhân Bot Chưa Trả Lời Được

### 1.1. Hạn chế của tool tra cứu hóa đơn hiện tại (`get_bill`)
- Dữ liệu trả về của API `/trang-thai-thanh-toan` (tham khảo file [bill_data_test.md](file:///Users/vovinhloc/myworking/customer/cnta/voice_bot/voice_bot_my_code/src/tool_handler/bill_data_test.md)) chỉ có thông tin của **duy nhất 1 kỳ**:
  ```json
  {
    "Nam": 2026,
    "Ky": 7,
    "TongTien": 237427,
    "SanLuong": 12,
    "TrangThaiThanhToan": "Đã thanh toán"
  }
  ```
- Tool [bill.js](file:///Users/vovinhloc/myworking/customer/cnta/voice_bot/voice_bot_my_code/src/tool_handler/bill.js) chỉ đọc ra số tiền, sản lượng và tình trạng thanh toán của kỳ đó.
- Bot hoàn toàn **không có dữ liệu của kỳ trước hoặc lịch sử nhiều tháng** để so sánh, nên không thể giải thích cho khách vì sao tiền nước lại tăng.

### 1.2. Intent Routing & Hướng dẫn Prompt chưa kích hoạt
- Dự án đã có sẵn tool [compare_usage.js](file:///Users/vovinhloc/myworking/customer/cnta/voice_bot/voice_bot_my_code/src/tool_handler/compare_usage.js) gọi API `/so-sanh-tang-giam` (tham khảo [compare_usage.md](file:///Users/vovinhloc/myworking/customer/cnta/voice_bot/voice_bot_my_code/src/tool_handler/compare_usage.md)), tuy nhiên:
  - Trong [call-handle.js](file:///Users/vovinhloc/myworking/customer/cnta/voice_bot/voice_bot_my_code/src/call-handle.js#L84), dòng hướng dẫn nghiệp vụ:
    ```javascript
    // - gọi tool "compare_usage" khi khách cần hỗ trợ so sánh tiền nước, sản lượng nước so với kỳ trước
    ```
    đang bị comment lại.
  - Mô tả (`description`) của `tool_compare_usage` chỉ ghi chung chung: *"So sánh tăng/giảm sản lượng nước so với kỳ trước"*. Model AI không nhận diện được các câu phàn nàn thực tế như *"sao đắt thế"*, *"sao tiền nước nhiều quá"*, *"sao nước tăng vọt"* để kích hoạt tool này.

---

## 2. Giải Pháp Nghiệp Vụ & Kỹ Thuật

Giải pháp được chia làm **2 giai đoạn**:

### GIAI ĐOẠN 1: Áp dụng ngay với API `/so-sanh-tang-giam` (So sánh kỳ này với kỳ trước)

API `/so-sanh-tang-giam` sẵn có đã tính sẵn chênh lệch:
```json
{
  "ThongTinKyNay": { "SanLuong": 12, "TienNuoc": 237427 },
  "ThongTinKyTruoc": { "SanLuong": 10, "TienNuoc": 197856 },
  "SoSanhTangGiam": {
    "TangGiamSanLuong": 2,
    "TangGiamTien": 39571,
    "TrangThaiSanLuong": "Tăng",
    "TrangThaiTien": "Tăng",
    "PhanTramChenhLechSanLuong": 20
  }
}
```

#### Quy tắc xác định "Bình thường" vs "Bất thường":
1. **Bình thường (Dao động sinh hoạt thông thường):**
   - **Điều kiện:** Sản lượng tăng $\le 30\%$ HOẶC số khối tăng $\le 3\text{ m}^3$.
   - **Logic giải thích:** Khẳng định tiền nước tăng là do sản lượng nước dùng tăng thêm tương ứng, mức dao động này nằm trong biên độ bình thường của gia đình.
   - **Mẫu câu thoại:**
     > *"Dạ, ở kỳ 7 này sản lượng nước nhà mình là 12 mét khối, tiền nước là 237 ngàn đồng. So với kỳ 6 trước đó, sản lượng chỉ tăng 2 mét khối (tương đương khoảng 20 phần trăm), tiền nước tăng thêm 39 ngàn đồng ạ. Mức sử dụng này vẫn ở mức dao động bình thường trong sinh hoạt gia đình, Quý khách hoàn toàn yên tâm ạ."*

2. **Cảnh báo tăng cao (Cần lưu ý):**
   - **Điều kiện:** Sản lượng tăng từ $31\%$ đến $50\%$ VÀ tăng từ $4\text{ m}^3$ trở lên.
   - **Logic giải thích:** Báo rõ mức tăng và nhắc khách rà soát lại nhu cầu sử dụng trong tháng (ví dụ có thêm người ở, giặt giũ, rửa dọn nhiều...).

3. **Bất thường (Nghi ngờ rò rỉ / hỏng thiết bị nước):**
   - **Điều kiện:** Sản lượng tăng $\ge 50\%$ VÀ tăng từ $5\text{ m}^3$ trở lên (hoặc sản lượng tăng gấp đôi).
   - **Logic giải thích:**
     - Cảnh báo mức tăng đột biến.
     - Hướng dẫn các nguyên nhân phổ biến: kẹt phao bồn cầu, rò rỉ van xả, nứt vỡ đường ống âm tường/âm nền sau đồng hồ.
     - Chủ động đề xuất hỗ trợ: Tạo phiếu yêu cầu nhân viên kỹ thuật xuống kiểm tra đồng hồ nước hoặc chuyển máy tổng đài viên.
   - **Mẫu câu thoại:**
     > *"Dạ, ở kỳ 7 này sản lượng của Quý khách là 25 mét khối, tiền nước là 540 ngàn đồng. So với kỳ trước chỉ 10 mét khối, sản lượng đã tăng đột biến 15 mét khối (tương đương 150 phần trăm), tiền nước tăng hơn 300 ngàn đồng ạ. Mức tăng này khá bất thường so với thường ngày. Quý khách vui lòng kiểm tra lại hệ thống đường ống sau đồng hồ và phao bồn chứa xem có bị rò rỉ hay không ạ. Nếu cần, em có thể hỗ trợ lập phiếu kiểm tra kỹ thuật giúp Quý khách ngay ạ."*

---

### GIAI ĐOẠN 2: Nâng cấp đa kỳ (Baseline 3 - 6 tháng gần nhất)

#### Vì sao cần giai đoạn này?
- Nếu tháng trước khách vắng nhà (sản lượng = 0 m³), tháng này dùng lại bình thường (10 m³) $\rightarrow$ Tỉ lệ tăng sẽ là vô cực hoặc tăng 1000%, nếu chỉ so với 1 kỳ trước sẽ bị kết luận nhầm là "bất thường".
- So sánh với **trung bình 3 - 6 kỳ gần nhất** ($SL_{TB}$) giúp xác định mức tiêu thụ chuẩn xác (Baseline).

#### Cách triển khai:
1. **Viết hàm lấy lịch sử 3 - 6 kỳ gần nhất:**
   - Sử dụng `Promise.all` gọi song song API `/san-luong` hoặc `/trang-thai-thanh-toan` lùi về 3 đến 6 tháng.
2. **Thuật toán đánh giá Baseline:**
   - Tính sản lượng trung bình:
     $$SL_{TB} = \frac{\sum_{i=1}^{n} SL_i}{n}$$
   - Đánh giá kỳ hiện tại $SL_{hientai}$:
     - **Bình thường:** $SL_{hientai} \le 1.3 \times SL_{TB}$.
     - **Bất thường:** $SL_{hientai} \ge 1.5 \times SL_{TB}$ và chênh lệch tuyệt đối $\ge 5\text{ m}^3$.

---

## 3. Các File Cần Chỉnh Sửa & Nội Dung Chi Tiết

### 3.1. [src/prompt.js](file:///Users/vovinhloc/myworking/customer/cnta/voice_bot/voice_bot_my_code/src/prompt.js)
Cập nhật mô tả của `tool_compare_usage` để model bắt được ý định của khách:
```javascript
export const tool_compare_usage = {
    type: "function",
    name: "compare_usage",
    description: `
    Mục đích:
      - Tra cứu so sánh sản lượng nước và tiền nước của kỳ này so với kỳ trước hoặc các kỳ gần nhất.
      - Đánh giá mức độ tăng/giảm (bình thường hay bất thường).
    Khi nào BẮT BUỘC gọi tool này:
      1. Khách thắc mắc hoặc phàn nàn về tiền nước tăng cao, ví dụ: "sao tiền nước tháng này nhiều quá", "sao nước lên nhiều vậy", "sao tiền nước đắt thế", "kiểm tra sao nước tăng vọt", "tháng này xài ít mà sao tiền nhiều".
      2. Khách yêu cầu so sánh mức dùng nước giữa các kỳ.
    `,
    parameters: {
        type: "object",
        properties: {
            ma_danh_bo: { type: "string", description: "mã danh bộ 11 chữ số" },
            ky: { type: "integer", description: "Kỳ cần kiểm tra (tùy chọn, bỏ trống nếu lấy kỳ gần nhất)" },
            nam: { type: "integer", description: "Năm cần kiểm tra (tùy chọn)" }
        },
        required: []
    }
};
```

### 3.2. [src/call-handle.js](file:///Users/vovinhloc/myworking/customer/cnta/voice_bot/voice_bot_my_code/src/call-handle.js)
Bổ sung vào phần `instructions` quy tắc nghiệp vụ rõ ràng:
```text
## QUY TẮC PHẢN ÁNH TIỀN NƯỚC TĂNG CAO / SO SÁNH SẢN LƯỢNG:
- Khi khách hàng phàn nàn hoặc thắc mắc: "sao tiền nước tháng này nhiều quá", "sao nước tăng vọt", "sao tháng này đắt thế":
  + TUYỆT ĐỐI KHÔNG chỉ gọi 'get_bill' để đọc số tiền đơn thuần.
  + BẮT BUỘC PHẢI GỌI TOOL 'compare_usage' để lấy thông tin so sánh tăng giảm và nguyên nhân.
  + Dựa vào kết quả tool trả về để giải thích rõ ràng cho khách biết: Sản lượng tăng bao nhiêu mét khối, tiền tăng bao nhiêu, và mức này là BÌNH THƯỜNG hay BẤT THƯỜNG.
```

### 3.3. [src/gpt.js](file:///Users/vovinhloc/myworking/customer/cnta/voice_bot/voice_bot_my_code/src/gpt.js)
Cập nhật `VERDICT_SCHEMA` và prompt phân tích mã danh bộ:
- Mở rộng enum intent: `'compare_usage'` bao gồm cả các phản ánh tiền nước tăng cao, thắc mắc sao tiền nước kỳ này nhiều.

### 3.4. [src/tool_handler/compare_usage.js](file:///Users/vovinhloc/myworking/customer/cnta/voice_bot/voice_bot_my_code/src/tool_handler/compare_usage.js)
Nâng cấp hàm `get_compare_usage`:
- Bổ sung logic tính ngưỡng tăng giảm (`PhanTramChenhLechSanLuong`, `TangGiamSanLuong`, `TangGiamTien`).
- Xây dựng trường `say_verbatim` với văn phong chăm sóc khách hàng:
  - Phân tích nguyên nhân: Tiền tăng là do số mét khối tiêu thụ tăng.
  - Phân loại rõ: Dao động bình thường vs Tăng cao bất thường.
  - Đưa ra lời khuyên kiểm tra rò rỉ nước (nếu tăng bất thường) và gợi ý tạo phiếu hỗ trợ kỹ thuật (`create_ticket`).

---

## 4. Bảng Kịch Bản & Câu Thoại Mẫu (Test Cases)

| Tình huống | Dữ liệu trả về | Phản hồi của Bot (`say_verbatim`) |
| :--- | :--- | :--- |
| **1. Tăng nhẹ (Bình thường)** | Kỳ trước: 10 m³, Kỳ này: 12 m³ (+2 m³, +20%) | *"Dạ, kỳ 7 này sản lượng nước nhà mình là 12 mét khối, tiền nước là 237 ngàn đồng. So với kỳ 6 là 10 mét khối, sản lượng tăng 2 mét khối, tương ứng 20 phần trăm, tiền nước tăng 39 ngàn đồng ạ. Mức dao động này là hoàn toàn bình thường trong sinh hoạt gia đình, Quý khách yên tâm nhé ạ."* |
| **2. Tăng đột biến (Bất thường)** | Kỳ trước: 10 m³, Kỳ này: 26 m³ (+16 m³, +160%) | *"Dạ, kỳ 7 này sản lượng nước của Quý khách là 26 mét khối, tiền nước là 580 ngàn đồng. So với kỳ trước chỉ 10 mét khối, sản lượng tăng đột biến tới 16 mét khối (tăng 160 phần trăm), tiền nước tăng thêm 350 ngàn đồng ạ. Mức tăng này khá bất thường so với thường ngày. Quý khách vui lòng kiểm tra lại hệ thống van xả, phao bồn cầu hoặc đường ống ngầm xem có bị rò rỉ không ạ. Nếu cần, em có thể lập phiếu để nhân viên kỹ thuật xuống kiểm tra đồng hồ giúp Quý khách ạ."* |
| **3. Giảm hoặc không đổi** | Kỳ trước: 15 m³, Kỳ này: 14 m³ (-1 m³) | *"Dạ, kỳ 7 này sản lượng nhà mình là 14 mét khối, tiền nước là 280 ngàn đồng. So với kỳ 6 thì sản lượng giảm 1 mét khối ạ. Quý khách có muốn em kiểm tra chi tiết hóa đơn kỳ nào khác không ạ?"* |
| **4. Chưa có dữ liệu kỳ hiện tại** | Error: `PRODUCTION_NOT_FOUND` | *"Dạ, hiện tại hệ thống chưa có dữ liệu sản lượng của kỳ này để so sánh. Em xin phép ghi nhận thông tin để hỗ trợ Quý khách sau ạ."* |
