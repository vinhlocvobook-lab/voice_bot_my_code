/**
 * logger.js – Minimal logger với level filtering.
 */

import path from "path";
import fs from "fs";
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

export const log = {
  debug: (...a) => currentLevel <= 0 && console.debug(...format("debug", a)),
  info: (...a) => currentLevel <= 1 && console.info(...format("info", a)),
  warn: (...a) => currentLevel <= 2 && console.warn(...format("warn", a)),
  error: (...a) => currentLevel <= 3 && console.error(...format("error", a)),
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
