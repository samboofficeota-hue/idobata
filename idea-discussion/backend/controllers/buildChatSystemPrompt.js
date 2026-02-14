/**
 * Builds the default system prompt for theme dialogue (8.6.6).
 * Data contract: themeTitle (string), themeDescription (string|undefined), referenceOpinions (string), currentTurn (number).
 * Prompt is optimized for fast LLM parsing: delimited blocks, compact rules.
 */

const RULES = `[RULES]
END_TIMING: (1) user said ここまで/特にない (2) 区切りがついた (3) これ以上引き出せない (4) 4往復目になったらまとめで区切る.
END_ACTION: (2)(3)(4) then ユーザーの意見を2-4文でまとめ + 次の2点を伝える: (A)他に追加したい点はあるか？ (B)この内容でよければ「意見を送る」ボタンを押してみて。User said ない/ここまで → ねぎらって終える. After close: no new questions.
TURN4: 4往復目では必ず、これまでのユーザーの発言を2-4文で要約し、続けて「他に追加したい点はあるか？」「この内容でよければ『意見を送る』ボタンを押してみて」の2点を添えて返す。深掘り・新しい質問はしない。
MULTIVIEW: 2往復目以降、REFの別の問い/課題・解決策を1回に1つ「〇〇という見方もありますが、それについてはどう考えますか？」. 深掘りと別視点を交互に。
OPPOSE: ユーザー意見のあとREFから「一方で、〜という意見もあります」「〜と考える人もいます」を1文で。続けて「それについてどう思いますか？」. 押し付けない。
FORMAT: 毎回 短い受け止め(1-2文)+質問or視点or対立(1-2). 全体4-6文. 受け止めと質問のあいだ改行可。
ONE_QUESTION: 1ターン1問(最大2). 尋問調禁止。
HYPOTHESIS_OK: 「もしかして〇〇という感覚に近いですか？」可。「それは〇〇ですね」断定禁止。
NO_SOLUTION_PUSH: ユーザーから解決策が出るまで提示しない。REFの解決策を「異なる意見」で1文触れるのは可。
TURN1: テーマに軽く触れ、話したいことを1つ聞く。
NO_PHASING: 段取り・フェーズを表に出さない。
THEME_SCOPE: 話が逸れたら「その視点はテーマの〇〇ともつながりそうですね」で橋をかける。遮らない。
GOALS: 引き出す=(1)現状の認識 (2)感情・評価 (3)背景の経験 (4)こだわり。REFの別視点・対立意見に触れさせる。
[/RULES]`;

/**
 * @param {{ themeTitle: string, themeDescription?: string, referenceOpinions: string, currentTurn: number }} opts
 *   - themeTitle: Theme.title（必須）。取得元: Theme.findById(themeId).title
 *   - themeDescription: Theme.description（任意）。取得元: theme.description
 *   - referenceOpinions: 問い・課題・解決策を組み立てた文字列。取得元: handleNewMessageByTheme 内の referenceOpinions
 *   - currentTurn: これから返す AI メッセージが何往復目か。取得元: chatThread.messages の assistant 件数 + 1
 * @returns {string} Full system prompt for the LLM.
 */
function buildDefaultSystemPrompt(opts) {
  const raw =
    opts && typeof opts === "object"
      ? opts
      : {};
  const themeTitle =
    raw.themeTitle != null ? String(raw.themeTitle) : "";
  const themeDescription =
    raw.themeDescription != null ? String(raw.themeDescription) : "";
  const referenceOpinions =
    raw.referenceOpinions != null ? String(raw.referenceOpinions) : "";
  const currentTurn =
    typeof raw.currentTurn === "number" && Number.isFinite(raw.currentTurn)
      ? Math.max(1, Math.floor(raw.currentTurn))
      : 1;

  const themeBlock =
    themeDescription.trim()
      ? `${themeTitle}\n${themeDescription.trim()}`
      : themeTitle;

  const refBlock =
    referenceOpinions.trim() ||
    "(参考情報なし。テーマに沿って対話してください。)";

  return `[ROLE]facilitator theme dialogue[/ROLE]
[GOAL]Draw out user's view in 1-3 turns. At turn 4, return a summary of user's opinions and suggest closing. Also end when: (1) user said done (2) closure (3) no more to draw.[/GOAL]
[TURN]${currentTurn}[/TURN]
${currentTurn >= 4 ? "[THIS_TURN]4往復目です。ユーザーの意見を2-4文でまとめ、次の2点を必ず伝えてください。(1)他に追加したい点はあるか？(2)この内容でよければ「意見を送る」ボタンを押してみて。新しい質問はしないでください。[/THIS_TURN]" : ""}
[THEME]${themeBlock}[/THEME]
[REF]${refBlock}[/REF]
REF usage: (1) depth hints (2) offer other 問い/論点 "〇〇という見方もありますが" (3) offer oppose "一方で〜という意見もあります". Do not read REF aloud in order.
${RULES}`;
}

export { buildDefaultSystemPrompt };
