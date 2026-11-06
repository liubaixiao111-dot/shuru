import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

/**
 * 调用叙事引擎（engine/adult-tension 的 Python 运行时）。
 * 输入写成 UTF-8 文件传入，避免 Windows 终端把中文改坏；输出是 {"ok","data","error"} 信封。
 */

export interface Envelope<T = Record<string, unknown>> {
  ok: boolean;
  data: (T & { next_request_id?: string; revision?: number }) | null;
  error: {
    code: string;
    message: string;
    details?: { path?: string; reason?: string; hint?: string }[];
    next_request_id?: string;
    revision?: number;
    [k: string]: unknown;
  } | null;
}

export class EngineUnavailable extends Error {}

export function engineDir() {
  return process.env.AT_ENGINE_DIR || path.join(process.cwd(), "engine", "adult-tension");
}

export function engineHome() {
  return process.env.AT_HOME || path.join(process.cwd(), ".at-data");
}

let pythonCmd: string[] | null = null;

function run(cmd: string[], args: string[], timeoutMs: number): Promise<{ code: number | null; out: Buffer; err: string }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd[0], [...cmd.slice(1), ...args], {
        env: { ...process.env, ADULT_TENSION_HOME: engineHome(), PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
        windowsHide: true,
      });
    } catch (e) {
      resolve({ code: -1, out: Buffer.alloc(0), err: String(e) });
      return;
    }
    const chunks: Buffer[] = [];
    let err = "";
    const t = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e: Error) => {
      clearTimeout(t);
      resolve({ code: -1, out: Buffer.alloc(0), err: String(e) });
    });
    child.on("close", (code: number | null) => {
      clearTimeout(t);
      resolve({ code, out: Buffer.concat(chunks), err });
    });
  });
}

/** 依次试 AT_PYTHON、python3、python、py -3，用第一个能跑起运行时的 */
async function findPython(): Promise<string[]> {
  if (pythonCmd) return pythonCmd;
  const script = path.join(engineDir(), "scripts", "adult_tension.py");
  const candidates: string[][] = [];
  if (process.env.AT_PYTHON) candidates.push(process.env.AT_PYTHON.split(" "));
  candidates.push(["python3"], ["python"], ["py", "-3"]);
  for (const c of candidates) {
    const r = await run([...c, "-I", script], ["version", "--json"], 20000);
    try {
      const env = JSON.parse(r.out.toString("utf8")) as Envelope;
      if (env.ok) {
        pythonCmd = c;
        return c;
      }
    } catch {
      // 换下一个
    }
  }
  throw new EngineUnavailable("没有找到可用的 Python 3.10+。请安装 Python（python.org），或者设置环境变量 AT_PYTHON 指向 python.exe");
}

export async function engine<T = Record<string, unknown>>(command: string, input?: Record<string, unknown>): Promise<Envelope<T>> {
  const py = await findPython();
  const script = path.join(engineDir(), "scripts", "adult_tension.py");
  const args = [command, "--json"];
  let file: string | null = null;
  if (input) {
    file = path.join(os.tmpdir(), `shuru-at-${crypto.randomBytes(6).toString("hex")}.json`);
    fs.writeFileSync(file, JSON.stringify({ encoding_check: "汉字", ...input }), "utf8");
    args.push("--input-file", file);
  }
  // 超时、没有输出或输出不是 JSON：用同样的输入重试，最多 3 次（写操作带同一个 request_id，重放安全）
  let last = "";
  try {
    for (let i = 0; i < 3; i++) {
      const r = await run([...py, "-I", script], args, 60000);
      const text = r.out.toString("utf8").trim();
      try {
        const env = JSON.parse(text) as Envelope<T>;
        if (env.error?.code === "STORAGE_BUSY" && i < 2) continue;
        return env;
      } catch {
        last = r.err || text || `exit ${r.code}`;
      }
    }
  } finally {
    if (file) fs.rmSync(file, { force: true });
  }
  throw new Error(`叙事引擎没有正常返回：${last.slice(0, 300)}`);
}

/** 必须成功的调用：失败时抛出带引擎原因的错误 */
export async function engineOk<T = Record<string, unknown>>(command: string, input?: Record<string, unknown>) {
  const env = await engine<T>(command, input);
  if (!env.ok || !env.data) throw new EngineError(env.error!);
  return env.data;
}

export class EngineError extends Error {
  constructor(public detail: NonNullable<Envelope["error"]>) {
    super(detail.message);
  }
}

export function newRequestId() {
  return `r_${crypto.randomBytes(8).toString("hex")}`;
}
