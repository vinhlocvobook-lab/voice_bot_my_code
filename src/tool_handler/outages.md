
# Lấy thông tin thành công
## Không nằm trong vùng sự cố
{
  success: true,
  message: 'Lấy thông tin cúp nước thành công.',
  data: {
    coSuCo: false,
    thongBao: 'Khách hàng không nằm trong vùng bị sự cố.',
    thoiGianDuKienHoanThanh: ''
  }
}

## Có nằm trong vùng sự cố
{
    "success": true,
    "message": "Lấy thông tin cúp nước thành công.",
    "data": {
        "coSuCo": true,
        "thongBao": "Khách hàng nằm trong vùng bị sự cố.",
        "thoiGianDuKienHoanThanh": "22/05/2026 16:00"
    }
}

# lấy thôgn tin không thành công
## không tìm thấy thông tin khách hàng
{
  success: false,
  error_code: 'CUSTOMER_NOT_FOUND',
  message: 'Không tìm thấy thông tin khách hàng.',
  data: null
}

## lỗi kết nối
 {
  success: false,
  error_code: 'CONNECTION_ERROR',
  message: 'Không kết nối được tới máy chủ.',
  data: null
}

