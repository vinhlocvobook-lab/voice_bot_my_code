/**
 * logger.js – Minimal logger với level filtering.
 */

import path from "path";
import fs from "fs";
import util from "util";
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || "info"] ?? 1;

// Múi giờ Việt Nam (GMT+7) – hiển thị log console theo giờ địa phương
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
function _nowGmt7() {
  return new Date(Date.now() + TZ_OFFSET_MS).toISOString().replace("Z", "+07:00");
}

function format(level, args) {
  const ts = _nowGmt7();
  return [`[${ts}] [${level.toUpperCase()}]`, ...args];
}

/**
 * Hàm log vừa in ra console vừa lưu vào file theo ngày: logs/YYYY/MM/DD/<fileName>
 * Chạy đồng nhất trên cả máy local và server.
 * 
 * @param {string} fileName - Tên file (ví dụ: "14_30_15_abc123.txt" hoặc asteriskData.fileName)
 * @param {...any} args - Nội dung cần log (chuỗi, object, error,...)
 */
export function log_with_file(fileName, ...args) {
  if (!fileName) {
    console.warn("[Logger] fileName is required for log_with_file!");
    return;
  }
  const nowDate = new Date(Date.now() + TZ_OFFSET_MS);
  const year = nowDate.getUTCFullYear();
  const month = String(nowDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(nowDate.getUTCDate()).padStart(2, "0");
  // Đảm bảo file có đuôi .txt nếu chưa có extension
  let safeFileName = fileName;
  if (!path.extname(safeFileName)) {
    safeFileName += ".txt";
  }
  // 1. Tạo thư mục logs/YYYY/MM/DD/ (tự động tạo trên local hoặc server)
  const logFolder = path.join(process.cwd(), "logs", "debug", String(year), month, day);
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder, { recursive: true });
  }
  const filePath = path.join(logFolder, safeFileName);
  // 2. Format thời gian timestamp GMT+7
  const timeStr = _nowGmt7();
  // 3. In ra màn hình console
  console.log(`[${timeStr}]:`, ...args);
  // 4. Lưu vào file log (dùng util.format để object không bị biến thành [object Object])
  try {
    const formattedContent = util.format(...args);
    const logLine = `[${timeStr}] ${formattedContent}\n`;
    fs.appendFileSync(filePath, logLine, "utf8");
  } catch (err) {
    console.error("[Logger] Lỗi khi ghi file log:", err.message);
  }
}

export const log = {
  debug: (...a) => currentLevel <= 0 && console.debug(...format("debug", a)),
  info: (...a) => currentLevel <= 1 && console.info(...format("info", a)),
  warn: (...a) => currentLevel <= 2 && console.warn(...format("warn", a)),
  error: (...a) => currentLevel <= 3 && console.error(...format("error", a)),
  dir: (...a) => {
    if (currentLevel <= 1) { // hoặc currentLevel <= 0 nếu chỉ muốn bật khi debug
      console.info(...format("dir", []));
      a.forEach((item) => console.dir(item, { depth: null, colors: true }));
    }
  },
};

export function log_to_file(content, from) {
  const now = new Date();

  const formattedTime = now.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    // year: "numeric",
    // month: "2-digit",
    // day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false // Định dạng 24 giờ
  });

  let logFolder = "logs"
  let fileName = new Date().toISOString().split("T")[0] + ".txt"
  let filePath = path.join(logFolder, fileName)
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder, { recursive: true })
  }
  let prefix = ""
  if (from) {
    prefix = "[" + formattedTime + " - " + from + "] : "
  }

  fs.appendFileSync(filePath, prefix + content + "\n")

}
export function log_sequenceDiagram(content, fileName) {
  const now = new Date();
  //tạo folder theo cấu trúc YYYY/MM/DD
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = now.getDate();
  let logFolder = path.join("logs", "sequenceDiagram", String(year), String(month), String(day));
  if (!fileName) {
    console.log("fileName is required!")
    return;
  }
  let filePath = path.join(logFolder, fileName)
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder, { recursive: true })
  }
  let lines = content.replace(/\t/g, "    ").split("\n");
  let formattedLines = lines.map((line) => {
    let trimmed = line.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("sequenceDiagram")) return trimmed;
    return "    " + trimmed;
  }).join("\n");

  fs.appendFileSync(filePath, formattedLines + "\n");
}
export function log_conversation(content, fileName) {
  const now = new Date();
  //tạo folder theo cấu trúc YYYY/MM/DD
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = now.getDate();
  let logFolder = path.join("logs", "conversations", String(year), String(month), String(day));
  if (!fileName) {
    console.log("fileName is required!")
    return;
  }
  let filePath = path.join(logFolder, fileName)
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder, { recursive: true })
  }
  const formattedTime = now.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    // year: "numeric",
    // month: "2-digit",
    // day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false // Định dạng 24 giờ
  });

  let prefix = ""

  prefix = "[" + formattedTime + "] : "


  fs.appendFileSync(filePath, prefix + content + "\n")
}
