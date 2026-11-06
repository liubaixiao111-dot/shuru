import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { secretPath } from "./paths";

/** 读取或生成 APP_SECRET（256 bit hex），持久化到 userData/secret.json */
export function readOrCreateSecret(): string {
  const p = secretPath();
  try {
    const obj = JSON.parse(fs.readFileSync(p, "utf8"));
    if (typeof obj.appSecret === "string" && obj.appSecret.length >= 32) {
      return obj.appSecret;
    }
  } catch {
    // 文件不存在或解析失败，下面会重新生成
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    JSON.stringify({ appSecret: secret, createdAt: new Date().toISOString() }, null, 2),
    { encoding: "utf8", mode: 0o600 },
  );
  return secret;
}
