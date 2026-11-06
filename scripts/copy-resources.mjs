// 把 .next/static 复制到 .next/standalone/.next/static
// 把 node_modules/.prisma 复制到 .next/standalone/node_modules/.prisma（双保险）
// electron-builder 的 extraResources 会再读一遍，但 standalone 自身也要能用
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function copyDir(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy] skip missing: ${src}`);
    return;
  }
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
  console.log(`[copy] ${src} -> ${dst}`);
}

copyDir(
  path.join(root, ".next", "static"),
  path.join(root, ".next", "standalone", ".next", "static"),
);
copyDir(
  path.join(root, "node_modules", ".prisma"),
  path.join(root, ".next", "standalone", "node_modules", ".prisma"),
);

const serverJs = path.join(root, ".next", "standalone", "server.js");
if (!fs.existsSync(serverJs)) {
  console.error("[copy] FATAL: .next/standalone/server.js missing");
  process.exit(1);
}
console.log("[copy] done");
