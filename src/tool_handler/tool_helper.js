export const DIGIT_TO_VIETNAMESE = {
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
export function docTienVN(n, useNgan = true) {
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
export function formatNgayThanhToan(dateStr) {
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
export function docSanLuong(sl) {
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
export function format_danh_bo_voice(s) {
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
// mã danh bộ là 11 chữ số
export function valid_ma_danh_bo(ma_danh_bo) {
    if (!ma_danh_bo) return null;
    const clean = String(ma_danh_bo).replace(/\D/g, "");
    return clean.length === 11 ? clean : null;
}