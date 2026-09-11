
# ============================
# success :True
## đã thanh toán 
[tools][get_trang_thai_thanh_toan] kq:  {
  success: true,
  message: 'Lấy thông tin trạng thái thanh toán thành công.',
  data: [
    {
      Nam: 2026,
      Ky: 7,
      TongTien: 237427,
      SanLuong: 12,
      TrangThaiThanhToan: 'Đã thanh toán',
      NgayThanhToan: '22/07/2026 14:13:53',
      DonViThanhToan: 'PAYO'
    }
  ]
}

## chưa thanh toán
[tools][get_trang_thai_thanh_toan] kq:  {
  success: true,
  message: 'Lấy thông tin trạng thái thanh toán thành công.',
  data: [
    {
      Nam: 2026,
      Ky: 9,
      TongTien: 257213,
      SanLuong: 13,
      TrangThaiThanhToan: 'Chưa thanh toán',
      NgayThanhToan: '',
      DonViThanhToan: ''
    }
  ]
}
# success : False
## chưa có thông tin sản lượng
[tools][get_trang_thai_thanh_toan] kq:  {
  success: false,
  error_code: 'PRODUCTION_NOT_FOUND',
  message: 'Chưa có sản lượng kỳ này.',
  data: null
}


## không kết nối được tới máy chủ.
[tools][get_trang_thai_thanh_toan] arguments:  { ma_danh_bo: '15122890724', ky: 7, nam: 2026 }
[2026-09-09T14:40:53.937+07:00] [ERROR] [API] Lỗi gọi http://127.0.0.1:7700/api.php/trang-thai-thanh-toan?danhba=15122890724&ky=7&nam=2026: fetch failed — nguyên nhân: ECONNREFUSED connect ECONNREFUSED 127.0.0.1:7700 (4ms)
[tools][get_trang_thai_thanh_toan] kq:  {
  success: false,
  error_code: 'CONNECTION_ERROR',
  message: 'Không kết nối được tới máy chủ.',
  data: null
}

## không tìm thấy khách hàng.

[tools][get_trang_thai_thanh_toan] kq:  {
  success: false,
  error_code: 'CUSTOMER_NOT_FOUND',
  message: 'Không tìm thấy thông tin khách hàng.',
  data: null
}