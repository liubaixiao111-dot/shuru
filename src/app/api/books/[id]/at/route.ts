import { z } from "zod";
import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { prisma } from "@/lib/db";
import { engineOk } from "@/lib/at/engine";
import { atCommand, bookLength, undoAtTurn } from "@/lib/at/host";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), level: z.enum(["brief", "detail"]).default("brief") }),
  z.object({ action: z.literal("context") }),
  z.object({
    action: z.literal("prefs"),
    prefs: z
      .object({
        inner_view: z.boolean(),
        assistant: z.boolean(),
        offscreen_simulation: z.boolean(),
        person: z.enum(["second", "first", "third"]),
        pace: z.enum(["slow", "standard", "direct"]),
        explicitness: z.enum(["subtle", "standard", "explicit"]),
        npc_gender_preference: z.enum(["any", "mostly_female", "mostly_male", "female_only", "male_only", "mixed"]),
      })
      .partial(),
  }),
  z.object({ action: z.literal("boundary"), op: z.enum(["add", "remove"]), text: z.string().max(80).optional(), boundaryId: z.string().max(40).optional() }),
  z.object({ action: z.literal("pause"), paused: z.boolean(), changeScene: z.boolean().optional() }),
  z.object({ action: z.literal("undo") }),
  z.object({ action: z.literal("length"), length: z.enum(["short", "medium", "long"]) }),
]);

/** 叙事引擎的元操作：状态、偏好、边界、暂停、撤销。不经过模型 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
  if (!book || book.engine !== "at" || !book.atSession) throw new HttpError(404, "找不到这本书");
  const body = Body.parse(await req.json());
  const session_id = book.atSession;
  switch (body.action) {
    case "status":
      return Response.json(await engineOk("status", { session_id, level: body.level }));
    case "context": {
      const d = await engineOk<{ context: Record<string, unknown> }>("get-context", { session_id, depth: "full" });
      const c = d.context;
      return Response.json({ preferences: c.preferences, safety: c.safety, length: bookLength(book.prefs) });
    }
    case "prefs":
      return Response.json(await atCommand(book, "set-preferences", body.prefs));
    case "boundary":
      return Response.json(
        await atCommand(book, "set-boundary", {
          action: body.op,
          ...(body.text ? { text: body.text } : {}),
          ...(body.boundaryId ? { boundary_id: body.boundaryId } : {}),
        }),
      );
    case "pause":
      return Response.json(await atCommand(book, "set-safety", { paused: body.paused, change_scene: !!body.changeScene }));
    case "undo":
      return Response.json({ undone: await undoAtTurn(book) });
    case "length": {
      // 篇幅是书入这边的偏好，存在书的 prefs 里，引擎不管
      let prefs: Record<string, unknown> = {};
      try {
        prefs = JSON.parse(book.prefs || "{}");
      } catch {
        // 忽略
      }
      await prisma.book.update({ where: { id: book.id }, data: { prefs: JSON.stringify({ ...prefs, length: body.length }) } });
      return Response.json({ length: body.length });
    }
  }
});
