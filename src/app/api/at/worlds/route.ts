import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { engineOk } from "@/lib/at/engine";

/** 叙事引擎的世界列表，可按关键词筛选 */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const data = await engineOk("list-worlds", q ? { query: q.slice(0, 40) } : {});
  return Response.json(data);
});
