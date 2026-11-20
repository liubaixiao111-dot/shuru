import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** 统一的 API 错误处理 */
export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json({ error: e.issues[0]?.message ?? "参数错误" }, { status: 400 });
      }
      console.error(e);
      return NextResponse.json({ error: "服务器开小差了，请稍后再试" }, { status: 500 });
    }
  };
}
