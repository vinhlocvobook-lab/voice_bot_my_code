## dinh_muc_nuoc - ho_gia_dinh
Đăng ký số nhân khẩu để được tính định mức nước sinh hoạt theo quy định. 

** Thứ nhất, Trường hợp Có Căn cước công dân tại Thành Phố Hồ Chí Minh, không tính khu vực Bình Dương và Vũng Tàu cũ — giấy tờ BẮT BUỘC: Bản photo Căn cước công dân. 

** Thứ hai, Trường hợp Có Căn cước công dân ở tỉnh khác — kèm 
   CHỈ CẦN MỘT trong các giấy tờ sau: 
        + Xác nhận cư trú Xê-Tê-không-bảy hoặc Xê-Tê-không-tám tại địa chỉ muốn đăng ký; Thông tin cư trú trên ứng dụng Vi-en-e-ai-đi tại địa chỉ muốn đăng ký. 

** Thứ ba, Nộp hồ sơ qua: app Sa-qua-cô Xê-ét-ka-hát, hoặc trực tiếp tại văn phòng Tám bảy ba A Quang Trung, phường An Hội Tây, Thành Phố Hồ Chí Minh hoặc Năm trăm bốn mươi Hà Huy Giáp, phường An Phú Đông, Thành Phố Hồ Chí Minh."



,"quy_dinh":"
(GHI CHÚ NỘI BỘ — KHÔNG đọc khi hướng dẫn giấy tờ; chỉ dùng khi khách hỏi thêm về đối tượng hoặc số người được đăng ký) Thủ tục đăng ký định mức nước CHỈ áp dụng cho hộ gia đình, KHÔNG áp dụng cho doanh nghiệp hay công ty. 

Người có CCCD tại TP.HCM, không tính khu vực Bình Dương và Vũng Tàu cũ, chỉ cần bản photo CCCD. Người có CCCD ở tỉnh khác cần Xác nhận cư trú CT07 hoặc CT08, hoặc thông tin cư trú trên VNeID tại địa chỉ muốn đăng ký. 

Người KHÔNG chứng minh được cư trú tại địa chỉ thì KHÔNG được tính định mức. Số người đăng ký được = số người có giấy tờ chứng minh. 

Ví dụ: nhà 8 người, 4 có CCCD TP.HCM, 2 có xác nhận cư trú CT07/CT08 đầy đủ, 2 không có giấy tờ cư trú → đăng ký được 6 người; 2 người còn lại nên đăng ký cư trú trước rồi bổ sung sau.","giai_thich_thuat_ngu":"(GHI CHÚ NỘI BỘ — KHÔNG đọc khi hướng dẫn giấy tờ; chỉ dùng khi khách hỏi hoặc thắc mắc thuật ngữ, đọc NGẮN GỌN phần liên quan) Xê-Tê-không-bảy là Giấy xác nhận thông tin về cư trú, do Công an cấp xã/phường cấp theo mẫu của Bộ Công an, dùng để chứng minh nơi thường trú hoặc tạm trú của mình. Xê-Tê-không-tám là Thông báo kết quả giải quyết đăng ký cư trú (thường trú/tạm trú), cũng do công an cấp. Cách xin: đến trực tiếp Công an xã/phường bất kỳ (không phụ thuộc nơi cư trú), hoặc nộp online qua Cổng dịch vụ công Bộ Công an hay ứng dụng Vi-en-e-ai-đi — hoàn toàn miễn phí. 

Kết quả có trong khoảng nửa ngày đến 3 ngày làm việc. Giấy có giá trị 1 năm kể từ ngày cấp (riêng người chưa có nơi thường trú/tạm trú là 6 tháng); nếu thông tin cư trú thay đổi thì giấy hết giá trị từ lúc thay đổi.

▶ TEST 4: get_procedure_info_for_family
==========[handleGetProcedureInfo]==================
args: {"loai_thu_tuc":"dinh_muc_nuoc","doi_tuong":"ho_gia_dinh"}
loai_thu_tuc: dinh_muc_nuoc
doi_tuong: ho_gia_dinh
2. relevantCases_after_matching [
  {
    id: 'cccd_tphcm',
    label: 'Có CCCD tại TP.HCM, không tính khu vực Bình Dương và Vũng Tàu cũ',
    requiredDocs: { required: [Array] }
  },
  {
    id: 'cccd_tinh_khac',
    label: 'Có CCCD ở tỉnh khác',
    requiredDocs: {
      note: 'Cung cấp một trong các giấy tờ sau, tại địa chỉ muốn đăng ký',
      options: [Array]
    }
  }
]

  [TEST 4] 📤 Output gửi về OpenAI:
{
  type: 'conversation.item.create',
  item: {
    type: 'function_call_output',
    call_id: 'call_test_04',
    output: '{"success":true,"thuTuc":"Đăng ký định mức nước","so_phan_phai_doc":3,"say_verbatim":"Đăng ký số nhân khẩu để được tính định mức nước sinh hoạt theo quy định. Thứ nhất, Trường hợp Có Căn cước công dân tại Thành Phố Hồ Chí Minh, không tính khu vực Bình Dương và Vũng Tàu cũ — giấy tờ BẮT BUỘC: Bản photo Căn cước công dân. Thứ hai, Trường hợp Có Căn cước công dân ở tỉnh khác — kèm CHỈ CẦN MỘT trong các giấy tờ sau: Xác nhận cư trú Xê-Tê-không-bảy hoặc Xê-Tê-không-tám tại địa chỉ muốn đăng ký; Thông tin cư trú trên ứng dụng Vi-en-e-ai-đi tại địa chỉ muốn đăng ký. Thứ ba, Nộp hồ sơ qua: app Sa-qua-cô Xê-ét-ka-hát, hoặc trực tiếp tại văn phòng Tám bảy ba A Quang Trung, phường An Hội Tây, Thành Phố Hồ Chí Minh hoặc Năm trăm bốn mươi Hà Huy Giáp, phường An Phú Đông, Thành Phố Hồ Chí Minh.","quy_dinh":"(GHI CHÚ NỘI BỘ — KHÔNG đọc khi hướng dẫn giấy tờ; chỉ dùng khi khách hỏi thêm về đối tượng hoặc số người được đăng ký) Thủ tục đăng ký định mức nước CHỈ áp dụng cho hộ gia đình, KHÔNG áp dụng cho doanh nghiệp hay công ty. Người có CCCD tại TP.HCM, không tính khu vực Bình Dương và Vũng Tàu cũ, chỉ cần bản photo CCCD. Người có CCCD ở tỉnh khác cần Xác nhận cư trú CT07 hoặc CT08, hoặc thông tin cư trú trên VNeID tại địa chỉ muốn đăng ký. Người KHÔNG chứng minh được cư trú tại địa chỉ thì KHÔNG được tính định mức. Số người đăng ký được = số người có giấy tờ chứng minh. Ví dụ: nhà 8 người, 4 có CCCD TP.HCM, 2 có xác nhận cư trú CT07/CT08 đầy đủ, 2 không có giấy tờ cư trú → đăng ký được 6 người; 2 người còn lại nên đăng ký cư trú trước rồi bổ sung sau.","giai_thich_thuat_ngu":"(GHI CHÚ NỘI BỘ — KHÔNG đọc khi hướng dẫn giấy tờ; chỉ dùng khi khách hỏi hoặc thắc mắc thuật ngữ, đọc NGẮN GỌN phần liên quan) Xê-Tê-không-bảy là Giấy xác nhận thông tin về cư trú, do Công an cấp xã/phường cấp theo mẫu của Bộ Công an, dùng để chứng minh nơi thường trú hoặc tạm trú của mình. Xê-Tê-không-tám là Thông báo kết quả giải quyết đăng ký cư trú (thường trú/tạm trú), cũng do công an cấp. Cách xin: đến trực tiếp Công an xã/phường bất kỳ (không phụ thuộc nơi cư trú), hoặc nộp online qua Cổng dịch vụ công Bộ Công an hay ứng dụng Vi-en-e-ai-đi — hoàn toàn miễn phí. Kết quả có trong khoảng nửa ngày đến 3 ngày làm việc. Giấy có giá trị 1 năm kể từ ngày cấp (riêng người chưa có nơi thường trú/tạm trú là 6 tháng); nếu thông tin cư trú thay đổi thì giấy hết giá trị từ lúc thay đổi."}'
  }
}


