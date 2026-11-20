import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { generateChapter } from "@/lib/story/generate";
import { MODES } from "@/lib/story/modes";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { generateAtTurn } from "@/lib/at/host";

const Body = z.object({
  parentId: z.string().nullable(),
  idea: z.string().nullable().default(null),
  mode: z.enum(MODES).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/** 写下一章（或在某个分叉点写新分支），返回 NDJSON 流 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
  if (!book) throw new HttpError(404, "找不到这本书");
  const stream =
    book.engine === "at"
      ? await generateAtTurn({ userId: user.id, book, idea: body.idea, mode: body.mode })
      : await generateChapter({ userId: user.id, bookId: id, parentId: body.parentId, idea: body.idea, mode: body.mode });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
