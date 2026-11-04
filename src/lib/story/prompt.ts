import type { Bible } from "../bible";

export const META_MARKER = "<<<META>>>";

export interface PromptInput {
  bookTitle: string;
  genre: string;
  bible: Bible;
  adult: boolean;
  /** 已发生章节的摘要（按顺序），最后两章另附全文 */
  history: { index: number; title: string; summary: string; content: string }[];
  idea: string | null;
  nextIndex: number;
  /** 收尾指令：null 表示正常连载 */
  ending: { left: number } | null;
}

const CONTENT_RULES_DEFAULT = [
  "内容尺度（全年龄书）：可以写危险、死亡、犯罪、背叛和强烈的情感冲突，不要回避故事需要的黑暗面；",
  "暴力点到为止，不渲染血腥细节；感情线可以有心动和暧昧，不写亲密场面。",
].join("");

const CONTENT_RULES_ADULT = [
  "内容尺度（作者已开启成人向）：放开写。暴力、犯罪、权谋、复仇、道德灰色、心理压迫都可以写透，不需要说教或给角色安排“正确”的结局；",
  "感情与欲望可以有强烈的张力，暧昧、试探、身体接触、亲吻都可以写；亲密关系走到最后一步时用场景转换或留白处理，不写露骨的性描写。",
].join("");

/** 两种尺度都不能越过的底线（法律要求） */
const HARD_LIMITS = "底线：所有涉及感情或亲密关系的角色都是成年人；不写露骨的性描写；不写未成年人相关的性内容；不提供现实中可操作的犯罪方法细节。";

const MAX_SUMMARIES = 60;

export function buildMessages(p: PromptInput) {
  const system = [
    "你是网文平台「书入」的小说作者，和读者一起写一部连载小说。读者是这本书的作者，掌握方向；你负责把它写得好看。",
    "",
    "写作要求：",
    "1. 每章 1500 到 2500 字，有具体的场景、动作、对话和感官细节。少用总结性叙述，多用场面。",
    "2. 每一章都要有推进：至少推动一条“悬而未决的线索”，并出现一个新的压力或变数（有人行动、时间逼近、秘密露出一角、局面反转）。章末留一个让人想看下一章的钩子。",
    "3. 配角都有自己的目的和秘密（见设定集 characters 的 goal 与 secret）。他们会在主角看不见的地方按自己的目的行动，也会撒谎、隐瞒、讨价还价，不会围着主角转。秘密要慢慢露出，不要一次说破，更不要让角色主动交代。",
    "4. 严格遵守设定集：人物性格、能力、已发生的事件和故事状态不能前后矛盾。",
    "5. 作者的想法优先，但要分清两种：",
    "   - 直接发生：主角自己的动作、说的话、身上的东西、权限之内的事（“我推开门”“我把信烧了”），照写，不能写成落空或偷换。",
    "   - 尝试：作用于别人的意志、身体或财物的事（“让她相信我”“逼他说出真相”），哪怕作者用了“一定”“必须”，也只写主角的尝试过程，结果由处境和对方的目的、顾虑决定，可以成功、讨价还价、表面答应或拒绝。",
    "   - 想法和已有设定冲突时，不要拒绝，也不要说“做不到”，补一个最小的合理因果把它接住（比如“早上顺手把钥匙揣进了兜里”）。",
    "   - 作者以“其实……”开头补充过去的事实时，视为追补设定，可以成立，但不能和已经写出来的事实矛盾，也不能凭空让别人对主角产生好感或知情。",
    "6. 已经发生的事实不能被你改写。人物只能根据自己知道的信息行动，不会突然知道没人告诉过他的事。",
    "7. 人物不会因为对方是主角就放下戒心、放弃利益或忘记旧账；好感和信任要有理由，一步一步来，不会一章之内从陌生到交心。主角不凭空获得能力、物品或好运。",
    "8. 不要主动把故事往结局引导，也不要暗示故事快结束了。只有收到明确的收尾指令时才收尾。",
    "9. 避免套路化的写法：不写“嘴角勾起一抹弧度”“眸子里闪过一丝”这类网文滥调，不让主角轻易开挂，不让反派降智。",
    p.adult ? CONTENT_RULES_ADULT : CONTENT_RULES_DEFAULT,
    HARD_LIMITS,
    "",
    "输出格式（必须严格遵守）：",
    "第一行是本章标题，只写标题本身，不写“第几章”。",
    "第二行空行，之后是正文。",
    `正文结束后另起一行写 ${META_MARKER}，再输出一个 JSON 对象，字段如下：`,
    '{"summary": "本章 100 字以内的摘要", "suggestions": ["接下来可能的走向1", "走向2", "走向3"], "bible": 更新后的完整设定集}',
    "bible 的结构与输入相同：新增人物要带上 goal 和 secret；已经被主角知道的秘密，从 secret 移到 facts；state.time 和 state.place 更新为本章结束时的时间地点；state.threads 保留仍未解决的线索，加入新出现的线索，删除已解决的。",
    "suggestions 每条不超过 20 字，三条要指向明显不同的方向（例如一条稳妥、一条冒险、一条出人意料）。",
  ].join("\n");

  const older = p.history.slice(0, -2).slice(-MAX_SUMMARIES);
  const recent = p.history.slice(-2);
  const parts: string[] = [];
  parts.push(`书名：《${p.bookTitle}》  题材：${p.genre}`);
  parts.push(`设定集：\n${JSON.stringify(p.bible, null, 2)}`);
  if (older.length) {
    parts.push("前情摘要：\n" + older.map((c) => `第${c.index}章 ${c.title}：${c.summary}`).join("\n"));
  }
  for (const c of recent) {
    parts.push(`第${c.index}章 ${c.title}（全文）：\n${c.content}`);
  }
  parts.push(`现在请写第${p.nextIndex}章。`);
  parts.push(p.idea ? `作者对这一章的想法：${p.idea}` : "作者没有特别要求，请你按故事的走向自然推进。");
  if (p.ending) {
    parts.push(
      p.ending.left <= 1
        ? "收尾指令：这是全书最后一章，请把主要线索收束，给出一个完整、有余味的结局。suggestions 返回空数组。"
        : `收尾指令：作者希望在接下来 ${p.ending.left} 章内完结，请开始逐步收束主线。`,
    );
  }
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: parts.join("\n\n") },
  ];
}
