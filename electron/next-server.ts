import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { databaseUrl, nextServerPath } from "./paths";
import { readOrCreateSecret } from "./secret";

let child: ChildProcess | null = null;

/**
 * Spawn Next.js standalone server.js 作为子进程。
 * 关键 env：
 * - ELECTRON_RUN_AS_NODE=1：让 electron.exe 当纯 Node 解释器
 * - NODE_ENV=development：让 src/lib/auth.ts 的 cookie secure=false（否则 Electron 下登录失效）
 * - DATABASE_URL / APP_SECRET：注入桌面端运行的路径与密钥
 */
export async function startNextServer(port: number): Promise<void> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "development",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: databaseUrl(),
    APP_SECRET: readOrCreateSecret(),
    DEEPSEEK_API_KEY: "", // 显式空，防止开发机环境变量泄漏
    QWEN_API_KEY: "",
    LLM_BASE_URL_OVERRIDE: "",
  };

  const serverJs = nextServerPath();
  child = spawn(process.execPath, [serverJs], {
    env,
    cwd: path.dirname(serverJs), // 必须是 standalone 目录，否则相对路径找不到 .next/static
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout?.on("data", (d) => console.log(`[next] ${d}`));
  child.stderr?.on("data", (d) => console.error(`[next] ${d}`));
  child.on("exit", (code, sig) => console.log(`[next] exit code=${code} sig=${sig}`));

  await waitForPort(port, 30000);
}

/** 关闭 Next 子进程。Windows 上 kill 是同步强制结束，给 2 秒清理管道 */
export async function stopNextServer(): Promise<void> {
  if (!child) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 2000);
    child!.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
    try {
      child!.kill();
    } catch {
      resolve();
    }
  });
  child = null;
}

/** TCP socket 探活，比 fetch /health 更通用（项目无 health 路由，不想动 src/） */
function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const sock = net.connect({ port, host: "127.0.0.1" }, () => {
        sock.end();
        resolve();
      });
      sock.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("next server start timeout"));
        } else {
          setTimeout(probe, 200);
        }
      });
    };
    probe();
  });
}
