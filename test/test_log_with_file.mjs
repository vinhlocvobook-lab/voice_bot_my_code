//test log_with_file
import "dotenv/config";
import { log_with_file } from "../src/logger.js";
const filename = "test_log_with_file.txt";
log_with_file(filename, { message: "Hello, World!" });