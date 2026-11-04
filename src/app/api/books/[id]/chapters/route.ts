import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { generateChapter } from "@/lib/story/generate";

const Body = z.object({ parentId: z.string().nullable(), idea: z.string().nullable().default(null) });

type Ctx = { params: Promise<{ id: string }> };

/** 写下一章（或在某个分叉点写新分支），返回 NDJSON 流 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const stream = await generateChapter({ userId: user.id, bookId: id, parentId: body.parentId, idea: body.idea });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
