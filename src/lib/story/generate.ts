import { prisma } from "../db";
import { HttpError } from "../auth";
import { effectiveBible, parseBible } from "../bible";
import { checkInput } from "../moderation";
import { pathTo } from "../tree";
import { estimateTokens, recordUsage, resolveModels, type ResolvedModel } from "../llm/client";
import { PROVIDERS } from "../llm/providers";
import { buildMessages } from "./prompt";
import { MarkerSplitter, parseChapter } from "./parse";

export type StreamEvent =
  | { t: "delta"; v: string }
  | { t: "done"; chapter: { id: string; index: number; title: string; suggestions: string[]; isFinale: boolean } }
  | { t: "error"; message: string };

interface GenerateArgs {
  userId: string;
  bookId: string;
  /** 新章节挂在哪一章之后；null 表示写第一章 */
  parentId: string | null;
  idea: string | null;
}

/** 生成新章节，返回 NDJSON 事件流 */
export async function generateChapter(args: GenerateArgs): Promise<ReadableStream<Uint8Array>> {
  const { userId, bookId, parentId } = args;
  const idea = args.idea?.trim() || null;
  if (idea) {
    if (idea.length > 500) throw new HttpError(400, "想法请控制在 500 字以内");
    const check = checkInput(idea);
    if (!check.ok) throw new HttpError(400, check.reason);
  }

  const book = await prisma.book.findFirst({ where: { id: bookId, userId } });
  if (!book) throw new HttpError(404, "找不到这本书");
  if (book.status === "finished") throw new HttpError(400, "这本书已经完结，可以先选择“继续写番外”");

  // 作者关闭成人向后，已开启成人向的书也按全年龄写
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const adult = book.adult && user.adultEnabled && !!user.ageVerifiedAt;

  const all = await prisma.chapter.findMany({ where: { bookId } });
  if (parentId && !all.some((c) => c.id === parentId)) throw new HttpError(400, "分叉点不存在");
  const history = pathTo(all, parentId);
  const models = await resolveModels(userId);

  const ending = book.status === "ending" && book.endingLeft ? { left: book.endingLeft } : null;
  const messages = buildMessages({
    bookTitle: book.title,
    genre: book.genre,
    bible: parseBible(effectiveBible(book.bible, history.at(-1)?.bible)),
    adult,
    history: history.map((c) => ({ index: c.index, title: c.title, summary: c.summary, content: c.content })),
    idea,
    nextIndex: history.length + 1,
    ending,
  });

  const encoder = new TextEncoder();
  const send = (ctl: ReadableStreamDefaultController<Uint8Array>, e: StreamEvent) =>
    ctl.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

  return new ReadableStream({
    async start(ctl) {
      let lastError: unknown = null;
      for (const m of models) {
        let raw = "";
        let emitted = false;
        let usage: { prompt_tokens: number; completion_tokens: number } | null = null;
        try {
          const stream = await m.client.chat.completions.create({
            model: m.model,
            messages,
            stream: true,
            temperature: 0.9,
            ...(PROVIDERS[m.provider].streamUsage ? { stream_options: { include_usage: true } } : {}),
          });
          const splitter = new MarkerSplitter();
          for await (const part of stream) {
            if (part.usage) usage = part.usage;
            const delta = part.choices[0]?.delta?.content ?? "";
            if (!delta) continue;
            raw += delta;
            const out = splitter.push(delta);
            if (out) {
              emitted = true;
              send(ctl, { t: "delta", v: out });
            }
          }
          const tail = splitter.flush();
          if (tail) send(ctl, { t: "delta", v: tail });

          const saved = await saveChapter({ args: { ...args, idea }, m, raw, historyLen: history.length, ending });
          await recordUsage({
            userId,
            bookId,
            m,
            promptTokens: usage?.prompt_tokens ?? estimateTokens(messages.map((x) => x.content).join("")),
            completionTokens: usage?.completion_tokens ?? estimateTokens(raw),
          });
          send(ctl, { t: "done", chapter: saved });
          ctl.close();
          return;
        } catch (e) {
          lastError = e;
          console.error(`[generate] ${m.provider} 调用失败`, e);
          // 已经向读者输出了一部分内容时不再切换模型，避免正文拼接错乱
          if (emitted) break;
        }
      }
      send(ctl, {
        t: "error",
        message: lastError instanceof HttpError ? lastError.message : "生成失败了，请稍后重试或检查你的 API Key",
      });
      ctl.close();
    },
  });
}

async function saveChapter(p: {
  args: GenerateArgs;
  m: ResolvedModel;
  raw: string;
  historyLen: number;
  ending: { left: number } | null;
}) {
  const { args, raw, historyLen, ending } = p;
  const index = historyLen + 1;
  const parsed = parseChapter(raw, `第${index}章`);
  const parent = args.parentId ? await prisma.chapter.findUnique({ where: { id: args.parentId } }) : null;
  const book = await prisma.book.findUniqueOrThrow({ where: { id: args.bookId } });
  const bibleSnapshot = parsed.bible ? JSON.stringify(parsed.bible) : effectiveBible(book.bible, parent?.bible);
  const isFinale = ending?.left === 1;

  const chapter = await prisma.chapter.create({
    data: {
      bookId: args.bookId,
      parentId: args.parentId,
      index,
      title: parsed.title,
      content: parsed.content,
      idea: args.idea,
      summary: parsed.summary,
      suggestions: JSON.stringify(isFinale ? [] : parsed.suggestions),
      isFinale,
      bible: bibleSnapshot,
    },
  });

  const endingLeft = ending ? ending.left - 1 : null;
  await prisma.book.update({
    where: { id: args.bookId },
    data: {
      headChapterId: chapter.id,
      ...(ending
        ? endingLeft && endingLeft > 0
          ? { endingLeft }
          : { status: "finished", endingLeft: null }
        : {}),
    },
  });

  return {
    id: chapter.id,
    index,
    title: chapter.title,
    suggestions: isFinale ? [] : parsed.suggestions,
    isFinale,
  };
}
