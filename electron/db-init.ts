import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { databaseUrl, dbPath, prismaCliPath, prismaSchemaPath } from "./paths";

/**
 * 首次启动或 schema 变更时，spawn prisma CLI 执行 db push 创建 SQLite 表。
 * 用 .schema-version 标记文件（schema.prisma 内容长度的 base36）判断是否需要重推。
 */
export async function initDatabase(): Promise<void> {
  const marker = path.join(path.dirname(dbPath()), ".schema-version");
  const schemaContent = fs.readFileSync(prismaSchemaPath(), "utf8");
  const currentHash = schemaContent.length.toString(36);
  const needInit =
    !fs.existsSync(dbPath()) ||
    !fs.existsSync(marker) ||
    fs.readFileSync(marker, "utf8") !== currentHash;
  if (!needInit) return;

  fs.mkdirSync(path.dirname(dbPath()), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        prismaCliPath(),
        "db",
        "push",
        `--schema=${prismaSchemaPath()}`,
        "--skip-generate", // 不重新生成 client（已打包）
        "--accept-data-loss", // 首次空库无数据可丢；本项目无 migration 文件
      ],
      {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1", // 让 electron.exe 当 node
          DATABASE_URL: databaseUrl(),
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let stderr = "";
    child.stdout.on("data", (d) => console.log(`[prisma] ${d}`));
    child.stderr.on("data", (d) => {
      stderr += d;
      console.error(`[prisma] ${d}`);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        fs.writeFileSync(marker, currentHash, "utf8");
        resolve();
      } else {
        reject(new Error(`prisma db push failed (exit ${code}): ${stderr}`));
      }
    });
  });
}
