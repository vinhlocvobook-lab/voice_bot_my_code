import { log, log_sequenceDiagram } from "./logger.js";
import { get_so_danh_bo } from "./gpt.js"
import { getTrangThaiTT } from "./api.js"
const DIGIT_TO_VIETNAMESE = {
    '0': 'không',
    '1': 'một',
    '2': 'hai',
    '3': 'ba',
    '4': 'bốn',
    '5': 'năm',
    '6': 'sáu',
    '7': 'bảy',
    '8': 'tám',
    '9': 'chín'
};
/**
 * Chuyển số nguyên thành chữ tiếng Việt (xử lý đúng mốt/lăm/lẻ/không trăm)
 * Ví dụ: 428413 -> "bốn trăm hai mươi tám ngàn bốn trăm mười ba đồng"
 */
function docTienVN(n, useNgan = true) {
    const num = Math.round(Number(n));
    if (!isFinite(num)) return String(n);
    if (num === 0) return "không đồng";

    const ones = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    const unitThousand = useNgan ? " ngàn" : " nghìn";
    const units = ["", unitThousand, " triệu", " tỷ", " ngàn tỷ"];

    let v = Math.abs(num);
    const groups = [];
    while (v > 0) {
        groups.unshift(v % 1000);
        v = Math.floor(v / 1000);
    }

    const parts = [];
    groups.forEach((g, i) => {
        if (g === 0) return;
        const isFirst = parts.length === 0;
        const tr = Math.floor(g / 100);
        const ch = Math.floor((g % 100) / 10);
        const dv = g % 10;
        const w = [];

        if (tr > 0) w.push(ones[tr] + " trăm");
        else if (!isFirst) w.push("không trăm");

        if (ch > 1) {
            w.push(ones[ch] + " mươi");
            if (dv === 1) w.push("mốt");
            else if (dv === 5) w.push("lăm");
            else if (dv > 0) w.push(ones[dv]);
        } else if (ch === 1) {
            w.push("mười");
            if (dv === 5) w.push("lăm");
            else if (dv > 0) w.push(ones[dv]);
        } else if (dv > 0) {
            if (tr > 0 || !isFirst) w.push("lẻ");
            w.push(ones[dv]);
        }

        parts.push(w.join(" ") + units[groups.length - 1 - i]);
    });

    return (num < 0 ? "âm " : "") + parts.join(" ") + " đồng";
}

/**
 * Format chuỗi ngày "22/08/2026 06:42:04" hoặc "2026-08-22 ..." thành ngày tháng tự nhiên
 */
function formatNgayThanhToan(dateStr) {
    if (!dateStr) return "";
    // Bắt dạng DD/MM/YYYY
    const m1 = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m1) return `ngày ${parseInt(m1[1], 10)} tháng ${parseInt(m1[2], 10)} năm ${m1[3]}`;

    // Bắt dạng YYYY-MM-DD
    const m2 = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m2) return `ngày ${parseInt(m2[3], 10)} tháng ${parseInt(m2[2], 10)} năm ${m2[1]}`;

    return dateStr;
}

/**
 * Đọc số lượng/sản lượng (vd: 24 -> "hai mươi bốn mét khối")
 */
function docSanLuong(sl) {
    const num = Number(sl);
    if (isNaN(num)) return `${sl} mét khối`;
    // Với số nhỏ (dưới 1000 khối), có thể đọc thành chữ hoặc để rõ "X mét khối"
    if (num === 0) return "không mét khối";
    const ones = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    if (num < 10) return `${ones[num]} mét khối`;
    if (num < 20) return `mười ${num === 15 ? 'lăm' : (ones[num % 10] || '')} mét khối`.trim();
    if (num < 100) {
        const ch = Math.floor(num / 10);
        const dv = num % 10;
        let chu = `${ones[ch]} mươi`;
        if (dv === 1) chu += " mốt";
        else if (dv === 5) chu += " lăm";
        else if (dv > 0) chu += ` ${ones[dv]}`;
        return `${chu} mét khối`;
    }
    return `${num} mét khối`;
}


function format_danh_bo_voice_old(s) {
    if (!s || s.length !== 11) return s;
    return `${s.slice(0, 4).split('').join(' ')}, ${s.slice(4, 8).split('').join(' ')}, ${s.slice(8).split('').join(' ')}`;
}
function format_danh_bo_voice(s) {
    if (!s) return s;
    const clean = String(s).replace(/\D/g, "");
    if (clean.length !== 11) return s;
    // Chuyển từng cụm số thành chữ
    const toWords = (str) => str.split('').map(d => DIGIT_TO_VIETNAMESE[d] || d).join(' ');
    const cum1 = toWords(clean.slice(0, 4)); // 4 số đầu: "hai hai không hai"
    const cum2 = toWords(clean.slice(4, 8)); // 4 số giữa: "ba hai năm một"
    const cum3 = toWords(clean.slice(8, 11)); // 3 số cuối: "bảy bảy năm"
    return `${cum1} - ${cum2} - ${cum3}`;
}
async function get_trang_thai_thanh_toan_old1(function_event, asteriskData, send_message) {
    const { name, event_id, response_id, item_id, output_index, call_id, arguments: function_arg } = function_event;
    const args = JSON.parse(function_arg || "{}");
    let { ma_danh_bo, ky, nam } = args;
    console.log("[tools][get_trang_thai_thanh_toan] ma_danh_bo: ", { ma_danh_bo: asteriskData.ma_danh_bo, ky, nam });

    // nếu ky là null hoặc '' thì cài đặc mặc định là tháng hiện tại
    if (!ky || ky == null || ky == "" || ky == "undefined") {
        const now = new Date();
        ky = now.getMonth() + 1;
        nam = now.getFullYear();
    }
    //nếu nam là null hoặc '' thì cài đặt mặc định là năm hiện tại
    if (!nam || nam == null || nam == "" || nam == "undefined") {
        const now = new Date();
        nam = now.getFullYear();
    }
    console.log("\n\r \n\r [tools][get_trang_thai_thanh_toan] arguments: ", { ma_danh_bo: asteriskData.ma_danh_bo, ky, nam });
    const kq = await getTrangThaiTT(asteriskData.ma_danh_bo, ky, nam);
    console.log("\n\r \n\r [tools][get_trang_thai_thanh_toan] kq: ", kq);
    if (kq.success) {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    data: kq,
                }),
            }
        })
        console.log("[tools][get_trang_thai_thanh_toan] kq: ", kq);
        send_message({
            type: "response.create",
            response: { instructions: `trả lời thông tin theo data nhận được ` }
        })
    } else {
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: false,
                    error: kq.message,
                }),
            }
        })
        send_message({
            type: "response.create",
            response: { instructions: `trả lời thông tin theo data nhận được ` }
        })
    }
}
async function get_trang_thai_thanh_toan(function_event, asteriskData, send_message) {
    const { call_id, arguments: function_arg } = function_event;
    const args = JSON.parse(function_arg || "{}");
    let { ky, nam } = args;

    // Nếu kỳ/năm trống, mặc định là tháng/năm hiện tại
    const now = new Date();
    if (!ky || ky == "" || ky == "undefined") {
        ky = now.getMonth() + 1;
    }
    if (!nam || nam == "" || nam == "undefined") {
        nam = now.getFullYear();
    }

    console.log("[tools][get_trang_thai_thanh_toan] arguments: ", { ma_danh_bo: asteriskData.ma_danh_bo, ky, nam });
    const kq = await getTrangThaiTT(asteriskData.ma_danh_bo, ky, nam);
    console.log("[tools][get_trang_thai_thanh_toan] kq: ", kq);

    if (kq && kq.success && Array.isArray(kq.data) && kq.data.length > 0) {
        // Chuẩn hóa và chuyển các trường số thành chữ
        const items = kq.data.map(item => {
            const daThanhToan = item.TrangThaiThanhToan === "Đã thanh toán";
            const tongTienChu = docTienVN(item.TongTien);
            const sanLuongChu = docSanLuong(item.SanLuong);
            const ngayThanhToanText = daThanhToan ? formatNgayThanhToan(item.NgayThanhToan) : "";

            let cauThoai = `Dạ, tiền nước kỳ ${item.Ky} năm ${item.Nam} của quý khách có sản lượng là ${sanLuongChu}, tổng tiền là ${tongTienChu}. `;
            if (daThanhToan) {
                cauThoai += `Hóa đơn đã được thanh toán${item.DonViThanhToan ? ` qua ${item.DonViThanhToan}` : ""}${ngayThanhToanText ? ` vào ${ngayThanhToanText}` : ""} ạ.`;
            } else {
                cauThoai += `Hiện tại hóa đơn này chưa thanh toán ạ.`;
            }

            return {
                ky: item.Ky,
                nam: item.Nam,
                tong_tien_so: item.TongTien,
                tong_tien_chu: tongTienChu,
                san_luong: item.SanLuong,
                san_luong_chu: sanLuongChu,
                trang_thai_thanh_toan: item.TrangThaiThanhToan,
                ngay_thanh_toan: ngayThanhToanText,
                don_vi_thanh_toan: item.DonViThanhToan,
                cau_thoai_doc: cauThoai
            };
        });

        const cauTraLoiChinh = items.map(i => i.cau_thoai_doc).join(" ");

        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: true,
                    message: "Tra cứu thông tin thành công.",
                    cau_tra_loi: cauTraLoiChinh,
                    chi_tiet: items
                }),
            }
        });

        send_message({
            type: "response.create",
            response: {
                instructions: `Đọc câu trả lời cho khách theo nội dung sau, đọc đúng các từ ngữ viết bằng chữ, không tự chuyển đổi ngược lại thành con số: "${cauTraLoiChinh}"`
            }
        });

    } else {
        // Trường hợp không có dữ liệu hoặc success = false
        const thongBaoLoi = `Dạ, hiện tại hệ thống chưa có dữ liệu sản lượng và tiền nước của kỳ ${ky} năm ${nam} ạ.`;

        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: call_id,
                output: JSON.stringify({
                    success: false,
                    error_code: kq?.error_code || "NOT_FOUND",
                    message: kq?.message || "Chưa có thông tin kỳ này.",
                    cau_tra_loi: thongBaoLoi
                }),
            }
        });

        send_message({
            type: "response.create",
            response: {
                instructions: `Đọc câu thông báo cho khách: "${thongBaoLoi}"`
            }
        });
    }
}

//mã danh bộ là 11 chữ số
function valid_ma_danh_bo(ma_danh_bo) {

    if (typeof ma_danh_bo == "number") {
        ma_danh_bo = String(ma_danh_bo);
    }
    else {
        //chỉ giữ lại số
        ma_danh_bo = ma_danh_bo.replace(/\D/g, "");
    }
    if (typeof ma_danh_bo == "string") {
        if (ma_danh_bo.length != 11) {
            throw new Error("Mã danh bộ là 11 chữ số, vui lòng đọc lại mã danh bộ !");
        } else if (!/^[0-9]{11}$/.test(ma_danh_bo)) {
            throw new Error("Mã danh bộ là 11 chữ số, vui lòng đọc lại mã danh bộ !");
        } else {
            return ma_danh_bo;
        }
    }
    throw new Error("Mã danh bộ là 11 chữ số, vui lòng đọc lại mã danh bộ !");
}
function sdb_doc_mdb_chua_co_v0(function_event, send_message) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: false,
                error: "Chưa có mã danh bộ",
                message: "cần nhờ khách hàng đọc mã danh bộ"
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Đọc câu chính xác câu và không thêm bất cứ lời dẫn dắt nào khác : "Dạ, Quý khách vui lòng đọc mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quãng giúp em ạ ! "` }
    })
}
function sdb_doc_mdb_chua_co(function_event, send_message) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                status: "chưa có mã danh bộ",
                next_step: "chưa có mã danh bộ, nên cần khách hàng cung cấp mã danh bộ",
                say_verbatim: "Dạ, Quý khách vui lòng đọc mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quãng giúp em ạ !"
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
    })
}
function sdb_doc_mdb_sai(function_event, send_message) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                status: "Mã danh bộ trước đó bị sai",
                next_step: "cần khách hàng cung cấp lại mã danh bộ",
                say_verbatim: `Dạ, em xin lỗi! Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quãng giúp em ạ !`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
    })

}
function sdb_chuaro(function_event, send_message, mdb_gpt) {
    if (typeof mdb_gpt == "undefined" || mdb_gpt == null || mdb_gpt == "") {
        sdb_doc_mdb_chua_co(function_event, send_message)
        return;
    }
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                ma_danh_bo: mdb_gpt,
                status: "Cần khách đọc lại mã danh bộ để xác nhận",
                say_verbatim: `Dạ, Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắn quảng giúp em ạ !`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
    })

}
function sdb_vanchuaro(function_event, send_message, mdb_gpt) {
    if (typeof mdb_gpt == "undefined" || mdb_gpt == null || mdb_gpt == "") {
        sdb_doc_mdb_chua_co(function_event, send_message)
        return;
    }
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                status: "chưa nghe rõ số danh bộ",
                ma_danh_bo: mdb_gpt,
                next_step: "Cần khách đọc lại mã danh bộ để xác nhận",
                say_verbatim: `Dạ, Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quảng giúp em một lần nữa nhé!`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
    })

}
function sdb_mdb_chua_dung(function_event, send_message, mdb_gpt) {
    if (typeof mdb_gpt == "undefined" || mdb_gpt == null || mdb_gpt == "") {
        sdb_doc_mdb_chua_co(function_event, send_message)
        return;
    }
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                ma_danh_bo: mdb_gpt,
                status: "mã danh bộ chưa đúng",
                next_step: "cần khách đọc lại mã danh bộ",
                say_verbatim: `Dạ, em nghe chưa được, Quý khách vui lòng đọc lại mã danh bộ, 11 chữ số, đọc liên tục, liền mạch, không ngắt quảng giúp em một lần nữa nhé!`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Nói nguyên văn trường "say_verbatim" trong kết quả tool vừa nhận được` }
    })

}
function sdb_doc_xacnhan_v0(function_event, send_message, ma_danh_bo) {
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: false,
                error: "Chưa xác nhận số danh bộ",
                ma_danh_bo: ma_danh_bo,
                note: `mã danh bộ cần khách hàng xác nhận là ${ma_danh_bo}`,
                message: `cần khách hàng xác nhận số danh bộ ${ma_danh_bo} có đúng hay không?"`
            }),
        }
    })
    send_message({
        type: "response.create",
        response: { instructions: `Đọc câu chính xác câu để khách hàng xác nhận và không thêm bất cứ lời dẫn dắt nào khác: "Dạ, Mã danh bộ của quý khách là ${format_danh_bo_voice(ma_danh_bo)}, quý khách xác nhận giúp em có đúng không ạ!"` }
    })

}
function sdb_doc_xacnhan(function_event, send_message, ma_danh_bo) {
    const loi_thoai = `Dạ, Mã danh bộ của quý khách là "${format_danh_bo_voice(ma_danh_bo)}", quý khách xác nhận giúp em có đúng không ạ!`;
    send_message({
        type: "conversation.item.create",
        item: {
            type: "function_call_output",
            call_id: function_event.call_id,
            output: JSON.stringify({
                success: true,
                next_step: "Cần khách hàng xác nhận mã danh bộ",
                ma_danh_bo: ma_danh_bo,
                note: `mã danh bộ cần khách hàng xác nhận là ${ma_danh_bo}`,
                message: loi_thoai,
            }),
        }
    })
    send_message({
        type: "response.create",
        response: {
            instructions: `Nói nguyên văn trường "message" trong kết quả tool vừa nhận được`
        }
    })

}

export async function get_bill_handler(function_event, asteriskData, send_message) {

    let ma_danh_bo = "";
    let { name, event_id, response_id, item_id, output_index, call_id, arguments: function_arg } = function_event;
    const args = JSON.parse(function_arg || "{}");
    const { ma_danh_bo: mdb_arg, ky, nam } = args;
    const kq_get_so_danh_bo = await get_so_danh_bo(asteriskData);

    console.log("\n\r \n\r\n \r [tools][get_bill_handler] kq_get_so_danh_bo: ", kq_get_so_danh_bo);
    console.log(" [function_event]: ", function_event);
    console.log("\n\r \n\r");
    const { ma_danh_bo: mdb_gpt, xac_nhan, do_tin_cay, ly_do } = kq_get_so_danh_bo



    try {
        if (mdb_gpt == "" || mdb_gpt == null || mdb_gpt == "undefined") {
            console.log("\n\r n\r 0./ Mã Danh Bộ chưa có nên cần nhờ khách hàng đọc mã danh bộ", { mdb_gpt });
            sdb_doc_mdb_chua_co(function_event, send_message)
            return;
        }
        ma_danh_bo = valid_ma_danh_bo(mdb_gpt);
    }
    catch (error) {
        console.log("\n\r n\r 1./ Mã Danh Bộ không hợp lệ nên cần đọc lại", { mdb_gpt });
        if (xac_nhan && xac_nhan == "sai") {
            sdb_doc_mdb_sai(function_event, send_message)
            asteriskData.ma_danh_bo_count++;
            asteriskData.ma_danh_bo_phase = 2;
            return;
        }
        sdb_mdb_chua_dung(function_event, send_message, mdb_gpt);
        asteriskData.ma_danh_bo_count++;
        asteriskData.ma_danh_bo_phase = 2;
        return;
    }
    // mdb_gpt hợp lệ
    if (asteriskData.ma_danh_bo == "") {
        // chưa có mã danh bộ đã confirmed
        if (asteriskData.ma_danh_bo_checking == "") {
            //chưa có mã danh bộ cần kiểm tra
            sdb_doc_xacnhan(function_event, send_message, mdb_gpt);
            asteriskData.ma_danh_bo_checking = mdb_gpt;
            asteriskData.ma_danh_bo_count++;
            asteriskData.ma_danh_bo_phase = 3; // chuyển sang giai đoạn nhờ khách hàng đọc lại mã danh bộ
            return;
        }
        else if (mdb_gpt == asteriskData.ma_danh_bo_checking) {
            asteriskData.ma_danh_bo_confirmed = true;
            asteriskData.ma_danh_bo = mdb_gpt;
            asteriskData.ma_danh_bo_phase = 4;
            console.log("6./ mã danh bộ hợp lệ, phase 3, Đã confirmed, chuyển sang giai đoạn get_trang_thai_thanh_toan", { mdb_gpt });
            get_trang_thai_thanh_toan(function_event, asteriskData, send_message);
            return;
        } else {
            console.log("7./ mã danh bộ hợp lệ, Đọc lại vì không khớp với mã danh bộ cần kiểm tra", { mdb_gpt });
            sdb_doc_xacnhan(function_event, send_message, mdb_gpt);
            asteriskData.ma_danh_bo_checking = mdb_gpt;
            asteriskData.ma_danh_bo_count++;
            asteriskData.ma_danh_bo_phase = 3; // chuyển sang giai đoạn nhờ khách hàng đọc lại mã danh bộ
            return;
        }
    }
    else {
        //mã danh bộ đã xác nhận
        if (asteriskData.ma_danh_bo == mdb_gpt) {
            //đã confirmed
            asteriskData.ma_danh_bo_confirmed = true;
            asteriskData.ma_danh_bo = mdb_gpt;
            asteriskData.ma_danh_bo_phase = 4;
            console.log("8./ mã danh bộ hợp lệ, phase 4, Đã confirmed & khớp, chuyển sang giai đoạn get_trang_thai_thanh_toan", { mdb_gpt });
            get_trang_thai_thanh_toan(function_event, asteriskData, send_message);
            return;

        } else {
            // mã danh bộ khác với mã danh bộ cần kiểm tra
            // thực hiện quy trình xác nhận lại
            console.log("9./ mã danh bộ hợp lệ, phase 4, Đã confirmed & không khớp, Đọc lại để xac nhận", { mdb_gpt });
            sdb_doc_xacnhan(function_event, send_message, mdb_gpt);
            asteriskData.ma_danh_bo_checking = mdb_gpt;
            asteriskData.ma_danh_bo_count++;
            asteriskData.ma_danh_bo_phase = 3; // chuyển sang giai đoạn nhờ khách hàng đọc lại mã danh bộ
            return;
        }
    }
}
export function tool_wait_for_user_handler(function_event, asteriskData, send_message) {
    let { name, event_id, response_id, item_id, output_index, call_id, arguments: function_arg } = function_event;

    const outputMessage = {
        type: "conversation.item.create",
        item: {
            type: "function_callq_output",
            call_id: call_id,
            output: JSON.stringify({ status: "acknowledged", action: "waiting_for_user" }),
        },
    };
    log.info(`[Tool][wait_for_user] Nhận diện tạp âm/ chờ người dùng(call_id: ${call_id}).Giữ im lặng, không trigger response.`);
    log_sequenceDiagram(`Code-- >> OpenAI: conversation.item.create(function_call_output: wait_for_user)`, asteriskData?.fileName);

    send_message(outputMessage);

}
export function tool_function_handler(function_event, asteriskData, send_message) {

    if (function_event.name == "get_bill") {
        return get_bill_handler(function_event, asteriskData, send_message);
    }
    else if (function_event.name == "wait_for_user") {
        return tool_wait_for_user_handler(function_event, asteriskData, send_message);
    } else {
        log.warn(`[Tool] Chưa có handler cho tool: ${function_event.name}(call_id: ${function_event.call_id})`);
        // Phản hồi tạm để OpenAI không bị treo
        send_message({
            type: "conversation.item.create",
            item: {
                type: "function_call_output",
                call_id: function_event.call_id,
                output: JSON.stringify({ status: "not_implemented", message: `Tính năng ${function_event.name} đang được nâng cấp.` })
            }
        });
        send_message({ type: "response.create" });
    }
}