import { app } from "electron";
import path from "node:path";

/** 开发模式：未打包。比 ELECTRON_IS_DEV 更可靠 */
export const isDev = !app.isPackaged;

/** userData 目录（Win 下 %APPDATA%/<productName>，由 appId 决定） */
export function userDataDir(): string {
  return app.getPath("userData");
}

/** SQLite 数据库文件路径 */
export function dbPath(): string {
  return path.join(userDataDir(), "data.db");
}

/** Prisma datasource url，Windows 上需正斜杠 */
export function databaseUrl(): string {
  return `file:${dbPath().replace(/\\/g, "/")}`;
}

/** APP_SECRET 持久化文件 */
export function secretPath(): string {
  return path.join(userDataDir(), "secret.json");
}

/** prisma/schema.prisma 路径 */
export function prismaSchemaPath(): string {
  if (isDev) {
    return path.join(__dirname, "..", "prisma", "schema.prisma");
  }
  return path.join(process.resourcesPath, "prisma", "schema.prisma");
}

/** prisma CLI 入口（node_modules/prisma/build/index.js） */
export function prismaCliPath(): string {
  if (isDev) {
    return path.join(__dirname, "..", "node_modules", "prisma", "build", "index.js");
  }
  return path.join(process.resourcesPath, "prisma-cli", "build", "index.js");
}

/** Next standalone server.js 路径（生产用） */
export function nextServerPath(): string {
  return path.join(process.resourcesPath, "standalone", "server.js");
}
