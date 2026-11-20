import { HttpError, requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { prisma } from "@/lib/db";
import { checkInput } from "@/lib/moderation";
import { parsePrefs, StoryPrefsPatch } from "@/lib/story/prefs";

type Ctx = { params: Promise<{ id: string }> };

/** 修改本书的叙事偏好（部分更新） */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const book = await prisma.book.findFirst({ where: { id, userId: user.id } });
  if (!book) throw new HttpError(404, "找不到这本书");
  const patch = StoryPrefsPatch.parse(await req.json());
  if (patch.boundaries) {
    patch.boundaries = patch.boundaries.map((b) => b.trim().replace(/^不要/, "")).filter(Boolean);
    for (const b of patch.boundaries) {
      const c = checkInput(b);
      if (!c.ok) throw new HttpError(400, c.reason);
    }
  }
  const prefs = { ...parsePrefs(book.prefs), ...patch };
  await prisma.book.update({ where: { id }, data: { prefs: JSON.stringify(prefs) } });
  return Response.json({ prefs });
});
