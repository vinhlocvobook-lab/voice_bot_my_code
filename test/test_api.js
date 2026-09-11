//viết code test các hàm api trong file api.js
import "dotenv/config";
import {
    getTrangThaiTT, getThongBaoCupNuoc
} from "../src/api.js";

let ma_danh_bo = "22023251775";
ma_danh_bo = "151228907241";
const kq = await getThongBaoCupNuoc(ma_danh_bo);
console.log(kq);
// vovinhloc @MacBook-Pro - cua - Vo voice_bot_my_code % node test / test_api.js
// [2026-09-06T17:10:02.298+07:00] [WARN] [API] TONGDAI_API_INSECURE_TLS=true — BỎ QUA xác thực chứng chỉ TLS khi gọi api.php (chỉ dùng cho self-signed cert nội bộ).
// [2026-09-06T17:10:02.308+07:00] [ERROR] [API] Lỗi gọi https://127.0.0.1:34443/cntaapi1/api.php/cup-nuoc?danhba=22023251775: fetch failed — nguyên nhân: ECONNREFUSED connect ECONNREFUSED 127.0.0.1:34443 (8ms)
// {
//   success: false,
//   error_code: 'CONNECTION_ERROR',
//   message: 'Không kết nối được tới máy chủ.',
//   data: null
// }

// {
//   success: false,
//   error_code: 'CUSTOMER_NOT_FOUND',
//   message: 'Không tìm thấy thông tin khách hàng.',
//   data: null
// }

// vovinhloc@MacBook-Pro-cua-Vo voice_bot_my_code % node test/test_api.js
// [2026-09-06T17:10:53.876+07:00] [WARN] [API] TONGDAI_API_INSECURE_TLS=true — BỎ QUA xác thực chứng chỉ TLS khi gọi api.php (chỉ dùng cho self-signed cert nội bộ).
// [2026-09-06T17:10:56.064+07:00] [INFO] [API] GET /cup-nuoc → 200 (2185ms)
// {
//   success: true,
//   message: 'Lấy thông tin cúp nước thành công.',
//   data: {
//     coSuCo: false,
//     thongBao: 'Khách hàng không nằm trong vùng bị sự cố.',
//     thoiGianDuKienHoanThanh: ''
//   }
// }

