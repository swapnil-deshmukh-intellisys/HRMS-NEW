import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIRS = [
  path.resolve(__dirname, "../../uploads"),
  path.resolve(__dirname, "../../uploads/leaves"),
  path.resolve(__dirname, "../../uploads/documents"),
];

export function initDirectories() {
  console.log("Initializing directories...");
  for (const dir of DIRS) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    } catch (error) {
      console.error(`Failed to create directory ${dir}:`, error);
      // In production, we might want to exit if critical directories are missing
      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }
    }
  }
}
