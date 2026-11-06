import { prisma } from "../db";
import { HttpError } from "../auth";
import { checkInput } from "../moderation";
import { estimateTokens, recordUsage, resolveModels, type ResolvedModel } from "../llm/client";
import { PROVIDERS } from "../llm/providers";
import { pathTo } from "../tree";
import type { Mode } from "../story/modes";
import { detectMode } from "../story/modes";
import { engine, engineOk, EngineError, newRequestId, type Envelope } from "./engine";
import { fixMessages, openingMessages, recordMessages, writeMessages, type RecentTurn } from "./prompts";

/**
 * 书入 × 叙事引擎的宿主循环：
 * 每个回合 1) 模型按模板写记录 → 2) 运行时校验并应用（被拒就带着错误让模型改，最多 2 次）
 * → 3) 模型按运行时的结果写正文（流式）。开局只有第 3 步。
 */

export type AtEvent =
  | { t: "delta"; v: string }
  | { t: "recording" }
  | { t: "writing" }
  | { t: "done"; chapter: { id: string; index: number; title: string; suggestions: string[]; isFinale: boolean } }
  | { t: "error"; message: string };

type Book = NonNullable<Awaited<ReturnType<typeof prisma.book.findFirst>>>;

interface Usage {
  prompt: number;
  completion: number;
}

const SKIP: Record<string, Record<string, unknown>> = {
  到晚上: { until: "evening" },
  到明天早上: { until: "next_morning" },
  到明早: { until: "next_morning" },
  到中午: { until: "noon" },
  到夜里: { until: "night" },
  三天后: { days: 3 },
  一周后: { days: 7 },
};

/** “快进到晚上 / 三天后 / 两小时后”→ preview_time */
export function parseSkip(text: string): Record<string, unknown> {
  const t = text.replace(/^快进/, "");
  for (const [k, v] of Object.entries(SKIP)) if (t.includes(k)) return v;
  const days = t.match(/(\d+)\s*天/);
  if (days) return { days: Math.min(30, Number(days[1])) };
  const hours = t.match(/(\d+)\s*(个)?小时/);
  if (hours) return { minutes: Math.min(43200, Number(hours[1]) * 60) };
  if (/早上|清晨|明早|明天/.test(t)) return { until: "next_morning" };
  if (/晚上|傍晚/.test(t)) return { until: "evening" };
  if (/中午/.test(t)) return { until: "noon" };
  if (/夜/.test(t)) return { until: "night" };
  return { until: "evening" };
}

/** 从模型输出里取出 JSON 对象 */
export function extractJson(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(text.slice(start, end + 1));
    if (v && typeof v === "object" && Array.isArray(v.turns) && v.turns[0]) return v.turns[0];
    return v;
  } catch {
    return null;
  }
}

/** 把出错的操作去掉：错误路径形如 $.turns[0].operations[3]… */
export function dropFailingOps(turn: Record<string, unknown>, error: EngineError["detail"]): Record<string, unknown> | null {
  const ops = Array.isArray(turn.operations) ? [...(turn.operations as unknown[])] : [];
  const bad = new Set<number>();
  for (const d of error.details ?? []) {
    const m = d.path?.match(/operations\[(\d+)\]/);
    if (m) bad.add(Number(m[1]));
  }
  if (!bad.size) return null;
  return { ...turn, operations: ops.filter((_, i) => !bad.has(i)) };
}

function footer(ctx: Record<string, unknown>, turn: number) {
  const clock = (ctx.clock as { label?: string } | undefined)?.label ?? "";
  const loc = (ctx.scene as { location?: string } | undefined)?.location ?? "";
  return `【时间】${clock}｜【地点】${loc}｜回合：${turn}`;
}

async function complete(m: ResolvedModel, messages: { role: "system" | "user" | "assistant"; content: string }[], usage: Usage, json: boolean) {
  const res = await m.client.chat.completions.create({
    model: m.model,
    messages,
    temperature: json ? 0.4 : 0.9,
    ...(json ? { response_format: { type: "json_object" as const } } : {}),
  });
  const text = res.choices[0]?.message?.content ?? "";
  usage.prompt += res.usage?.prompt_tokens ?? estimateTokens(messages.map((x) => x.content).join(""));
  usage.completion += res.usage?.completion_tokens ?? estimateTokens(text);
  return text;
}

async function streamText(
  m: ResolvedModel,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  usage: Usage,
  onDelta: (v: string) => void,
) {
  const stream = await m.client.chat.completions.create({
    model: m.model,
    messages,
    stream: true,
    temperature: 0.9,
    ...(PROVIDERS[m.provider].streamUsage ? { stream_options: { include_usage: true } } : {}),
  });
  let raw = "";
  let u: { prompt_tokens: number; completion_tokens: number } | null = null;
  for await (const part of stream) {
    if (part.usage) u = part.usage;
    const d = part.choices[0]?.delta?.content ?? "";
    if (!d) continue;
    raw += d;
    onDelta(d);
  }
  usage.prompt += u?.prompt_tokens ?? estimateTokens(messages.map((x) => x.content).join(""));
  usage.completion += u?.completion_tokens ?? estimateTokens(raw);
  return raw.trim();
}

/** 引擎的写操作：带会话号、请求号、修订号；成功后更新书上记的号 */
async function write(book: Book, command: string, input: Record<string, unknown>, retry = true): Promise<Envelope> {
  const env = await engine(command, {
    session_id: book.atSession,
    // 每次新的写操作都用新的请求号；同一次调用内的重试由 engine() 用同一份输入完成，重放安全
    request_id: newRequestId(),
    expected_revision: book.atRevision,
    ...input,
  });
  // 元操作不依赖局面，修订号过期就用当前的重交一次；回合记录由调用方重新判断
  if (!env.ok && env.error?.code === "STALE_REVISION" && typeof env.error.current_revision === "number") {
    book.atRevision = env.error.current_revision;
    await prisma.book.update({ where: { id: book.id }, data: { atRevision: book.atRevision } });
    if (retry && command !== "commit-turn") return write(book, command, input, false);
    return env;
  }
  const next = env.data?.next_request_id ?? env.error?.next_request_id ?? newRequestId();
  const ctxRev = (env.data?.context as { revision?: number } | undefined)?.revision;
  const revision = (env.data?.revision as number | undefined) ?? ctxRev ?? book.atRevision;
  await prisma.book.update({ where: { id: book.id }, data: { atNextReq: next, atRevision: revision } });
  book.atNextReq = next;
  book.atRevision = revision ?? null;
  return env;
}

/** 元操作（偏好、边界、暂停、撤销）：不经过模型 */
export async function atCommand(book: Book, command: string, input: Record<string, unknown>) {
  const env = await write(book, command, input);
  if (!env.ok) throw new HttpError(400, env.error?.message ?? "操作失败");
  return env.data!;
}

/** 开局：调用 new-game，记下会话 */
export async function createAtGame(input: Record<string, unknown>) {
  const env = await engine("new-game", { request_id: newRequestId(), ...input });
  if (!env.ok || !env.data) {
    const e = env.error!;
    const cands = (e.candidates as { title?: string }[] | undefined)?.map((c) => c.title).filter(Boolean);
    throw new HttpError(400, cands?.length ? `${e.message}（可选：${cands.join("、")}）` : e.message);
  }
  return env.data as {
    session_id: string;
    revision: number;
    next_request_id: string;
    opening: { world: { title: string }; [k: string]: unknown };
    context: Record<string, unknown>;
  };
}

export async function generateAtTurn(args: {
  userId: string;
  book: Book;
  idea: string | null;
  mode?: Mode | null;
}): Promise<ReadableStream<Uint8Array>> {
  const { userId, book } = args;
  const detected = detectMode(args.idea, args.mode);
  const idea = detected.idea;
  if (idea) {
    if (idea.length > 500) throw new HttpError(400, "请控制在 500 字以内");
    const check = checkInput(idea);
    if (!check.ok) throw new HttpError(400, check.reason);
  }
  if (book.status === "finished") throw new HttpError(400, "这本书已经完结，可以先选择“继续写番外”");
  if (!book.atSession) throw new HttpError(400, "这本书没有接上叙事引擎");

  const all = await prisma.chapter.findMany({ where: { bookId: book.id } });
  const path = pathTo(all, book.headChapterId);
  const models = await resolveModels(userId);
  const m = models[0];
  const usage: Usage = { prompt: 0, completion: 0 };

  const encoder = new TextEncoder();
  const send = (ctl: ReadableStreamDefaultController<Uint8Array>, e: AtEvent) =>
    ctl.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

  return new ReadableStream({
    async start(ctl) {
      try {
        // ---------- 开局正文 ----------
        if (path.length === 0) {
          const ctx = await engineOk("get-context", { session_id: book.atSession, depth: "full" });
          const opening = JSON.parse(book.atOpening ?? "{}");
          send(ctl, { t: "writing" });
          const text = await streamText(m, openingMessages({ opening, context: ctx.context }), usage, (v) =>
            send(ctl, { t: "delta", v }),
          );
          const tail = [opening.footer, opening.tip].filter(Boolean).join("\n");
          if (tail) send(ctl, { t: "delta", v: `\n\n${tail}` });
          const saved = await saveTurn({ book, parentId: null, turn: 1, text: tail ? `${text}\n\n${tail}` : text, idea: null, mode: "action", title: opening.world?.title ?? "开局" });
          await recordUsage({ userId, bookId: book.id, m, promptTokens: usage.prompt, completionTokens: usage.completion });
          send(ctl, { t: "done", chapter: saved });
          ctl.close();
          return;
        }

        // ---------- 1. 记录 ----------
        send(ctl, { t: "recording" });
        const head = path.at(-1)!;
        const rewriting = detected.mode === "rewrite";
        const twist = detected.mode === "twist";
        const skip = detected.mode === "skip";
        const ctxInput: Record<string, unknown> = { session_id: book.atSession, depth: "full" };
        if (skip) ctxInput.preview_time = parseSkip(idea ?? "");
        if (twist) ctxInput.want_twist = true;
        const ctx = await engineOk<{ context: Record<string, unknown>; commit_template?: { turns: unknown[] }; skip_template?: { turns: unknown[] }; twist_candidates?: unknown; turn: number }>(
          "get-context",
          ctxInput,
        );
        const template = (skip && ctx.skip_template?.turns?.[0]) || ctx.commit_template?.turns?.[0] || ctx.commit_template;
        // 改写时，最近正文里不放被改掉的那一回合
        const base = rewriting ? path.slice(0, -1) : path;
        const recent: RecentTurn[] = base.slice(-3).map((c) => ({ turn: c.index, text: c.content }));
        const hint = {
          action: "",
          continue: "玩家按了“继续”：action_mode 写 continue",
          wait: "玩家按了“等一等”：action_mode 写 wait",
          retcon: "玩家在用“其实……”补设定：action_mode 写 rewrite",
          rewrite: "玩家说刚才不算，要改成这一句",
          skip: "玩家要求快进：照 skip_template 写",
          twist: "玩家说“来点转折”：从转折候选里选最贴合眼下局面的一个，记录 twist_accept，player_authorized 写 true",
        }[detected.mode];
        const msgs = recordMessages({
          context: ctx.context,
          template,
          recent,
          playerInput: idea ?? "",
          hint,
          twistCandidates: twist ? ctx.twist_candidates : undefined,
          replacesTurn: rewriting ? head.index : null,
        });

        let draft = await complete(m, msgs, usage, true);
        let turn = extractJson(draft);
        let result: Envelope | null = null;
        let lastError: EngineError["detail"] | null = null;
        const normalize = (t: Record<string, unknown>) => {
          t.player_input = (idea ?? "").slice(0, 2000);
          if (detected.mode === "continue") t.action_mode = "continue";
          if (detected.mode === "wait") t.action_mode = "wait";
          if (detected.mode === "retcon") t.action_mode = "rewrite";
          if (rewriting) t.replaces_turn = head.index;
          else delete t.replaces_turn;
          if (!Array.isArray(t.operations)) t.operations = [];
          if (!Array.isArray(t.content_tags)) t.content_tags = [];
          if (typeof t.summary !== "string" || !t.summary) t.summary = (idea ?? "场景继续").slice(0, 120);
          if (typeof t.open_action !== "string" || !t.open_action) t.open_action = "等玩家接下来的行动";
          return t;
        };

        // 被拒就带着错误让模型改，最多 2 次；仍失败就去掉出错的操作；再不行只记一个空回合，保证回合号对得上
        for (let attempt = 0; attempt < 5 && !result; attempt++) {
          if (!turn) {
            if (attempt < 2) {
              draft = await complete(m, fixMessages(msgs, draft, { message: "不是合法的 JSON 对象" }), usage, true);
              turn = extractJson(draft);
              continue;
            }
            turn = {};
          }
          const env = await write(book, "commit-turn", { turns: [normalize(turn)] });
          if (env.ok) {
            result = env;
            break;
          }
          lastError = env.error!;
          if (lastError.code === "SAFETY_BLOCK") throw new HttpError(400, lastError.message);
          if (lastError.code === "STALE_REVISION") continue; // write() 已经换上当前修订号
          if (attempt < 2) {
            draft = await complete(m, fixMessages(msgs, JSON.stringify(turn), lastError), usage, true);
            turn = extractJson(draft) ?? turn;
          } else if (attempt === 2) {
            turn = dropFailingOps(turn, lastError) ?? { ...turn, operations: [] };
          } else {
            turn = { action_mode: turn.action_mode, operations: [], content_tags: [], summary: turn.summary, open_action: turn.open_action };
          }
        }
        if (!result?.data) throw new HttpError(400, lastError?.message ?? "这一回合没能记录下来，请重试");

        // ---------- 2. 正文 ----------
        send(ctl, { t: "writing" });
        const data = result.data as { turn: number; context: Record<string, unknown>; turns?: Record<string, unknown>[] };
        const turnNo = data.turn;
        const text = await streamText(
          m,
          writeMessages({ context: data.context, committed: turn, results: data.turns ?? [], recent, playerInput: idea ?? "" }),
          usage,
          (v) => send(ctl, { t: "delta", v }),
        );
        const foot = footer(data.context, turnNo);
        send(ctl, { t: "delta", v: `\n\n${foot}` });

        if (rewriting) await prisma.chapter.delete({ where: { id: head.id } });
        const clock = (data.context.clock as { label?: string } | undefined)?.label;
        const saved = await saveTurn({
          book,
          parentId: rewriting ? head.parentId : head.id,
          turn: turnNo,
          text: `${text}\n\n${foot}`,
          idea,
          mode: detected.mode,
          title: clock ? `${clock}` : `第 ${turnNo} 回合`,
          summary: typeof turn?.summary === "string" ? turn.summary : "",
        });
        await recordUsage({ userId, bookId: book.id, m, promptTokens: usage.prompt, completionTokens: usage.completion });
        send(ctl, { t: "done", chapter: saved });
        ctl.close();
      } catch (e) {
        console.error("[at] 回合失败", e);
        send(ctl, {
          t: "error",
          message: e instanceof HttpError || e instanceof EngineError || (e as Error).name === "EngineUnavailable" ? (e as Error).message : "生成失败了，请稍后重试或检查你的 API Key",
        });
        ctl.close();
      }
    },
  });
}

async function saveTurn(p: {
  book: Book;
  parentId: string | null;
  turn: number;
  text: string;
  idea: string | null;
  mode: string;
  title: string;
  summary?: string;
}) {
  const chapter = await prisma.chapter.create({
    data: {
      bookId: p.book.id,
      parentId: p.parentId,
      index: p.turn,
      title: p.title.slice(0, 30),
      content: p.text,
      idea: p.idea,
      mode: p.mode,
      summary: p.summary || p.text.slice(0, 100),
      suggestions: "[]",
    },
  });
  await prisma.book.update({ where: { id: p.book.id }, data: { headChapterId: chapter.id } });
  return { id: chapter.id, index: p.turn, title: chapter.title, suggestions: [], isFinale: false };
}

/** 撤销上一回合：引擎 undo-turn，再删掉书里的最后一段 */
export async function undoAtTurn(book: Book) {
  const all = await prisma.chapter.findMany({ where: { bookId: book.id } });
  const path = pathTo(all, book.headChapterId);
  const head = path.at(-1);
  if (!head || path.length < 2) throw new HttpError(400, "开局不能撤销");
  await atCommand(book, "undo-turn", {});
  await prisma.chapter.delete({ where: { id: head.id } });
  await prisma.book.update({ where: { id: book.id }, data: { headChapterId: head.parentId } });
  return head.index;
}
