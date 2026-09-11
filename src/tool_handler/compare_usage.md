
## có số liệu

 {
  success: true,
  message: 'Lấy dữ liệu so sánh tăng giảm thành công.',
  data: {
    DanhBa: '15122890724',
    KyNay: '7/2026',
    KyTruoc: '6/2026',
    ThongTinKyNay: { SanLuong: 12, TienNuoc: 237427 },
    ThongTinKyTruoc: { SanLuong: 10, TienNuoc: 197856 },
    SoSanhTangGiam: {
      TangGiamSanLuong: 2,
      TangGiamTien: 39571,
      TrangThaiSanLuong: 'Tăng',
      TrangThaiTien: 'Tăng',
      PhanTramChenhLechSanLuong: 20
    }
  }
}
"say_verbatim":"Dạ, ở kỳ 7 năm 2026, sản lượng nước của Quý khách có mã danh bộ là một năm một hai - hai tám chín không - bảy hai bốn là mười hai mét khối, tiền nước là hai trăm ba mươi bảy ngàn bốn trăm hai mươi bảy đồng. So với kỳ 6 năm 2026, sản lượng nước tăng hai mét khối, tương đương 20 phần trăm, tiền nước tăng ba mươi chín ngàn năm trăm bảy mươi mốt đồng. Quý khách có cần em hỗ trợ gì thêm không ạ?",
## Không có số liệu kỳ hiện tại
{
  success: false,
  error_code: 'PRODUCTION_NOT_FOUND',
  message: 'Chưa có dữ liệu sản lượng cho kỳ 10/2026.',
  data: null
}
"say_verbatim":"Dạ, hiện tại hệ thống chưa có dữ liệu sản lượng của kỳ 10 năm 2026 cho số danh bộ một năm một hai - hai tám chín không - bảy hai bốn để so sánh ạ. Quý khách có cần em hỗ trợ gì thêm không ạ?"

## không có số danh bộ
{
  success: false,
  error_code: 'CUSTOMER_NOT_FOUND',
  message: 'Không tìm thấy thông tin khách hàng.',
  data: null
}
"say_verbatim":"Dạ, hệ thống không tìm thấy thông tin khách hàng với mã danh bộ 151228907241 ạ. Quý khách vui lòng kiểm tra và đọc lại số danh bộ giúp em ạ!

## lỗi kết nối
 {
  success: false,
  error_code: 'CONNECTION_ERROR',
  message: 'Không kết nối được tới máy chủ.',
  data: null
}
"say_verbatim":"Dạ, hiện tại hệ thống tra cứu đang gián đoạn kết nối. Quý khách vui lòng liên hệ lại sau ít phút giúp em ạ!"