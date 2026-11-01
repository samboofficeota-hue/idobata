// ひとりいどばたの画面と進行。試作（docs/prototypes/hitori-idobata/index.html）の動きをそのまま移したもの
// 画面は React ではなく、この中で組み立てる。AIの指示文はサーバー（services/hitori/prompts.js）にある
import { SAFETY_REPLY, SAFETY_RESOURCES, detectSafety } from "./safety";

const SHELL = "<div class=\"app\">\n  <header class=\"top\">\n    <div class=\"brand\">ひとりいどばた</div>\n    <span class=\"modechip\" id=\"modeChip\">AI：台本</span>\n    <button class=\"theme-btn\" data-act=\"slides\" id=\"themeBtn\" aria-label=\"お題の資料を見る\"></button>\n    <button class=\"iconbtn sm\" data-act=\"log\" aria-label=\"AIの動きを見る\" title=\"AIの動き\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M4 6h16M4 12h10M4 18h13\"/></svg>\n    </button>\n    <button class=\"iconbtn sm\" data-act=\"settings\" aria-label=\"設定\" title=\"設定\">\n      <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1\"/></svg>\n    </button>\n  </header>\n  <nav class=\"stepper\" id=\"stepper\" aria-label=\"段階\"></nav>\n  <div class=\"hint\" id=\"hint\" hidden></div>\n  <main class=\"main split\" id=\"main\">\n    <div class=\"tabbar\" id=\"tabbar\" role=\"tablist\">\n      <button role=\"tab\" data-act=\"view\" data-view=\"board\" id=\"tabBoard\">ボード</button>\n      <button role=\"tab\" data-act=\"view\" data-view=\"chat\" id=\"tabChat\">会話</button>\n    </div>\n    <section class=\"panel\" id=\"boardPanel\" aria-label=\"ボード\">\n      <div class=\"panel-head\"><span class=\"title\">ボード</span><span class=\"status\" id=\"boardStatus\" aria-live=\"polite\"></span><button class=\"linkbtn\" data-act=\"trash\" id=\"trashBtn\">ごみ箱</button></div>\n      <div class=\"panel-body board\" id=\"board\"></div>\n    </section>\n    <section class=\"panel\" id=\"chatPanel\" aria-label=\"会話\">\n      <div class=\"panel-head\"><span class=\"title\">会話</span><span class=\"status\" id=\"chatStatus\"></span></div>\n      <div class=\"panel-body\" id=\"chat\"><div class=\"msgs\" id=\"msgs\" aria-live=\"polite\"></div></div>\n    </section>\n  </main>\n  <footer class=\"foot\">\n    <div class=\"actions\" id=\"actions\"></div>\n    <div class=\"composer\" id=\"composer\"></div>\n  </footer>\n</div>\n<div id=\"sheetRoot\"></div>\n<div class=\"toast\" id=\"toast\" role=\"status\" hidden></div>";

export function mountHitori(root, api) {
root.innerHTML = SHELL;

/* ───────── 試作用のお題と台本 ───────── */
const KEY = 'hitori-idobata-v1';
const STAGES = ['下準備', '意見出し', '課題整理', 'ゴール設定', 'アイデア出し', 'まとめ'];
const STEP_SHORT = ['下準備', '意見', '課題', 'ゴール', 'アイデア', 'まとめ'];
const DEMO = {
  title: '放課後の子どもの居場所',
  slides: [
    { h: 'お題', b: '放課後、小学生が安心して過ごせる場所を、みどり市でどうつくるか。' },
    { h: '背景', b: '共働きの家庭が増え、学童保育は申し込みが定員を上回っています。地域の子ども会は、ここ10年で半分ほどになりました。' },
    { h: '考えてほしいこと', b: 'あなたの経験や身近な様子から、何が一番の問題か、どうなるとよいかを考えてください。' }
  ],
  qa: [
    { k: ['学童', '定員', '空き', '待'], a: '資料では、みどり市の学童保育は、申し込みが定員を上回っているとされています。何人が待っているかは、資料には書かれていません。' },
    { k: ['子ども会', '地域', '町内'], a: '資料では、地域の子ども会は、ここ10年で半分ほどになったとされています。' },
    { k: ['対象', '誰', '何年生', '小学生', '中学'], a: '資料では、対象は小学生とされています。学年の区切りは書かれていません。' },
    { k: ['予算', 'お金', '費用'], a: '予算や費用については、資料には書かれていません。' }
  ]
};
const SCRIPT = {
  0: ['学童って、いまどれくらい足りていないんですか？', 'つまり、放課後に子どもが一人にならない場所を、地域でどうつくるか、ということだと思います。'],
  1: ['うちは共働きで、週に3日くらいは子どもが放課後一人で家にいます。正直ちょっと心配です。',
      '学童は申し込んだけど、空きがなくて入れませんでした。',
      '高齢の人で、子どもと関わりたい人は結構いると思う。',
      '退職した近所の人が、子どもに声をかけてくれると助かるからです。',
      '子どもは友だちと公園で遊びたがるけど、見守る大人がいない。'],
  2: ['共働きの家庭の小学生が、週に3日ほど、放課後に見守る大人のいない時間を過ごしていることが、一番の問題だと思います。',
      '学童に入れていない子どもは、市全体でどれくらいいるんですか？',
      '学童に入れないのは、定員が足りないからです。',
      '定員が足りないことで、親が仕事中に子どもの様子がわからず、不安なまま働いています。'],
  3: ['3年後には、放課後に一人で過ごす子どもがいなくなって、地域の大人が自然に見守っている状態にしたいです。',
      '一人で過ごす日が週1日以下になれば、良くなったとわかると思います。'],
  4: ['公民館を放課後に開放して、地域の高齢者が見守り役になる仕組みはどうでしょう。',
      'ほかの市では、どんなことをしているんですか？',
      '公園に、見守りボランティアの当番表をつくる。'],
  5: ['最後に、地域のつながりも強くなる、と書き足したいです。']
};
const ENTRY = [
  'こんにちは。ファシリテーターです。まずは、上の資料を見てください。わからないことがあれば、何でも聞いてください。資料に書かれている範囲でお答えします。',
  'では、意見出しです。このお題について、あなたの経験や気持ち、考えを自由に話してください。話したことは付箋になって、ボードに貼られます。',
  '課題整理に入ります。ボードを見て、なんとかしたいのはどれですか？ 〔まとめる〕を押すと、付箋をグループに分けた案も見られます。',
  '課題が解決したら、誰がどうなっていますか？ 望ましい姿を、声で描いてみてください。',
  'では、解決のアイデアを広げます。まずは、あなたのアイデアから聞かせてください。思いついた順で大丈夫です。',
  'まとめに入ります。これまで決めたことから、ストーリーの下書きを作ります。'
];
const KIND = {
  seed: { label: '気になったこと', cls: 'k-seed' },
  exp: { label: '経験', cls: 'k-op' },
  feel: { label: '気持ち', cls: 'k-op' },
  trouble: { label: '困りごと', cls: 'k-op' },
  thought: { label: '考え', cls: 'k-op' },
  sup: { label: '課題の補足', cls: 'k-issue' },
  issue: { label: '課題の案', cls: 'k-issue' },
  goal: { label: '望ましい姿の案', cls: 'k-goal' },
  goalsup: { label: '望ましい姿の補足', cls: 'k-goal' },
  idea: { label: 'アイデア', cls: 'k-idea' }
};
const STAGE_KINDS = { 0: ['seed'], 1: ['exp', 'feel', 'trouble', 'thought'], 2: ['issue', 'sup'], 3: ['goal', 'goalsup'], 4: ['idea'], 5: [] };
const OPINION = new Set(['exp', 'feel', 'trouble', 'thought']);
const KIND_ALIAS = Object.assign(Object.fromEntries(Object.entries(KIND).map(([k, v]) => [v.label, k])), { '課題': 'issue', '望ましい姿': 'goal', '補足': null, '困りごと': 'trouble' });
const PERSONAS = {
  minami: { name: 'ミナミ', role: '肯定派（仮）', core: '譲れないこと：困っている人を置き去りにしない。大切にしたいこと：つながり、便利さ。' },
  kenji: { name: 'ケンジ', role: '否定派（仮）', core: '譲れないこと：引き受けた負担は、誰かが必ず背負う。大切にしたいこと：費用、手間、公平。' },
  sora: { name: 'ソラ', role: '未定派（仮）', core: '譲れないこと：自分が納得しないまま決めない。大切にしたいこと：公平、将来。' }
};
/* 関連資料（試作用の架空の資料）。本番では、お題ごとにホストが調査やレポートを入れる */
const DOCS = [
  { id: 'd1', title: 'みどり市 放課後の過ごし方に関する保護者アンケート', org: 'みどり市こども家庭課', year: '2025年度', kind: '調査', chunks: [
    '市内の小学生の保護者1,200人が回答した。共働きの世帯は62%だった。',
    '放課後に子どもが大人のいない場所で一人で過ごす日が「ある」と答えた保護者は41%。そのうち「週3日以上」は18%だった。学年が上がるほど多い。',
    '子どもが一人で過ごすときの心配は、「事故やけが」58%、「不審者」52%、「様子がわからない」47%の順に多かった（複数回答）。'
  ] },
  { id: 'd2', title: 'みどり市 学童保育の利用状況', org: 'みどり市こども家庭課', year: '2025年4月', kind: '統計', chunks: [
    '学童保育の定員は1,480人に対し、申し込みは1,720人で、240人が利用できていない（待機）。',
    '待機している児童は、3・4年生が全体の7割を占める。1・2年生を優先して受け入れているため。',
    '定員を増やすには、場所と指導員の確保が課題とされている。指導員の求人に対する応募は少ない。'
  ] },
  { id: 'd3', title: 'みどり市 地域活動団体の現況調査', org: 'みどり市市民協働課', year: '2024年', kind: '調査', chunks: [
    '地域の子ども会は、2014年の86団体から2024年は41団体に減った。役員のなり手不足が主な理由とされる。',
    '60歳以上の市民のうち、「子どもと関わる地域活動に参加したい」と答えた人は32%。一方で、実際に参加している人は6%にとどまる。',
    '参加しない理由は「きっかけがない」44%、「責任が重そう」29%、「体力に不安」18%だった。'
  ] },
  { id: 'd4', title: '事例レポート：あおば市 公民館を使った放課後の居場所', org: 'あおば市生涯学習課', year: '2024年', kind: '事例', chunks: [
    'あおば市では、公民館3館を放課後に週3日開放し、地域のボランティアが見守っている。登録ボランティアは45人で、6割が60歳以上。',
    '利用する子どもは1日平均28人。開始から2年たち、保護者の満足度は高いが、利用者の多くは公民館の近くに住む子どもに限られる。',
    '続けるうえでの課題は、ボランティアの高齢化、けがのときの保険、まとめ役（コーディネーター）の確保とされている。'
  ] },
  { id: 'd5', title: '子どもの見守り活動に関する調査（要約）', org: 'こども地域研究所', year: '2023年', kind: '研究', chunks: [
    '商店や事業所が「子どもが立ち寄れる場所」の目印を掲げる見守りスポット制度がある地域では、子どもが「困ったときに頼れる大人がいる」と答えた割合が高かった。ただし、制度が原因かどうかは、この調査からはわからない。',
    '見守り活動が5年以上続いている地域の多くには、活動をまとめる担当者（コーディネーター）が置かれていた。'
  ] }
];
const CHUNKS = DOCS.flatMap((d) => d.chunks.map((t, i) => ({ id: `${d.id}-${i + 1}`, doc: d, text: t })));
const CHUNK = Object.fromEntries(CHUNKS.map((c) => [c.id, c]));
const CJK = /[一-龥ァ-ヴー]/;
function bigrams(s) {
  const t = String(s || '').replace(/[\s、。，．,.！？!?「」『』（）()・…]/g, '');
  const out = new Set();
  for (let i = 0; i < t.length - 1; i++) { const b = t.slice(i, i + 2); if (CJK.test(b[0]) && CJK.test(b[1])) out.add(b); }
  return out;
}
/* 試作の検索：漢字・カタカナの2文字の重なりで点数を付ける。本番は文の意味で探す仕組み（RAG）に置き換える */
function searchDocs(query, k) {
  const q = bigrams(query);
  if (!q.size) return [];
  return CHUNKS.map((c) => { const b = bigrams(c.doc.title + c.text); let sc = 0; q.forEach((x) => { if (b.has(x)) sc += 1; }); return { c, sc }; })
    .filter((x) => x.sc >= 1).sort((a, b) => b.sc - a.sc).slice(0, k || 3).map((x) => x.c);
}
const uniqChunks = (list) => { const seen = new Set(); return list.filter((c) => c && !seen.has(c.id) && seen.add(c.id)); };
const WIDEN = ['ほかの立場の人、たとえば子ども本人や地域の人は、どう感じていそうですか？', 'ほかに、気になっていることはありますか？'];
const ISSUE_POINTS = ['誰が', 'どんな場面で', 'どれくらい', 'なぜ', '解決策が混ざっていない', '根拠の付箋'];
const GOAL_POINTS = ['誰が', 'どうなる', 'いつ', '指標', '手段が混ざっていない'];
const Q_ISSUE = {
  '誰が': 'この課題で、一番困っているのは誰ですか？',
  'どんな場面で': 'それは、どんな場面で起きていますか？',
  'どれくらい': 'どれくらいの頻度や人数で起きていますか？',
  'なぜ': 'それは、なぜ起きていると思いますか？',
  '解決策が混ざっていない': '「〜が足りない」は、解決策の裏返しかもしれません。足りないことで、誰が何に困っていますか？',
  '根拠の付箋': 'ボードの付箋のうち、この課題の根拠になるのはどれですか？'
};
const Q_GOAL = {
  '誰が': 'その姿では、誰がどうなっていますか？',
  'どうなる': 'そのとき、どんな状態になっていますか？',
  'いつ': 'いつごろまでに実現したいですか？',
  '指標': 'どうなったら「良くなった」とわかりますか？ 数や回数で言えると、あとで効果を確かめやすくなります。',
  '手段が混ざっていない': '望ましい姿に、解決のやり方が入っていませんか？ やり方を抜くと、どんな姿になりますか？'
};

/* ───────── 状態 ───────── */
const newRunId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function fresh() {
  return {
    v: 3, runId: newRunId(), cited: [], advice: null, stage: 0, maxStage: 0, seq: 0, round: 0,
    messages: [], notes: [], groups: null, proposal: null,
    checks: {}, confirmed: {}, story: '',
    script: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    personasDone: false, suggest: false, log: [], logSeq: 0,
    settings: { layout: 'split', scribeDelay: 1500, ai: 'ai' },
    view: 'board', seenNotes: 0, seenMsgs: 0, hintClosed: false
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.v === 3 ? s : null;
  } catch (e) { return null; }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 保存できなくても動く */ } }, 150);
}

let S = load();
if (!S) { S = fresh(); addMsg('facil', ENTRY[0], { stage: 0 }); }
const pending = {};
let rec = null;
let busy = false;
let composerMode = api.voice.supported ? 'voice' : 'text';
let voice = { state: 'idle', elapsedSec: 0, error: null };
let sheet = null;
let demo = null;
let lastMsgCount = S.messages.length;

/* ───────── 小さな道具 ───────── */
const $ = (sel) => root.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = (s, n) => { s = String(s).replace(/[。．]$/, ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const clean = (t) => String(t).replace(/(えーと|えっと|えー|あのー|あの、|なんか|まあ、|うーん)[、,]?/g, '').trim();
const sentences = (t) => String(t).replace(/([。！？!?])/g, '$1\n').split('\n').map((s) => s.trim()).filter(Boolean);
const isQuestion = (t) => {
  const s = String(t).replace(/「[^」]*」/g, '');
  if (/[？?]/.test(s)) return true;
  if (/(ですか|ますか|でしょうか|のかな|かしら|だろう|でしょう)[。、？?]?/.test(s)) return true;
  if (/(何|なに|どれ|どの|どこ|どう|いつ|誰|だれ|なぜ|いくつ|いくら)[^。]*(の|か)[。、]?\s*$/.test(s)) return true;
  return /(教えて|知りたい|聞きたい|分かりますか|わかりますか|ありますか)/.test(s);
};
const dontKnow = (t) => /(わから|分から|知らない|思いつかない|特にない)/.test(String(t));
const activeNotes = () => S.notes.filter((n) => n.status === 'active');
const getNote = (id) => S.notes.find((n) => n.id === id);
const STOP = new Set(['問題', '一番', '自分', '正直', '結構', '本当', '感じ', '状態', '仕組', '大人']);
const tokens = (t) => (String(t).match(/[一-龥ァ-ヴー]{2,}/g) || []).filter((w) => !STOP.has(w));
const norm = (t) => String(t || '').replace(/[\s、。，．,.！？!?「」『』（）()・…]/g, '');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const isAI = (n) => n.author.startsWith('persona:');
function addMsg(who, text, extra = {}) {
  const m = Object.assign({ id: 'm' + (++S.seq), who, text, stage: S.stage, at: Date.now() }, extra);
  S.messages.push(m);
  return m;
}
function addNote(o) {
  const n = {
    id: 'n' + (++S.seq), kind: o.kind, text: o.text, quote: o.quote || '', msgId: o.msgId || null,
    author: o.author || 'scribe', userEdited: false, flags: o.flags || [], round: o.round || S.round,
    group: null, status: 'active', stage: o.stage != null ? o.stage : S.stage, dug: 0, selected: false, version: 1, fresh: true
  };
  S.notes.push(n);
  return n;
}
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 3000);
}
function hashRot(id) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997; return ((h % 5) - 2) * 0.35; }
function parseJson(t) {
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { /* 次へ */ }
  /* 返事の中のJSONを全部拾い、最後に読めたものを使う（途中で書き直す返事に備える） */
  const found = [];
  let depth = 0, start = -1, inStr = false, escp = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inStr) { if (escp) escp = false; else if (ch === '\\') escp = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { if (depth > 0) inStr = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth += 1; }
    else if (ch === '}' && depth > 0) { depth -= 1; if (depth === 0 && start >= 0) { found.push(t.slice(start, i + 1)); start = -1; } }
  }
  for (let i = found.length - 1; i >= 0; i--) { try { return JSON.parse(found[i]); } catch (e) { /* 次へ */ } }
  return null;
}
function digCandidates(snapshot) {
  const live = snapshot.filter((n) => OPINION.has(n.kind)).map((n) => getNote(n.id) || n).filter((n) => n.status === 'active');
  live.sort((a, b) => (b.flags.length - a.flags.length) || (a.dug - b.dug) || (b.round - a.round));
  return live;
}
const quoteOf = (s) => '「' + short(s, 22) + '」';

/* 返事の数字が材料にあるかを確かめるための文字列 */
function boardText(notes) {
  if (!notes.length) return '（まだ付箋はありません）';
  return notes.map((n) => [
    n.id, (KIND[n.kind] || {}).label, isAI(n) ? PERSONAS[n.author.slice(8)].name + '（AI参加者）' : '本人', '版' + n.version,
    n.userEdited ? '本人が直した' : '', n.flags.length ? '印：' + n.flags.join('、') : '', '掘り下げ' + (n.dug || 0) + '回', n.text
  ].filter(Boolean).join('｜')).join('\n');
}
function confirmedText() {
  const C = S.confirmed;
  const rows = [['お題の理解', 'understanding'], ['現状', 'current'], ['課題', 'issue'], ['望ましい姿', 'goal'], ['指標', 'indicator'], ['解決案', 'solution'], ['選んだ理由', 'reason'], ['ストーリー', 'story']]
    .filter(([, k]) => C[k] && C[k].text).map(([l, k]) => `- ${l}：${C[k].text}`);
  return rows.length ? rows.join('\n') : '（まだ決めたことはありません）';
}
function materialText() { return `お題：${DEMO.title}\n` + DEMO.slides.map((s, i) => `スライド${i + 1}「${s.h}」：${s.b}`).join('\n') + '\n（試作用の架空のお題です）'; }
function chatText(limit, beforeId) {
  const idx = beforeId ? S.messages.findIndex((m) => m.id === beforeId) : S.messages.length;
  const list = S.messages.slice(0, idx < 0 ? S.messages.length : idx).filter((m) => m.who !== 'system').slice(-limit);
  if (!list.length) return '（まだ会話はありません）';
  return list.map((m) => {
    const who = m.who === 'user' ? '本人' : m.who === 'facil' ? 'ファシリテーター' : (PERSONAS[m.who.slice(8)] || {}).name + '（AI参加者）';
    return `${who}：${m.text}`;
  }).join('\n');
}

/* ───────── 台本の返事（デモのとき・AIにつながらなかったとき） ───────── */
function classify(s) {
  if (/(心配|不安|つらい|大変|うれしい|嬉しい|焦|怖|さみしい|寂しい|助かる)/.test(s)) return 'feel';
  if (/(足りな|ない|なく|入れ|いない|困)/.test(s)) return 'trouble';
  if (/(ました|でした|ている|ていた|あった|毎日|週に|昔は)/.test(s)) return 'exp';
  return 'thought';
}
function flagsFor(kind, s) {
  const f = [];
  if (kind === 'thought' && !/(から|ので|ため)/.test(s)) f.push('理由？');
  if (kind === 'trouble' && !/([0-9０-９一二三四五六七八九十]|毎|週|月|回|人)/.test(s)) f.push('具体例？');
  return f;
}
function answerFromDoc(text) {
  const hit = DEMO.qa.find((q) => q.k.some((k) => text.includes(k)));
  return hit ? hit.a : 'そのことは、資料には書かれていません。';
}
function candidateFlow(target, ctx) {
  const label = target === 'issue' ? '課題' : '望ましい姿';
  const nextLabel = target === 'issue' ? 'ゴール設定' : 'アイデア出し';
  if (S.confirmed[target]) return { content: `${label}は確定しています。直したいときは、カードを押してください。〔次へ〕で${nextLabel}に進めます。`, refs: [], questionType: '案内', suggestAdvance: true };
  const cand = ctx.snapshot.find((n) => n.kind === target);
  if (!cand) {
    return target === 'issue'
      ? { content: `${quoteOf(ctx.text)}を、課題の案として受け止めました。まず、誰が一番困っているのかを、もう少し具体的に教えてください。`, refs: [], questionType: '点検:誰が' }
      : { content: `${quoteOf(ctx.text)}を、望ましい姿の案として受け止めました。それは、いつごろまでに実現したいですか？`, refs: [], questionType: '点検:いつ' };
  }
  const chk = S.checks[target];
  if (!chk) return { content: 'ありがとうございます。続けて、もう少し聞かせてください。', refs: [cand.id], questionType: '点検待ち' };
  const miss = chk.items.find((i) => i.status !== 'ok');
  if (miss) return { content: (target === 'issue' ? Q_ISSUE : Q_GOAL)[miss.point] || 'もう少し具体的に教えてください。', refs: [cand.id], questionType: '点検:' + miss.point };
  if (target === 'goal' && S.checks.link && S.checks.link.status !== 'ok' && S.confirmed.issue) {
    return { content: `この望ましい姿は、課題「${short(S.confirmed.issue.text, 24)}」が解決した姿とつながっていますか？`, refs: [cand.id], questionType: '点検:つながり' };
  }
  return { content: `${label}の案が、だいぶ具体的になりました。〔これで決める〕で確定しましょう。直してから決めても大丈夫です。`, refs: [cand.id], questionType: '確定の提案' };
}
const Fake = {
  facilitator(ctx) {
    const { stage, text, snapshot, turn } = ctx;
    if (isQuestion(text) && ctx.factLimit && ctx.passages && ctx.passages.length) {
      const c = ctx.passages[0];
      return { content: `資料では「${short(c.text, 60)}」とあります（資料：${c.doc.title}）。` + (stage === 0 ? ' ほかにも聞きたいことがあれば、どうぞ。' : ' あなたの身近ではどうですか？'), refs: [], docRefs: [c.id], questionType: '資料の質問に答える' };
    }
    if (stage === 0) {
      if (isQuestion(text)) {
        const extra = turn >= 1 ? ' ほかに気になることはありますか？ なければ、このお題を自分の言葉で一言にしてみてください。' : ' ほかにも聞きたいことがあれば、どうぞ。';
        return { content: answerFromDoc(text) + extra, refs: [], questionType: '資料の質問に答える' };
      }
      return { content: `${quoteOf(text)}と受け止めました。〔これで決める〕で、お題の理解として残せます。準備ができたら〔次へ〕で意見出しに進みましょう。`, refs: [], questionType: '理解の確認', suggestAdvance: true };
    }
    if (stage === 1) {
      const ops = snapshot.filter((n) => OPINION.has(n.kind));
      if (!ops.length) return { content: '話してくれてありがとうございます。そのとき、どんな気持ちでしたか？', refs: [], questionType: '掘り下げ:気持ち' };
      let content; let refs = []; let type;
      if (ctx.plannedType && ctx.plannedType.startsWith('広げる')) {
        content = WIDEN[Math.floor(turn / 3) % WIDEN.length]; type = '広げる';
      } else {
        const c = digCandidates(snapshot)[0]; refs = [c.id];
        if (c.flags.includes('理由？')) { content = `${quoteOf(c.text)}と思うのは、どうしてですか？`; type = '掘り下げ:理由'; }
        else if (c.flags.includes('具体例？')) { content = `${quoteOf(c.text)}について、具体的にどんな場面がありましたか？`; type = '掘り下げ:具体例'; }
        else if (c.kind === 'exp') { content = `${quoteOf(c.text)}のとき、どんな気持ちでしたか？`; type = '掘り下げ:気持ち'; }
        else if (c.kind === 'feel') { content = `${quoteOf(c.text)}という気持ちは、どんなときに強くなりますか？`; type = '掘り下げ:場面'; }
        else { content = `${quoteOf(c.text)}について、もう少し詳しく教えてください。`; type = '掘り下げ'; }
      }
      const adv = ops.length >= 4;
      if (adv) content += ' 意見がだいぶ出てきました。〔次へ〕で課題整理に進むこともできます。';
      return { content, refs, questionType: type, suggestAdvance: adv };
    }
    if (stage === 2) return candidateFlow('issue', ctx);
    if (stage === 3) return candidateFlow('goal', ctx);
    if (stage === 4) {
      const mine = snapshot.filter((n) => n.kind === 'idea' && n.author === 'scribe');
      const last = mine[mine.length - 1];
      if (!mine.length) return { content: 'ありがとうございます。ほかにも思いつくことはありますか？', refs: [], questionType: '広げる' };
      if (!S.personasDone) return { content: 'ほかにもありますか？ 〔ほかの人のアイデアも聞く〕を押すと、AIの参加者の案も見られます。', refs: last ? [last.id] : [], questionType: '広げる' };
      return { content: '気になる付箋を押して〔解決案に選ぶ〕を押してください。いくつか組み合わせても大丈夫です。', refs: last ? [last.id] : [], questionType: '選ぶ' };
    }
    return { content: '下書きに書き足しました。ほかに直したいところはありますか？ よければ〔これで決める〕でストーリーを確定してください。', refs: [], questionType: '確かめ' };
  },
  scribe(ctx) {
    const { stage, text, snapshot } = ctx;
    const t = clean(text);
    const ops = [];
    if (stage >= 1 && isQuestion(text)) return { ops };
    if (stage === 0) {
      ops.push({ op: 'add', kind: 'seed', text: (isQuestion(text) ? '？ ' : '') + short(t, 40), quote: text });
    } else if (stage === 1) {
      const lastQ = ctx.lastFacil;
      if (lastQ && lastQ.qt === '掘り下げ:理由' && lastQ.refs && lastQ.refs[0] && /(から|ので|ため)/.test(t)) {
        const target = snapshot.find((n) => n.id === lastQ.refs[0]);
        if (target) ops.push({ op: 'update', noteId: target.id, baseVersion: target.version, text: short(target.text, 30) + '（' + short(sentences(t)[0], 22) + '）', removeFlags: ['理由？'] });
      }
      sentences(t).slice(0, 3).forEach((s) => { const k = classify(s); ops.push({ op: 'add', kind: k, text: short(s, 46), quote: s, flags: flagsFor(k, s) }); });
    } else if (stage === 2 || stage === 3) {
      const target = stage === 2 ? 'issue' : 'goal';
      const supKind = stage === 2 ? 'sup' : 'goalsup';
      const cand = snapshot.find((n) => n.kind === target);
      if (!cand && !S.confirmed[target]) ops.push({ op: 'add', kind: target, text: short(t, 80), quote: text });
      else sentences(t).slice(0, 2).forEach((s) => ops.push({ op: 'add', kind: supKind, text: short(s, 46), quote: s }));
    } else if (stage === 4) {
      sentences(t).slice(0, 2).forEach((s) => ops.push({ op: 'add', kind: 'idea', text: short(s, 46), quote: s }));
    }
    return { ops };
  },
  check(target) {
    if (target === 'issue') {
      const cand = activeNotes().find((n) => n.kind === 'issue');
      if (!cand) return null;
      const all = [cand.text].concat(activeNotes().filter((n) => n.kind === 'sup').map((n) => n.text)).join(' ');
      const hasOps = activeNotes().some((n) => OPINION.has(n.kind));
      const items = [
        ['誰が', /(家庭|親|保護者|子ども|小学生|住民|高齢|世帯|学生|うち)/],
        ['どんな場面で', /(放課後|とき|場面|朝|夜|帰り|仕事中|間)/],
        ['どれくらい', /([0-9０-９]|一|二|三|毎日|毎週|週|月|割|半分|ほど)/],
        ['なぜ', /(から|ので|ため|原因|せい|によって)/]
      ].map(([point, re]) => ({ point, status: re.test(all) ? 'ok' : '不足' }));
      const mixed = /(足りない|がない|を増やす|すべき|をつくる|を作る|設置)/.test(all) && !/(ことで|ため、|不安|困って)/.test(all);
      items.push({ point: '解決策が混ざっていない', status: mixed ? '不足' : 'ok' });
      items.push({ point: '根拠の付箋', status: hasOps ? 'ok' : '不足' });
      return { items };
    }
    if (target === 'goal') {
      const cand = activeNotes().find((n) => n.kind === 'goal');
      if (!cand) return null;
      const all = [cand.text].concat(activeNotes().filter((n) => n.kind === 'goalsup').map((n) => n.text)).join(' ');
      return { items: [
        ['誰が', /(子ども|親|家庭|大人|地域|住民|誰も)/],
        ['どうなる', /(なる|なって|できる|ている|状態)/],
        ['いつ', /(年|月|までに|以内|年後)/],
        ['指標', /(以下|以上|割|減|増|ゼロ|日|回|人)/]
      ].map(([point, re]) => ({ point, status: re.test(all) ? 'ok' : '不足' })).concat([{ point: '手段が混ざっていない', status: /(見守|開放|開く|つくる|作る|設置|配置)/.test(cand.text) ? '不足' : 'ok' }]) };
    }
    if (target === 'link') {
      const issue = S.confirmed.issue ? S.confirmed.issue.text : (activeNotes().find((n) => n.kind === 'issue') || {}).text;
      const goal = S.confirmed.goal ? S.confirmed.goal.text : (activeNotes().find((n) => n.kind === 'goal') || {}).text;
      if (!issue || !goal) return null;
      const a = new Set(tokens(issue));
      const shared = tokens(goal).filter((w) => a.has(w));
      return { status: shared.length ? 'ok' : '確かめたい', reason: shared.length ? '共通する言葉：' + shared.slice(0, 3).join('、') : '共通する言葉がない' };
    }
    return null;
  },
  advisor(purpose, query, passages) {
    return { facts: passages.slice(0, 2).map((c) => ({ docRef: c.id, quote: c.text.slice(0, 24), fact: c.text, use: '参考' })) };
  },
  organizer(variant) {
    const ops = activeNotes().filter((n) => OPINION.has(n.kind));
    const df = {};
    const toks = ops.map((n) => { const set = new Set(tokens(n.text + ' ' + n.quote)); set.forEach((w) => { df[w] = (df[w] || 0) + 1; }); return set; });
    const tooCommon = (w) => df[w] > Math.max(2, ops.length * 0.6);
    const groups = [];
    ops.forEach((n, i) => {
      const mine = [...toks[i]].filter((w) => !tooCommon(w) && df[w] >= 2);
      if (variant % 2 === 1) mine.reverse();
      let g = groups.find((gr) => mine.some((w) => gr.words.has(w)));
      if (!g) { g = { words: new Set(), noteIds: [] }; groups.push(g); }
      mine.forEach((w) => g.words.add(w));
      g.noteIds.push(n.id);
    });
    const out = []; const other = [];
    groups.forEach((g) => {
      if (g.noteIds.length < 2) { other.push(...g.noteIds); return; }
      const count = {};
      g.noteIds.forEach((id) => tokens(getNote(id).text + ' ' + getNote(id).quote).forEach((w) => { if (g.words.has(w)) count[w] = (count[w] || 0) + 1; }));
      const top = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
      out.push({ name: top ? `「${top}」のこと` : 'まとまり', nameSource: top ? '本人の言葉' : 'AI', noteIds: g.noteIds });
    });
    if (out.length < 2) {
      const byKind = {};
      ops.forEach((n) => { (byKind[n.kind] = byKind[n.kind] || []).push(n.id); });
      return { groups: Object.keys(byKind).map((k) => ({ name: KIND[k].label, nameSource: '付箋の種類', noteIds: byKind[k] })), other: [] };
    }
    return { groups: out, other };
  },
  persona(key) {
    const bank = {
      minami: { ideas: ['公民館や集会所を、放課後だけ子どもの居場所として開く'], comment: 'まずは今ある場所を使えば、すぐに始められそうです。' },
      kenji: { ideas: ['見守る人の謝礼や保険の費用を、誰が持つかを先に決める'], comment: 'ボランティア頼みだと続かない心配があります。費用の出どころも考えたいです。' },
      sora: { ideas: ['子ども自身に、放課後どこで過ごしたいかを聞く場をつくる'], comment: 'どこで過ごしたいかを、子どもにも聞いてみたくなりました。', challenge: 'そもそも、一番困っているのは親でしょうか、子どもでしょうか。' }
    };
    return bank[key];
  },
  editor(request) {
    if (request) return { story: (S.story ? S.story + '\n' : '') + '【書き足し】' + clean(request) };
    const c = S.confirmed;
    const v = (k, d) => (c[k] && c[k].text) || d;
    return { story: [
      `【現状】${v('current', '（現状はまだ決まっていません）')}`,
      `【望ましい姿】${v('goal', '（まだ決まっていません）')}` + (c.indicator && c.indicator.text ? `（指標：${c.indicator.text}）` : ''),
      `【課題】${v('issue', '（まだ決まっていません）')}`,
      `【解決案】${v('solution', '（まだ決まっていません）')}` + (c.reason && c.reason.text ? `（理由：${c.reason.text}）` : ''),
      `【それでどうなるか】${v('solution', '解決案')}によって、${v('goal', '望ましい姿')}に近づく。`
    ].join('\n') };
  }
};

/* ───────── 出力の形をそろえる ───────── */
const Shape = {
  facilitator(o) {
    if (!o || typeof o.content !== 'string' || (!o.content.trim() && o.askedForFacts !== true)) return null;
    return { askedForFacts: o.askedForFacts === true, stopFacts: o.stopFacts === true, content: o.content.trim(), refs: Array.isArray(o.refs) ? o.refs.map(String) : [], docRefs: Array.isArray(o.docRefs) ? o.docRefs.map(String) : [], questionType: String(o.questionType || ''), suggestAdvance: o.suggestAdvance === true, read: String(o.read || '') };
  },
  scribe(o) { return o && Array.isArray(o.ops) ? { ops: o.ops.filter((x) => x && typeof x === 'object') } : null; },
  advisor(o) { return o && Array.isArray(o.facts) ? { facts: o.facts.filter((x) => x && typeof x === 'object') } : null; },
  check(target, o) {
    if (!o) return null;
    if (target === 'link') return { status: /^ok$/i.test(String(o.status || '').trim()) ? 'ok' : '確かめたい', reason: String(o.reason || '') };
    const pts = target === 'issue' ? ISSUE_POINTS : GOAL_POINTS;
    const got = Array.isArray(o.items) ? o.items : [];
    return { items: pts.map((p) => {
      const it = got.find((x) => x && String(x.point || '').trim() === p);
      if (!it) return { point: p, status: '未判定', hint: '' };
      return { point: p, status: /^ok$/i.test(String(it.status || '').trim()) ? 'ok' : '不足', hint: String(it.hint || '') };
    }) };
  },
  organizer(o) {
    if (!o || !Array.isArray(o.groups)) return null;
    const valid = new Set(activeNotes().filter((n) => OPINION.has(n.kind)).map((n) => n.id));
    const used = new Set();
    const groups = o.groups.map((g) => ({
      name: String(g.name || 'まとまり'), nameSource: String(g.nameSource || 'AI'),
      noteIds: (Array.isArray(g.noteIds) ? g.noteIds.map(String) : []).filter((id) => valid.has(id) && !used.has(id) && used.add(id))
    })).filter((g) => g.noteIds.length >= 1);
    groups.forEach((g) => {
      const nm = norm(g.name.replace(/のこと$/, ''));
      g.nameSource = g.noteIds.some((id) => { const n = getNote(id); return n && (norm(n.text).includes(nm) || norm(n.quote).includes(nm)); }) ? '本人の言葉' : 'AI';
    });
    const single = groups.filter((g) => g.noteIds.length < 2);
    single.forEach((g) => g.noteIds.forEach((id) => used.delete(id)));
    groups.splice(0, groups.length, ...groups.filter((g) => g.noteIds.length >= 2).slice(0, 4));
    groups.forEach((g) => g.noteIds.forEach((id) => used.add(id)));
    const other = [...valid].filter((id) => !used.has(id));
    return { groups, other };
  },
  persona(o) {
    if (!o) return null;
    const ideas = (Array.isArray(o.ideas) ? o.ideas : [o.idea]).map((s) => String((s && typeof s === 'object' ? s.text : s) || '').trim()).filter(Boolean).slice(0, 1);
    if (!ideas.length) return null;
    return { ideas: ideas.map((s) => short(s, 70)), comment: String(o.comment || '').trim(), challenge: String(o.challenge || '').trim() };
  },
  editor(o) {
    if (!o) return null;
    if (o.changed === false) return { story: null, changed: false };
    if (typeof o.current === 'string') {
      const H = [['現状', o.current], ['望ましい姿', o.goal], ['課題', o.issue], ['解決案', o.solution], ['それでどうなるか', o.effect]];
      if (H.some(([, v]) => !String(v || '').trim())) return null;
      return { story: H.map(([h, v]) => `【${h}】${String(v).trim()}`).join('\n'), changed: true };
    }
    return typeof o.story === 'string' && o.story.trim() ? { story: o.story.trim(), changed: true } : null;
  }
};

/* ───────── 進行役（プログラム） ───────── */
const useAI = () => S.settings.ai === 'ai' && !demo;

/* 指示文はサーバーで作る。ここから送るのは、種類と、ボードや会話の状態だけ */
function req(kind, args) {
  const sent = args.slice();
  if (kind === 'facilitator') {
    const { passages, ...ctx } = sent[0];
    sent[0] = { ...ctx, passageIds: passages.map((c) => c.id) };
  }
  if (kind === 'advisor') sent[2] = sent[2].map((c) => c.id);
  const state = {
    stage: S.stage, notes: activeNotes(), messages: S.messages.filter((m) => !m.safety).slice(-40).map(({ at, ...m }) => m),
    checks: S.checks, confirmed: S.confirmed, cited: S.cited, advice: S.advice, story: S.story
  };
  return { kind, args: sent, state };
}
async function callAI(role, request, shape) {
  const t0 = performance.now();
  try {
    const obj = await api.ai(request);
    const raw = JSON.stringify(obj);
    const out = obj == null ? null : shape(obj);
    if (!out) return { out: null, raw, ms: Math.round(performance.now() - t0), err: 'shape' };
    return { out, raw, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    toast(e.message || 'AIにつながりませんでした。');
    return { out: null, raw: '', ms: Math.round(performance.now() - t0), err: e.status || 'unknown' };
  }
}

function runAgent(role, trigger, o) {
  const t0 = performance.now();
  pending[role] = (pending[role] || 0) + 1;
  renderStatus();
  const stage = S.stage;
  const live = useAI() && o.prompt;
  const request = live ? o.prompt() : null;
  const work = live
    ? callAI(role, request, o.shape).then((r) => Object.assign(r, { mode: r.out ? 'AI' : 'AIの失敗：' + r.err, failed: !r.out }))
    : pause(Math.max(150, o.delay + Math.round((Math.random() - 0.5) * 400))).then(() => ({ out: o.fake(), mode: '台本' }));
  return work.then((r) => {
    let result;
    try {
      if (r.failed) {
        result = { ok: false, note: 'AIから返事を受け取れなかった' };
        if (o.onFail) o.onFail();
      } else result = r.out == null ? { ok: false, note: '出力なし' } : o.apply(r.out);
    } catch (e) { result = { ok: false, note: 'エラー：' + e.message }; }
    const entry = {
      seq: ++S.logSeq, at: Date.now(), role, trigger, stage, mode: r.mode, tier: r.tier || null,
      ms: Math.round(performance.now() - t0), ok: !result || result.ok !== false, note: (result && result.note) || '', err: r.err || null
    };
    S.log.unshift(entry);
    S.log = S.log.slice(0, 150);
  }).finally(() => {
    pending[role] = Math.max(0, (pending[role] || 1) - 1);
    save();
    render();
  });
}
function logLocal(role, trigger, note) {
  const entry = { seq: ++S.logSeq, at: Date.now(), role, trigger, stage: S.stage, mode: 'プログラム', tier: null, ms: 0, ok: true, note, err: null };
  S.log.unshift(entry);
}

/* 実行の記録（このページの持ち主だけが読める） */

function lastFacilBefore(stage, msgId) {
  const idx = S.messages.findIndex((m) => m.id === msgId);
  for (let i = idx - 1; i >= 0; i--) {
    const m = S.messages[i];
    if (m.who === 'facil' && m.stage === stage) return m;
    if (m.who === 'system') break;
  }
  return null;
}

function candidateText(stage) {
  const t = stage === 2 ? 'issue' : stage === 3 ? 'goal' : null;
  if (!t) return '';
  const c = S.confirmed[t] ? S.confirmed[t].text : (activeNotes().find((n) => n.kind === t) || {}).text;
  return c || '';
}
function send(text, via) {
  text = String(text || '').trim();
  if (!text) return;
  const stage = S.stage;
  S.round += 1;
  const turn = S.messages.filter((m) => m.who === 'user' && m.stage === stage).length;
  const msg = addMsg('user', text, { via });
  const level = detectSafety(text);
  if (level === 'urgent') {
    msg.safety = true;
    showResources(msg);
    addMsg('facil', SAFETY_REPLY, { qt: '安全', safety: true });
    logLocal('進行役', '安全', '決まった文で応じた（AIには送らない）');
    render();
    return;
  }
  if (level) showResources(msg);
  dispatch(msg, { facil: true, scribe: true }, turn);
}
/* 相談先は、1回の発言に1度だけ出す */
function showResources(msg) {
  if (msg.resourced) return;
  msg.resourced = true;
  addMsg('facil', SAFETY_RESOURCES, { safety: true });
  logLocal('進行役', '安全', '相談先を出した（決まった文）');
}
/* AIを呼べなかった発言は残し、〔もう一度〕で呼び直せるようにする */
function failedSend(msg, role) {
  const open = S.messages.find((m) => m.retry && m.retry.msgId === msg.id);
  if (open) { open.retry.roles[role] = true; return; }
  addMsg('system', 'AIにつながりませんでした。発言は残っています。', { retry: { type: 'send', msgId: msg.id, roles: { [role]: true } } });
}
function dispatch(msg, roles, turnAt) {
  const text = msg.text;
  const stage = msg.stage;
  const turn = turnAt != null ? turnAt : S.messages.slice(0, S.messages.indexOf(msg)).filter((m) => m.who === 'user' && m.stage === stage).length;
  const snapshot = activeNotes().map((n) => Object.assign({}, n));
  /* 資料の抜粋を渡す場面をプログラムで絞る：
     下準備と、本人が質問したときは渡す。課題整理・ゴール設定は、点検で「不足」が残っているときだけ渡す。
     意見出し・アイデア出し・まとめは、本人が質問したときだけ（自分の考えを出し切る前に、事実で寄せないため） */
  const asked = isQuestion(text);
  const chk = stage === 2 ? S.checks.issue : stage === 3 ? S.checks.goal : null;
  const gap = !!(chk && chk.items && chk.items.some((i) => i.status === '不足'));
  const wantDocs = !S.stopFacts && (asked || ((stage === 2 || stage === 3) && gap && dontKnow(text)));
  const factLimit = !wantDocs ? 0 : (asked ? 2 : 1);
  const found = wantDocs ? searchDocs(isQuestion(text) ? text : text + ' ' + candidateText(stage), 3) : [];
  const advised = wantDocs && S.advice && S.advice.stage === stage ? S.advice.facts.map((f) => CHUNK[f.docRef]) : [];
  const early = stage <= 3 && !/(ほかの|他の|事例|例えば|たとえば)/.test(text);
  const passages = uniqChunks(advised.concat(found)).filter((c) => !(early && c.doc.kind === '事例')).slice(0, 5);
  const plannedType = stage === 1 && !isQuestion(text) ? (turn % 3 === 2 ? '広げる（ほかの立場や場面に目を向ける問い）' : '掘り下げ（今の発言か、掘り下げの候補の上の付箋について）') : null;
  const ctx = { stage, text, snapshot, turn, msgId: msg.id, lastFacil: lastFacilBefore(stage, msg.id), passages, plannedType, factLimit, searched: wantDocs, round: S.round, revisiting: S.maxStage > S.stage };
  render();
  if (roles.facil) runAgent('ファシリ', '本人の発言', { delay: 900, prompt: () => req('facilitator', [ctx]), shape: Shape.facilitator, fake: () => Fake.facilitator(ctx), onFail: () => failedSend(msg, 'facil'), apply: (out) => applyFacil(out, ctx) });
  if (!roles.scribe) return;
  if (stage <= 4) {
    runAgent('書記', '本人の発言', { delay: S.settings.scribeDelay, prompt: () => req('scribe', [ctx]), shape: Shape.scribe, fake: () => Fake.scribe(ctx), onFail: () => failedSend(msg, 'scribe'), apply: (out) => applyScribe(out, ctx, msg) });
  } else {
    runAgent('編集者', '本人の発言', { onFail: () => failedSend(msg, 'scribe'), delay: 1300, prompt: () => req('editor', [text]), shape: Shape.editor, fake: () => Fake.editor(text), apply: (out) => { if (out.changed === false || !out.story) return { ok: true, note: '直す求めではないので、下書きはそのまま' }; S.story = out.story; return { ok: true, note: '下書きを直した' + (S.confirmed.story ? '（確定した文をもとに。もう一度〔これで決める〕で決める）' : '') }; } });
  }
}

/* 直前の発言を掘り下げたとき、その発言から書記が作った付箋に「掘り下げた」を数える（ファシリと書記は同時に動くため） */
function attributeDug(fm, msgId) {
  if (!fm || (fm.refs && fm.refs.length) || !/^掘り下げ/.test(fm.qt || '')) return;
  const n = activeNotes().find((x) => x.msgId === msgId);
  if (!n) return;
  fm.refs = [n.id];
  n.dug = (n.dug || 0) + 1;
}
function applyFacil(out, ctx) {
  if (S.stage !== ctx.stage) return { ok: false, note: '段階が変わったので、返事を捨てた' };
  if (out.askedForFacts && !ctx.searched && !ctx.retried) {
    const found = searchDocs(ctx.text, 3);
    const c2 = Object.assign({}, ctx, { passages: found, factLimit: found.length ? 2 : 0, searched: true, retried: true });
    runAgent('ファシリ', '資料を探して呼び直す', { delay: 600, prompt: () => req('facilitator', [c2]), shape: Shape.facilitator, fake: () => Fake.facilitator(c2), onFail: () => { const m = S.messages.find((x) => x.id === ctx.msgId); if (m) failedSend(m, 'facil'); }, apply: (o) => applyFacil(o, c2) });
    return { ok: true, note: '本人が事実を聞いていたので、資料を探して呼び直す' };
  }
  if (out.questionType === '安全') {
    const m = S.messages.find((x) => x.id === ctx.msgId);
    /* 以後の会話に持ち越さない（普通の発言にまで安全の返事が続かないように） */
    if (m) { m.safety = true; showResources(m); }
  }
  if (!out.content) out.content = 'もう一度、聞きたいことを話してください。';
  const live = new Set(activeNotes().map((n) => n.id));
  const snap = new Set(ctx.snapshot.map((n) => n.id));
  const asked = out.refs || [];
  const refs = asked.filter((id) => live.has(id) && snap.has(id));
  const dropped = asked.length - refs.length;
  const given = new Set(ctx.passages.map((c) => c.id));
  const askedDocs = out.docRefs || [];
  const docRefs = askedDocs.filter((id) => given.has(id)).slice(0, ctx.factLimit);
  const droppedDocs = askedDocs.length - docRefs.length;
  const nums = (s) => (String(s).normalize('NFKC').match(/\d[\d,.]*/g) || []).map((x) => x.replace(/,/g, ''));
  const known = new Set(nums([...ctx.passages.map((c) => c.text), ctx.text, chatText(10, ctx.msgId), boardText(ctx.snapshot), confirmedText(), materialText()].join(' ')));
  /* 出典の名前（〜2025 など）の数字は、事実の数字として数えない */
  const unknown = nums(out.content.replace(/（資料：[^）]*）/g, '')).filter((n) => !known.has(n));
  let guarded = '';
  if (droppedDocs || unknown.length) {
    const qs = sentences(out.content).filter((s) => /[？?]$|(か|ますか|ですか)。?$/.test(s));
    out.content = qs.length ? qs[qs.length - 1] : 'もう少し、あなたの考えを聞かせてください。';
    guarded = '・出典のない事実を外した';
  }
  if (out.stopFacts) S.stopFacts = true;
  const tooLong = out.content.length > (docRefs.length ? 160 : 120);
  if (/^掘り下げ/.test(out.questionType || '')) [...new Set(refs)].slice(0, 1).forEach((id) => { const n = getNote(id); n.dug = (n.dug || 0) + 1; });
  const fm = addMsg('facil', out.content, { refs, docRefs, qt: out.questionType, replyTo: ctx.msgId, safety: out.questionType === '安全' });
  docRefs.forEach((id) => { S.cited = S.cited || []; if (!S.cited.includes(id)) S.cited.push(id); });
  attributeDug(fm, ctx.msgId);
  if (out.suggestAdvance) S.suggest = true;
  return { ok: true, note: (out.questionType || '返事') + (fm.refs.length ? `・付箋${fm.refs.length}枚に触れた` : '・付箋には触れない') + (dropped ? `・実在しない付箋を${dropped}件外した` : '') + (docRefs.length ? `・資料${docRefs.length}件を示した（${docRefs.join('、')}）` : '') + (droppedDocs ? `・渡していない資料か上限を超えた資料を${droppedDocs}件外した` : '') + (tooLong ? `・長すぎる（${out.content.length}字）` : '') + guarded + (out.read ? `・読み取り：${out.read}` : '') };
}

function applyScribe(out, ctx, msg) {
  let add = 0, upd = 0;
  const rej = [];
  let check = null;
  const allowed = new Set(STAGE_KINDS[ctx.stage] || []);
  const src = norm(msg.text);
  (out.ops || []).forEach((op) => {
    if (op.op === 'add') {
      let kind = String(op.kind || '').trim();
      if (!allowed.has(kind) && KIND_ALIAS[kind] !== undefined) {
        const mapped = KIND_ALIAS[kind] || (ctx.stage === 2 ? 'sup' : ctx.stage === 3 ? 'goalsup' : '');
        if (mapped) kind = mapped;
      }
      const text = String(op.text || '').trim();
      const quote = String(op.quote || '').trim();
      if (!allowed.has(kind)) { rej.push('この段階では作れない種類'); return; }
      if (!text) { rej.push('本文がない'); return; }
      if (!quote) { rej.push('引用がない'); return; }
      if (!src.includes(norm(quote))) { rej.push('引用が発言の中にない'); return; }
      if (add >= 3) { rej.push('4枚目以降'); return; }
      if ((kind === 'issue' || kind === 'goal') && (S.confirmed[kind] || activeNotes().some((n) => n.kind === kind))) kind = kind === 'issue' ? 'sup' : 'goalsup';
      const flags = (Array.isArray(op.flags) ? op.flags : []).map((f) => String(f).normalize('NFKC').trim().replace(/\?$/, '？')).filter((f) => ['理由？', '具体例？', '食い違い'].includes(f));
      if (flags.includes('食い違い') && !(Number(op.confidence) >= 7 && getNote(String(op.relatedNoteId || '')))) flags.splice(flags.indexOf('食い違い'), 1);
      addNote({ kind, text: short(text, 90), quote, msgId: msg.id, flags, stage: ctx.stage, round: ctx.round || S.round, private: op.private === true });
      add += 1;
      if (kind === 'issue' || kind === 'sup') check = 'issue';
      if (kind === 'goal' || kind === 'goalsup') check = 'goal';
      return;
    }
    if (op.op !== 'update') { rej.push('不明な操作'); return; }
    const n = getNote(String(op.noteId || ''));
    if (!n || n.status !== 'active') { rej.push('付箋がない'); return; }
    if (![1, 4].includes(ctx.stage) || isAI(n) || !(OPINION.has(n.kind) || n.kind === 'idea')) { rej.push('この段階・この付箋には書き足さない'); return; }
    if (parseInt(String(op.baseVersion).replace(/\D/g, ''), 10) !== n.version) { rej.push('版が古い'); return; }
    const addText = String(op.addText || '').trim();
    const aq = String(op.quote || '').trim();
    if (addText && (!aq || !src.includes(norm(aq)))) { rej.push('書き足しの引用が発言の中にない'); return; }
    const removeFlags = Array.isArray(op.removeFlags) ? op.removeFlags.map((f) => String(f).normalize('NFKC').trim().replace(/\?$/, '？')) : [];
    if (n.userEdited) {
      if (removeFlags.length) { n.flags = n.flags.filter((f) => !removeFlags.includes(f)); n.version += 1; }
      rej.push('本人が直した付箋の本文は上書きしない');
      return;
    }
    if (addText) { n.text = n.text.replace(/[。．]$/, '') + '。' + addText; n.quote = (n.quote ? n.quote + ' ／ ' : '') + aq; }
    n.flags = n.flags.filter((f) => !removeFlags.includes(f));
    n.version += 1;
    upd += 1;
  });
  if (add) attributeDug(S.messages.find((m) => m.who === 'facil' && m.replyTo === msg.id), msg.id);
  const moved = S.stage !== ctx.stage;
  if (check && !moved) runCheck(check, true);
  if (!moved && add && ctx.stage === 4 && activeNotes().some((n) => n.msgId === msg.id && n.kind === 'idea')) runAdvisor('idea');
  if (out.rest && String(out.rest).trim()) toast('まだ付箋になっていない話があります：' + short(String(out.rest), 30));
  return { ok: true, note: `追加${add}・更新${upd}` + (rej.length ? `・捨てた${rej.length}（${[...new Set(rej)].join('、')}）` : '') };
}

function checkStamp(target) {
  if (target === 'link') return JSON.stringify([S.confirmed.issue && S.confirmed.issue.text, S.confirmed.goal && S.confirmed.goal.text]);
  const cand = activeNotes().find((n) => n.kind === target);
  return JSON.stringify([S.confirmed[target] && S.confirmed[target].text, cand && cand.id, cand && cand.version, activeNotes().filter((n) => n.kind === (target === 'issue' ? 'sup' : 'goalsup')).map((n) => n.id + ':' + n.version)]);
}
function runCheck(target, withAdvisor) {
  if (target !== 'link' && !S.confirmed[target] && !activeNotes().some((n) => n.kind === target)) { delete S.checks[target]; return; }
  const stamp = checkStamp(target);
  const trig = target === 'issue' ? '課題の案が出た' : target === 'goal' ? '望ましい姿の案が出た' : 'つながりの確認';
  runAgent('点検係', trig, {
    delay: 1300, prompt: () => req('check', [target]), shape: (o) => Shape.check(target, o), fake: () => Fake.check(target),
    apply: (out) => {
      if (checkStamp(target) !== stamp) { if (target !== 'link') setTimeout(() => runCheck(target, withAdvisor), 0); return { ok: false, note: '案が変わったので、古い点検を捨てた' }; }
      S.checks[target] = out;
      if (withAdvisor && target !== 'link') runAdvisor(target);
      if (target === 'goal' && (S.confirmed.issue || activeNotes().some((n) => n.kind === 'issue'))) runCheck('link');
      const ng = out.items ? out.items.filter((i) => i.status !== 'ok').map((i) => i.point) : (out.status !== 'ok' ? ['つながり'] : []);
      return { ok: true, note: ng.length ? '足りない：' + ng.join('、') : 'そろっている' };
    }
  });
}

function runAdvisor(purpose) {
  const query = purpose === 'idea'
    ? activeNotes().filter((n) => n.kind === 'idea' && !isAI(n)).map((n) => n.text).join('\n')
    : candidateText(purpose === 'issue' ? 2 : 3) + '\n' + activeNotes().filter((n) => n.kind === (purpose === 'issue' ? 'sup' : 'goalsup')).map((n) => n.text).join('\n');
  const passages = searchDocs(query + (purpose === 'goal' ? ' ' + candidateText(2) : ''), 4);
  const stage = S.stage;
  if (!passages.length) { logLocal('資料係', '検索', '関係しそうな資料は見つからなかった'); return; }
  runAgent('資料係', purpose === 'issue' ? '課題の案が出た' : purpose === 'goal' ? '望ましい姿の案が出た' : 'アイデアが出た', {
    delay: 1500, prompt: () => req('advisor', [purpose, query, passages]), shape: Shape.advisor, fake: () => Fake.advisor(purpose, query, passages),
    apply: (out) => {
      const given = new Set(passages.map((c) => c.id));
      const rej = [];
      const facts = out.facts.slice(0, 3).filter((f) => {
        const id = String(f.docRef || '');
        if (!given.has(id)) { rej.push('渡していない資料'); return false; }
        if (!f.quote || !norm(CHUNK[id].text).includes(norm(f.quote))) { rej.push('引用が資料の中にない'); return false; }
        return true;
      }).slice(0, 2).map((f) => ({ docRef: String(f.docRef), quote: String(f.quote), fact: short(String(f.fact || ''), 50), point: String(f.point || f.use || ''), caveat: String(f.caveat || '') }));
      if (S.stage === stage) S.advice = { stage, purpose, facts };
      return { ok: true, note: `事実${facts.length}件をファシリテーターに渡した` + (facts.length ? '（' + facts.map((f) => f.docRef).join('、') + '）' : '') + (rej.length ? `・捨てた${rej.length}（${[...new Set(rej)].join('、')}）` : '') };
    }
  });
}
function recheckFor(n) {
  if (n.kind === 'issue' || n.kind === 'sup') runCheck('issue');
  if (n.kind === 'goal' || n.kind === 'goalsup') runCheck('goal');
}
function canLeave(st) {
  const C = S.confirmed;
  if (st === 1 && !activeNotes().some((n) => OPINION.has(n.kind))) return '意見の付箋が1枚以上になると進めます。';
  if (st === 2 && !C.issue) return '課題を〔これで決める〕で確定すると進めます。';
  if (st === 3 && !C.goal) return '望ましい姿を〔これで決める〕で確定すると進めます。';
  if (st === 4 && !C.solution) return '解決案を〔これで決める〕で確定すると進めます。';
  if (st === 5 && !C.story) return 'ストーリーを〔これで決める〕で確定すると、ドキュメントになります。';
  return null;
}
function goStage(st, back) {
  S.stage = st;
  S.maxStage = Math.max(S.maxStage, st);
  S.suggest = false;
  addMsg('system', back ? `${STAGES[st]}に戻りました` : `${STAGES[st]}に進みました`);
  addMsg('facil', back ? `${STAGES[st]}に戻りました。直したいところや、足したいことを話してください。` : ENTRY[st]);
  logLocal('進行役', back ? '〔戻る〕' : '〔次へ〕', `${STAGES[st]}へ。ボードの写しを保存（試作では省略）`);
  if (st === 5 && !back) runEditor();
  save();
  render();
}
function runEditor() {
  runAgent('編集者', 'まとめに入った', {
    delay: 1600, prompt: () => req('editor', ['']), shape: Shape.editor, fake: () => Fake.editor(''),
    onFail: () => addMsg('system', 'ストーリーの下書きを作れませんでした。', { retry: { type: 'editor' } }),
    apply: (out) => {
      if (out.story) S.story = out.story;
      if (S.stage === 5) addMsg('facil', 'ストーリーの下書きを作りました。ボードで読めます。直したいところを話すか、カードを押して直してください。');
      return { ok: true, note: '下書きを作った' };
    }
  });
}
function runOrganizer() {
  const ops = activeNotes().filter((n) => OPINION.has(n.kind));
  if (ops.length < 2) { toast('意見の付箋が2枚以上になると、まとめられます。'); return null; }
  S.organizeCount = (S.organizeCount || 0) + 1;
  const variant = S.organizeCount;
  return runAgent('整理係', '〔まとめる〕', {
    delay: 1400, prompt: () => req('organizer', []), shape: Shape.organizer, fake: () => Fake.organizer(variant),
    apply: (out) => {
      S.proposal = out;
      if (!demo) openSheet('proposal');
      return { ok: true, note: `グループ${out.groups.length}つ・その他${out.other.length}枚の案：` + out.groups.map((g) => g.name).join('／') };
    }
  });
}
function runPersonas() {
  if (!activeNotes().some((n) => n.kind === 'idea' && n.author === 'scribe')) { toast('まずは、あなたのアイデアを1つ話してください。AI参加者は、そのあとに加わります。'); return; }
  if (S.personasDone) return;
  S.personasDone = true;
  renderActions();
  const keys = ['minami', 'kenji', 'sora'].filter((k) => !S.notes.some((n) => n.author === 'persona:' + k));
  const others = [];
  const step = (i) => { if (i >= keys.length) return; const k = keys[i];
    runAgent('AI参加者', '〔ほかの人のアイデアも聞く〕', {
      delay: 1300, prompt: () => req('persona', [k, others.slice()]), shape: Shape.persona, fake: () => Fake.persona(k),
      onFail: () => { S.personasDone = false; },
      apply: (out) => {
        out.ideas.forEach((t) => { others.push(t); addNote({ kind: 'idea', text: t, quote: t, author: 'persona:' + k, stage: 4, round: S.round }); });
        addMsg('persona:' + k, [out.comment, out.challenge].filter(Boolean).join(' '));
        return { ok: true, note: `${PERSONAS[k].name}：${out.ideas.join('／')}${out.challenge ? '・問い直し：' + out.challenge : ''}` };
      }
    }).then(() => step(i + 1)); };
  step(0);
}

/* ───────── 表示 ───────── */
function render() {
  renderStepper();
  renderMain();
  renderBoard();
  renderChat();
  renderActions();
  renderStatus();
  renderBar();
  $('#themeBtn').innerHTML = `お題：<b>${esc(DEMO.title)}</b>（資料を見る）`;
  const chip = $('#modeChip');
  chip.textContent = useAI() ? 'AI' : 'AI：台本';
  chip.className = 'modechip' + (useAI() ? '' : ' fake');
  save();
}
function renderBar() {
  const el = $('#hint');
  if (demo) {
    el.hidden = false;
    el.className = 'hint demo';
    el.innerHTML = `<p><b>デモを再生しています</b>：${esc(demo.label || '')}　AIは台本です。</p><button class="linkbtn" data-act="demo-stop">止める</button>`;
    return;
  }
  el.className = 'hint';
  el.hidden = !!S.hintClosed;
  el.innerHTML = `<p>試作版です。お題と数字は架空です。話した内容はこの端末に残り、AIの返事を作るためにだけ送ります。${useAI() ? '' : 'AIは台本の返事です。'}</p><button class="linkbtn" data-act="demo-ask">デモ</button><button class="linkbtn" data-act="hint-close">閉じる</button>`;
}
function renderStepper() {
  $('#stepper').innerHTML = STAGES.map((label, i) => {
    const cls = i === S.stage ? 'cur' : (i <= S.maxStage ? 'done' : '');
    const act = i !== S.stage && i <= S.maxStage && !demo ? ` data-act="back" data-stage="${i}"` : '';
    return `<button class="step ${cls}"${act} aria-current="${i === S.stage ? 'step' : 'false'}" aria-label="${esc(label)}"><span class="bar"></span>${esc(STEP_SHORT[i])}</button>`;
  }).join('');
}
function renderMain() {
  const main = $('#main');
  const tabs = S.settings.layout === 'tabs';
  main.className = 'main ' + (tabs ? 'tabs' : 'split');
  $('#tabbar').hidden = !tabs;
  $('#boardPanel').hidden = tabs && S.view !== 'board';
  $('#chatPanel').hidden = tabs && S.view !== 'chat';
  const newNotes = Math.max(0, activeNotes().length - S.seenNotes);
  const newMsgs = Math.max(0, S.messages.filter((m) => m.who !== 'user').length - S.seenMsgs);
  if (!tabs || S.view === 'board') S.seenNotes = activeNotes().length;
  if (!tabs || S.view === 'chat') S.seenMsgs = S.messages.filter((m) => m.who !== 'user').length;
  $('#tabBoard').innerHTML = 'ボード' + (tabs && S.view !== 'board' && newNotes ? `<span class="badge">${newNotes}</span>` : '');
  $('#tabChat').innerHTML = '会話' + (tabs && S.view !== 'chat' && newMsgs ? `<span class="badge">${newMsgs}</span>` : '');
  $('#tabBoard').setAttribute('aria-selected', String(S.view === 'board'));
  $('#tabChat').setAttribute('aria-selected', String(S.view === 'chat'));
  const trash = S.notes.filter((n) => n.status === 'trash').length;
  $('#trashBtn').textContent = trash ? `ごみ箱（${trash}）` : 'ごみ箱';
}
function noteHtml(n) {
  const kind = KIND[n.kind] || { label: n.kind, cls: '' };
  const ai = isAI(n);
  const who = ai ? PERSONAS[n.author.slice(8)].name + '（AI）' : '';
  const flags = n.flags.map((f) => `<span class="chip">${esc(f)}</span>`).join('') + (n.userEdited ? '<span class="chip">本人が直した</span>' : '');
  return `<button class="note ${ai ? 'k-ai' : kind.cls}${n.selected ? ' sel' : ''}${n.fresh ? ' fresh' : ''}" style="--r:${hashRot(n.id)}deg" data-act="note" data-note="${n.id}" id="note-${n.id}">
    <span class="meta"><span>${esc(who || kind.label)}</span><span class="n">${n.author === 'scribe' ? n.round + '回目' : ''}</span></span>
    <span class="txt">${esc(n.text)}</span>
    ${flags ? `<span class="flags">${flags}</span>` : ''}
  </button>`;
}
function sec(title, inner, sub) {
  return `<div class="sec"><div class="sec-h"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${inner}</div>`;
}
function checksHtml(chk) {
  if (!chk) return '<div class="checks"><span class="chk wait">点検中…</span></div>';
  return '<div class="checks">' + chk.items.map((i) => `<span class="chk ${i.status === 'ok' ? 'ok' : 'ng'}" title="${esc(i.hint || '')}">${esc(i.point)} ${i.status === 'ok' ? '✓' : '？'}</span>`).join('') + '</div>';
}
function linkHtml() {
  const l = S.checks.link;
  if (!l) return '';
  return `<div class="checks"><span class="chk ${l.status === 'ok' ? 'ok' : 'ng'}" title="${esc(l.reason || '')}">課題とのつながり ${l.status === 'ok' ? '✓' : '？'}</span></div>`;
}
function card(label, text, sub, key, extra) {
  return `<div class="card"><div class="lab"><span class="tag fixed">決定</span>${esc(label)}</div><div class="body">${esc(text)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}${extra || ''}<div class="row"><button class="btn" data-act="reconfirm" data-key="${key}">直す</button></div></div>`;
}
function renderBoard() {
  const el = $('#board');
  const C = S.confirmed;
  const h = [];
  if (S.stage === 0) {
    h.push(sec('お題の資料', `<div class="slides">${DEMO.slides.map((s, i) => `<div class="slide"><span class="no">スライド ${i + 1} / ${DEMO.slides.length}</span><h3>${esc(s.h)}</h3><p>${esc(s.b)}</p></div>`).join('')}</div><span class="fine">試作用の架空のお題です。数字も架空です。</span>`));
  }
  const conf = [];
  if (C.understanding) conf.push(card('お題の理解', C.understanding.text, '', 'understanding'));
  if (C.issue) conf.push(card('課題', C.issue.text, C.current ? '現状：' + C.current.text : '', 'issue', checksHtml(S.checks.issue)));
  if (C.goal) conf.push(card('望ましい姿', C.goal.text, C.indicator && C.indicator.text ? '指標：' + C.indicator.text : '指標：まだない', 'goal', checksHtml(S.checks.goal) + linkHtml()));
  if (C.solution) conf.push(card('解決案', C.solution.text, C.reason && C.reason.text ? '理由：' + C.reason.text : '', 'solution', C.solution.ai ? '<span class="tag ai">AI参加者の案を含む</span>' : ''));
  if (conf.length) h.push(sec('決めたこと', `<div class="cards">${conf.join('')}</div>`));
  const cands = [];
  ['issue', 'goal'].forEach((t) => {
    if (C[t]) return;
    const c = activeNotes().find((n) => n.kind === t);
    if (!c) return;
    const sups = activeNotes().filter((n) => n.kind === (t === 'issue' ? 'sup' : 'goalsup'));
    cands.push(`<div class="card cand ${t}"><div class="lab">${t === 'issue' ? '課題の案' : '望ましい姿の案'}<span>・本人の言葉から</span></div><div class="body">${esc(c.text)}</div>${sups.length ? `<div class="sub">補足：${sups.map((s) => esc(s.text)).join(' ／ ')}</div>` : ''}${checksHtml(S.checks[t])}${t === 'goal' ? linkHtml() : ''}<div class="row"><button class="btn" data-act="note" data-note="${c.id}">直す</button><button class="btn good" data-act="confirm">これで決める</button></div></div>`);
  });
  if (cands.length) h.push(sec('いまの案', `<div class="cards">${cands.join('')}</div>`, '点検の結果は、ファシリテーターの問いにも使われます'));
  const cited = (S.cited || []).map((id) => CHUNK[id]).filter(Boolean);
  if (cited.length) {
    h.push(sec('資料から', `<div class="cards">${cited.map((c) => `<button class="card fact" data-act="source" data-chunk="${c.id}"><span class="lab"><span class="tag src">${esc(c.doc.kind)}</span>${esc(c.doc.title)}（${esc(c.doc.year)}）</span><span class="body">${esc(c.text)}</span></button>`).join('')}</div>`, 'ファシリテーターが示した事実'));
  }
  if (S.stage === 5 || S.story) {
    const storyBody = S.story ? esc(S.story).replace(/\n/g, '<br>') : '<span class="fine">下書きを作っています…</span>';
    h.push(sec('ストーリー', `<div class="cards"><div class="card"><div class="lab">${C.story ? '<span class="tag fixed">決定</span>' : '<span class="tag ai">AIの下書き</span>'}</div><div class="body">${C.story ? esc(C.story.text).replace(/\n/g, '<br>') : storyBody}</div><div class="row"><button class="btn good" data-act="confirm-story">直して決める</button></div></div><div class="card dashed"><div class="lab">効果の見通し</div><div class="sub">RAG の設計と合わせて、あとで加えます（AIが作る項目）</div></div></div>`));
  }
  const seeds = activeNotes().filter((n) => n.kind === 'seed');
  const seedSec = seeds.length ? sec('気になったこと', `<div class="notes">${seeds.map(noteHtml).join('')}</div>`, S.stage > 0 ? '下準備で出たもの' : '') : '';
  if (S.stage === 0 && seedSec) h.push(seedSec);
  const ops = activeNotes().filter((n) => OPINION.has(n.kind));
  if (ops.length) {
    if (S.groups) {
      const inGroup = new Set();
      const gh = S.groups.map((g) => {
        const ns = g.noteIds.map(getNote).filter((n) => n && n.status === 'active');
        ns.forEach((n) => inGroup.add(n.id));
        return ns.length ? `<div class="group"><div class="group-h">${esc(g.name)}<span>${esc(g.nameSource)}</span></div><div class="notes">${ns.map(noteHtml).join('')}</div></div>` : '';
      }).join('');
      const rest = ops.filter((n) => !inGroup.has(n.id));
      h.push(sec('意見', gh + (rest.length ? `<div class="group"><div class="group-h">その他・あとから出た意見</div><div class="notes">${rest.map(noteHtml).join('')}</div></div>` : ''), `${ops.length}枚・グループ分けを使っています`));
    } else {
      h.push(sec('意見', `<div class="notes">${ops.map(noteHtml).join('')}</div>`, `${ops.length}枚`));
    }
  }
  const sups = activeNotes().filter((n) => (n.kind === 'sup' || n.kind === 'goalsup') && S.confirmed[n.kind === 'sup' ? 'issue' : 'goal']);
  if (sups.length) h.push(sec('課題と望ましい姿の補足', `<div class="notes">${sups.map(noteHtml).join('')}</div>`));
  const ideas = activeNotes().filter((n) => n.kind === 'idea');
  if (ideas.length) h.push(sec('アイデア', `<div class="notes">${ideas.map(noteHtml).join('')}</div>`, S.stage === 4 ? '付箋を押すと、解決案に選べます' : ''));
  if (S.stage > 0 && seedSec) h.push(seedSec);
  if (!h.length) h.push('<div class="empty">話したことは、ここに付箋になって貼られます。</div>');
  el.innerHTML = h.join('');
  if (renderBoard.stage !== S.stage) { el.scrollTop = 0; renderBoard.stage = S.stage; }
  const fresh = S.notes.filter((n) => n.fresh);
  if (fresh.length) {
    const last = document.getElementById('note-' + fresh[fresh.length - 1].id);
    if (last && last.scrollIntoView) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    fresh.forEach((n) => { n.fresh = false; });
  }
}
function renderChat() {
  const box = $('#chat');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const added = S.messages.length !== lastMsgCount;
  lastMsgCount = S.messages.length;
  const html = S.messages.map((m) => {
    if (m.who === 'system') return `<div class="msg system">${esc(m.text)}${m.retry ? ` <button class="linkbtn" data-act="retry" data-msg="${m.id}">もう一度</button>` : ''}</div>`;
    if (m.who === 'user') return `<div class="msg user"><span class="who">あなた${m.via === 'voice' ? '（声）' : ''}</span><div class="bubble">${esc(m.text)}</div></div>`;
    if (m.who.startsWith('persona:')) {
      const p = PERSONAS[m.who.slice(8)];
      return `<div class="msg persona"><span class="who">${esc(p.name)}・AI参加者・${esc(p.role)}</span><div class="bubble">${esc(m.text)}</div></div>`;
    }
    const refs = (m.refs || []).map(getNote).filter(Boolean).map((n) => `<button class="ref" data-act="ref" data-note="${n.id}">付箋：${esc(short(n.text, 16))}</button>`).join('')
      + (m.docRefs || []).map((id) => CHUNK[id]).filter(Boolean).map((c) => `<button class="ref src" data-act="source" data-chunk="${c.id}">出典：${esc(short(c.doc.title, 18))}</button>`).join('');
    return `<div class="msg facil"><span class="who">ファシリテーター</span><div class="bubble">${esc(m.text)}</div>${refs ? `<div class="refs">${refs}</div>` : ''}</div>`;
  }).join('');
  const typing = pending['ファシリ'] ? '<div class="typing" aria-label="ファシリテーターが考えています"><i></i><i></i><i></i></div>' : '';
  $('#msgs').innerHTML = html + typing;
  if (nearBottom || added) box.scrollTop = box.scrollHeight;
}
function renderStatus() {
  const map = { '書記': '書記が付箋を書いています…', '点検係': '点検しています…', '資料係': '資料を確かめています…', '整理係': '整理の案を作っています…', 'AI参加者': 'AI参加者が考えています…', '編集者': '下書きを作っています…' };
  $('#boardStatus').textContent = Object.keys(map).filter((k) => pending[k]).map((k) => map[k]).join(' ');
  $('#chatStatus').textContent = pending['ファシリ'] ? 'ファシリテーターが考えています…' : '';
  const box = $('#msgs');
  if (box) {
    const has = box.querySelector('.typing');
    if (pending['ファシリ'] && !has) { box.insertAdjacentHTML('beforeend', '<div class="typing" aria-label="ファシリテーターが考えています"><i></i><i></i><i></i></div>'); $('#chat').scrollTop = $('#chat').scrollHeight; }
    if (!pending['ファシリ'] && has) has.remove();
  }
}
function renderActions() {
  const st = S.stage;
  const dis = demo ? ' disabled' : '';
  const b = [];
  if (st === 0) b.push(`<button class="btn good" data-act="confirm"${dis}>これで決める（お題の理解）</button>`);
  if (st === 1 || st === 2) b.push(`<button class="btn" data-act="organize"${dis}>まとめる</button>`);
  if (st === 2) b.push(`<button class="btn good" data-act="confirm"${dis}>これで決める（課題）</button>`);
  if (st === 3) b.push(`<button class="btn good" data-act="confirm"${dis}>これで決める（望ましい姿）</button>`);
  if (st === 4) {
    b.push(`<button class="btn" data-act="personas"${S.personasDone || demo ? ' disabled' : ''}>ほかの人のアイデアも聞く</button>`);
    b.push(`<button class="btn good" data-act="confirm"${dis}>これで決める（解決案）</button>`);
  }
  if (st === 5) b.push(`<button class="btn good" data-act="confirm-story"${dis}>これで決める（ストーリー）</button>`);
  b.push('<span class="spacer"></span>');
  b.push(`<button class="btn primary${S.suggest && !demo ? ' pulse' : ''}" data-act="next"${dis}>${st === 5 ? 'ドキュメント ›' : '次へ ›'}</button>`);
  $('#actions').innerHTML = b.join('');
}
const MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const KBD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/></svg>';
function renderComposer() {
  const el = $('#composer');
  if (composerMode === 'voice' || demo) {
    const recording = rec || voice.state === 'recording';
    const secs = rec ? Math.floor((Date.now() - rec.start) / 1000) : voice.elapsedSec;
    const label = busy || voice.state === 'transcribing' ? '文字にしています…' : recording ? `話し終えたら押す　${secs}秒` : (demo ? 'デモを再生しています' : '押して話す');
    el.innerHTML = `<button class="iconbtn" data-act="mode-text" aria-label="キーボードで入力する"${demo ? ' disabled' : ''}>${KBD_SVG}</button><button class="mic${recording ? ' rec' : ''}${busy || demo || voice.state === 'transcribing' ? ' busy' : ''}" data-act="mic" id="micBtn" aria-pressed="${recording ? 'true' : 'false'}">${MIC_SVG}<span>${label}</span></button>`;
  } else {
    el.innerHTML = `<button class="iconbtn" data-act="mode-voice" aria-label="声で入力する">${MIC_SVG}</button><label class="sr" for="txt">発言を入力</label><input class="txtin" id="txt" type="text" placeholder="打ち込んで送る" enterkeyhint="send" autocomplete="off"><button class="btn primary" data-act="send">送る</button>`;
  }
}

/* ───────── シート ───────── */
function openSheet(type, data) { sheet = { type, data: data || {} }; renderSheet(); }
function closeSheet() { sheet = null; renderSheet(); }
function renderSheet() {
  const root = $('#sheetRoot');
  if (!sheet) { root.innerHTML = ''; return; }
  if (sheet.type === 'doc') { root.innerHTML = reportModal(!!sheet.data.appendix); const sc = root.querySelector('.rm-body'); if (sc) sc.scrollTop = sheet.data.scroll || 0; return; }
  root.innerHTML = `<div class="backdrop" id="backdrop"><div class="sheet" role="dialog" aria-modal="true">${SHEETS[sheet.type](sheet.data)}</div></div>`;
  const first = root.querySelector('textarea');
  if (first && !demo) first.focus();
}
const closeBtn = '<button class="btn" data-act="close">閉じる</button>';
const SHEETS = {
  note(d) {
    const n = getNote(d.id);
    if (!n) return '<p>付箋が見つかりません。</p>' + closeBtn;
    const msg = S.messages.find((m) => m.id === n.msgId);
    const who = isAI(n) ? PERSONAS[n.author.slice(8)].name + '（AI参加者）が出した案' : n.author === 'user' ? '本人' : '書記が本人の発言から作成';
    const editing = !!d.edit;
    const sel = S.stage === 4 && n.kind === 'idea' ? `<button class="btn good" data-act="note-select" data-note="${n.id}">${n.selected ? '解決案から外す' : '解決案に選ぶ'}</button>` : '';
    return `<h2>${esc((KIND[n.kind] || {}).label || '付箋')}</h2>
      ${editing ? `<div class="field"><label for="noteText">本文</label><textarea id="noteText">${esc(n.text)}</textarea><span class="help">直した付箋は、AIが上書きしません。</span></div>` : `<p style="font-size:17px">${esc(n.text)}</p>`}
      <dl class="kv"><dt>作った人</dt><dd>${esc(who)}${n.userEdited ? '（本人が直した）' : ''}</dd>
      ${n.author === 'scribe' ? `<dt>話した回</dt><dd>${n.round}回目</dd>` : ''}
      <dt>印</dt><dd>${n.flags.length ? esc(n.flags.join('、')) : 'なし'}</dd>
      <dt>掘り下げた回数</dt><dd>${n.dug || 0}回</dd><dt>版</dt><dd>${n.version}</dd></dl>
      ${n.quote && !isAI(n) ? `<div class="quote">付箋のもとになった部分：「${esc(n.quote)}」${msg && msg.text !== n.quote ? `<br>元の発言：「${esc(msg.text)}」` : ''}</div>` : ''}
      <div class="row">${editing ? `<button class="btn primary" data-act="note-save" data-note="${n.id}">保存</button>` : `<button class="btn" data-act="note-edit" data-note="${n.id}">直す</button>`}${sel}<button class="btn" data-act="note-trash" data-note="${n.id}">消す</button>${closeBtn}</div>`;
  },
  confirm(d) {
    const fields = confirmFields(d.key);
    return `<h2>${esc(fields.title)}</h2><p class="fine">${esc(fields.help)}</p>
      ${fields.items.map((f) => `<div class="field"><label for="f-${f.key}">${esc(f.label)}</label><textarea id="f-${f.key}" rows="${f.rows || 3}">${esc(f.value || '')}</textarea>${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`).join('')}
      ${fields.note ? `<p class="fine">${esc(fields.note)}</p>` : ''}
      <div class="row"><button class="btn primary" data-act="confirm-save" data-key="${fields.id}">これで決める</button><button class="btn" data-act="close">やめる</button></div>`;
  },
  proposal() {
    const p = S.proposal;
    if (!p) return '<p>案がありません。</p>' + closeBtn;
    const g = p.groups.map((gr) => `<div class="group"><div class="group-h">${esc(gr.name)}<span>${esc(gr.nameSource)}</span></div>${gr.noteIds.map(getNote).filter(Boolean).map((n) => `<div class="fine">・${esc(n.text)}</div>`).join('')}</div>`).join('');
    const o = p.other.length ? `<div class="group"><div class="group-h">その他</div>${p.other.map(getNote).filter(Boolean).map((n) => `<div class="fine">・${esc(n.text)}</div>`).join('')}</div>` : '';
    return `<h2>グループ分けの案</h2><p class="fine">整理係の案です。使うかどうかは、あなたが決めます。</p>${g}${o}
      <div class="row"><button class="btn primary" data-act="proposal-use">この案を使う</button><button class="btn" data-act="proposal-retry">作り直す</button>${S.groups ? '<button class="btn" data-act="proposal-clear">グループ分けをやめる</button>' : ''}${closeBtn}</div>`;
  },
  slides() {
    return `<h2>お題：${esc(DEMO.title)}</h2>${DEMO.slides.map((s, i) => `<div class="slide" style="max-width:none"><span class="no">スライド ${i + 1} / ${DEMO.slides.length}</span><h3>${esc(s.h)}</h3><p>${esc(s.b)}</p></div>`).join('')}
      <div class="field"><label>関連資料</label><span class="help">ファシリテーターが事実を確かめるときに使う資料です。事実を示すときは、必ず出典を添えます。</span>${DOCS.map((d) => `<div class="docrow"><span class="tag src">${esc(d.kind)}</span><span>${esc(d.title)}<br><span class="fine">${esc(d.org)}・${esc(d.year)}</span></span></div>`).join('')}</div>
      <p class="fine">試作用の架空のお題と資料です。数字も架空です。</p><div class="row">${closeBtn}</div>`;
  },
  source(d) {
    const c = CHUNK[d.id];
    if (!c) return '<p>資料が見つかりません。</p>' + closeBtn;
    return `<h2>${esc(c.doc.title)}</h2><p class="fine">${esc(c.doc.org)}・${esc(c.doc.year)}・${esc(c.doc.kind)}（試作用の架空の資料）</p>
      ${c.doc.chunks.map((t, i) => `<div class="quote${c.doc.id + '-' + (i + 1) === c.id ? ' hit' : ''}">${esc(t)}</div>`).join('')}
      <div class="row">${closeBtn}</div>`;
  },
  trash() {
    const t = S.notes.filter((n) => n.status === 'trash');
    return `<h2>ごみ箱</h2>${t.length ? t.map((n) => `<div class="row"><span style="flex:1;min-width:0">${esc(n.text)}</span><button class="btn" data-act="note-restore" data-note="${n.id}">戻す</button></div>`).join('') : '<p class="fine">消した付箋はありません。</p>'}<div class="row">${closeBtn}</div>`;
  },
  log() {
    const rows = S.log.map((e) => `<div class="e${e.ok ? '' : ' ng'}"><span class="r">${esc(e.role)}</span><span>${esc(e.trigger)}<span class="t">　${(e.ms / 1000).toFixed(1)}秒</span></span><span class="t">${esc(e.mode || '')}${e.tier ? '・' + esc(e.tier) : ''}</span><span>${esc(e.note)}</span></div>`).join('');
    return `<h2>AIの動き</h2><p class="fine">どの役が、何をきっかけに動き、何をしたか。プログラムが確かめて捨てた出力も残します。</p><div class="log">${rows || '<p class="fine">まだ記録はありません。</p>'}</div><div class="row">${closeBtn}</div>`;
  },
  settings() {
    const st = S.settings;
    return `<h2>設定</h2>
      <div class="field"><label>ボードと会話の並べ方</label><div class="opt"><button class="btn" data-act="set-layout" data-v="split" aria-pressed="${st.layout === 'split'}">上下に並べる</button><button class="btn" data-act="set-layout" data-v="tabs" aria-pressed="${st.layout === 'tabs'}">タブで切り替える</button></div><span class="help">広い画面では、どちらも左右に並びます。</span></div>
      <div class="field"><label>デモ</label><div class="row"><button class="btn" data-act="demo-ask">デモを最初から再生</button></div></div>
      <div class="field"><label>最初からやり直す</label>${sheet.data.reset ? '<div class="row"><span class="fine">ボードと会話を消して、下準備からやり直します。</span><button class="btn primary" data-act="reset-do">やり直す</button><button class="btn" data-act="settings">やめる</button></div>' : '<div class="row"><button class="btn" data-act="reset-ask">最初からやり直す</button></div>'}</div>
      <div class="row">${closeBtn}</div>`;
  },
  demo() {
        return `<h2>デモを最初から再生しますか？</h2>
      <p>例文を順に話し、〔まとめる〕〔これで決める〕〔次へ〕も自動で押して、下準備からドキュメントまで進めます。今のボードと会話は消えます。</p>
      <p class="fine">AIは台本の返事です。2分ほどで終わります。</p>
      <div class="row"><button class="btn primary" data-act="demo-start">再生する</button>${closeBtn}</div>`;
  },
  back(d) {
    return `<h2>${esc(STAGES[d.stage])}に戻りますか？</h2><p>ボードと、決めたことはそのまま残ります。戻ったあと、もう一度〔次へ〕で進めます。</p><div class="row"><button class="btn primary" data-act="back-do" data-stage="${d.stage}">戻る</button>${closeBtn}</div>`;
  }
};
function reportModal(appendix) {
  return `<div class="report-modal" role="dialog" aria-modal="true" aria-label="手元に残るドキュメント">
    <div class="rm-head"><span class="rm-title">手元に残るドキュメント</span><button class="iconbtn sm" data-act="close" aria-label="閉じる"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="rm-body">
      <div class="rm-tools">
        <label class="rm-check" for="appx"><input type="checkbox" id="appx" ${appendix ? 'checked' : ''}> 付録（ボードの付箋）を含める</label>
        <div class="rm-btns"><button class="dl-btn" data-act="copy">テキストをコピー</button><button class="dl-btn" data-act="download-html">HTMLで保存</button><button class="dl-btn" data-act="download">Markdownで保存</button></div>
        <p class="fine">付箋には、経験や個人的な事情が入りやすいので、はじめは含めない設定にしています（案）。壁やホストに届けるかは、あなたが決めます。試作では、届ける操作は作っていません。</p>
      </div>
      ${reportBody(appendix)}
      <textarea id="docRaw" class="sr" aria-hidden="true" tabindex="-1">${esc(docText(appendix))}</textarea>
    </div>
  </div>`;
}
function confirmFields(key) {
  const C = S.confirmed;
  const val = (k) => (C[k] && C[k].text) || '';
  const stage = key || ['understanding', null, 'issue', 'goal', 'solution', 'story'][S.stage];
  if (stage === 'understanding') {
    const last = [...S.messages].reverse().find((m) => m.who === 'user' && m.stage === 0 && !isQuestion(m.text));
    return { id: 'understanding', title: 'お題の理解を残す', help: 'お題を、自分の言葉で一言にしてください。', items: [{ key: 'understanding', label: 'お題を自分の言葉で一言', value: val('understanding') || (last ? clean(last.text) : '') }] };
  }
  if (stage === 'issue' || stage === 'current') {
    const cand = activeNotes().find((n) => n.kind === 'issue');
    const exp = activeNotes().filter((n) => n.kind === 'exp' || n.kind === 'trouble').slice(0, 3).map((n) => n.text.replace(/[。]$/, '')).join('。');
    return { id: 'issue', title: '課題を決める', help: '決めるのはあなたです。点検で「？」が残っていても、決めてかまいません。', items: [
      { key: 'current', label: '現状（何が起きているか）', value: val('current') || exp, help: 'ボードの経験・困りごとから下書きしています。' },
      { key: 'issue', label: '課題（1文）', value: val('issue') || (cand ? cand.text : '') }
    ] };
  }
  if (stage === 'goal' || stage === 'indicator') {
    const cand = activeNotes().find((n) => n.kind === 'goal');
    const ind = activeNotes().filter((n) => n.kind === 'goalsup' || n.kind === 'goal').map((n) => n.quote || n.text).reverse().find((s) => /(以下|以上|割|減|増|ゼロ)/.test(s)) || '';
    return { id: 'goal', title: '望ましい姿を決める', help: '誰が、どうなっているか。いつごろまでに。どうなったらわかるか。', items: [
      { key: 'goal', label: '望ましい姿（1文）', value: val('goal') || (cand ? cand.text : '') },
      { key: 'indicator', label: 'どうなったらわかるか（指標）', value: val('indicator') || ind, help: 'あとで効果の見通しの「ものさし」になります。なくても決められます。' }
    ] };
  }
  if (stage === 'solution' || stage === 'reason') {
    const sel = activeNotes().filter((n) => n.kind === 'idea' && n.selected);
    const ai = sel.filter(isAI);
    return { id: 'solution', title: '解決案を決める', help: 'ボードのアイデアの付箋を押すと、解決案に選べます。組み合わせてもかまいません。', items: [
      { key: 'solution', label: '解決案', value: val('solution') || sel.map((n) => n.text).join(' ＋ ') },
      { key: 'reason', label: '選んだ理由', value: val('reason'), help: '課題に効くか、望ましい姿に近づくか、実現できるか。' }
    ], note: ai.length ? `AI参加者の案（${ai.map((n) => PERSONAS[n.author.slice(8)].name).join('、')}）を含みます。ドキュメントにもそう残します。` : '' };
  }
  return { id: 'story', title: 'ストーリーを決める', help: '現状 → 望ましい姿 → 課題 → 解決案 → それでどうなるか。AIの下書きを直して決めてください。', items: [
    { key: 'story', label: 'ストーリー', value: val('story') || S.story, rows: 10 }
  ] };
}
function applyConfirm(id, vals) {
  const fields = confirmFields(id).items;
  if (!vals[id]) { toast('空のままでは決められません。'); return false; }
  const now = Date.now();
  fields.forEach((f) => {
    const old = S.confirmed[f.key];
    S.confirmed[f.key] = { text: vals[f.key] || '', at: now, history: old ? (old.history || []).concat([{ text: old.text, at: old.at }]) : [] };
  });
  if (id === 'solution') {
    const sel = activeNotes().filter((n) => n.kind === 'idea' && n.selected);
    S.confirmed.solution.noteIds = sel.map((n) => n.id);
    S.confirmed.solution.ai = sel.some(isAI);
  }
  addMsg('facil', {
    understanding: 'お題の理解を残しました。〔次へ〕で意見出しに進めます。',
    issue: '課題を確定しました。〔次へ〕でゴール設定に進めます。',
    goal: '望ましい姿を確定しました。課題とのつながりを確かめています。〔次へ〕でアイデア出しに進めます。',
    solution: '解決案を確定しました。〔次へ〕でまとめに進めます。',
    story: 'ストーリーを確定しました。〔ドキュメントを見る〕で、手元に残る形を確かめられます。'
  }[id]);
  logLocal('進行役', '〔これで決める〕', `確定事項「${id}」を本人の操作で書き換えた`);
  S.suggest = true;
  if (id === 'issue' || id === 'goal') runCheck(id);
  if (id === 'goal' || (id === 'issue' && S.confirmed.goal)) runCheck('link');
  if (id === 'issue' || id === 'goal') S.personasDone = false;
  return true;
}
function saveConfirm(id) {
  const vals = {};
  confirmFields(id).items.forEach((f) => { const el = document.getElementById('f-' + f.key); vals[f.key] = el ? el.value.trim() : ''; });
  if (applyConfirm(id, vals)) { closeSheet(); render(); }
}
/* ───────── 手元に残るドキュメント（いどばたのレポートの見た目） ─────────
   いどばたのレポート画面（QuestionDetail・MarkdownRenderer・markdown.css・OtherOpinionCard・full-screen-report-modal・download-button）に合わせる。
   画面に出すときも、HTML で保存するときも、同じ REPORT_CSS を使う */
const REPORT_CSS = `
.report { --r-fg: #09090b; --r-text: #404040; --r-sub: #4b5563; --r-muted: #71717a; --r-line: #e4e4e7; --r-quote: #d4d4d4;
  --r-p: #2b80ff; --r-p-dark: #2066ce; --r-p-ink: #154c9e; --r-p-weak: #d2e7ff; --r-p-100: #bad8ff; --r-p-tint: rgba(210, 231, 255, 0.35);
  --r-a-weak: #baf0e7; --r-a-ink: #00826d; --r-gray-50: #f9fafb; --r-gray-300: #d1d5db;
  max-width: 880px; margin: 0 auto; padding: 16px 0 32px; background: #fff; color: var(--r-text);
  font-family: "BIZ UDPGothic", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif; font-size: 16px; line-height: 2; letter-spacing: 0.025em; }
.report * { box-sizing: border-box; }
.report p { margin: 0; }
.rp-hero { display: grid; gap: 8px; padding: 24px; border: 1px solid var(--r-p-100); border-radius: 8px; background: var(--r-p-tint);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04); }
.rp-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; line-height: 1.6; font-weight: 700; color: var(--r-p-ink); }
.rp-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--r-p); }
.rp-title { margin: 0; font-family: "BIZ UDGothic", "BIZ UDPGothic", sans-serif; font-weight: 700; font-size: 26px; line-height: 1.62; color: var(--r-fg); text-wrap: balance; }
.rp-lead { color: var(--r-sub); }
.rp-meta { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 4px 0 0; padding: 0; list-style: none; font-size: 13px; line-height: 1.8; color: var(--r-muted); }
.rp-meta li { display: inline-flex; align-items: center; gap: 6px; }
.rp-meta svg { width: 16px; height: 16px; color: var(--r-p); flex: 0 0 auto; }
.rp-sec { margin-top: 32px; display: grid; gap: 12px; }
.rp-h2 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0; padding: 8px 0 0; font-size: 20px; line-height: 1.6; font-weight: 700; color: var(--r-fg); }
.rp-h2::before { content: ""; width: 4px; height: 24px; border-radius: 9999px; background: var(--r-p); flex: 0 0 auto; }
.rp-by { margin-left: auto; font-size: 12px; font-weight: 400; line-height: 1.8; padding: 0 10px; border-radius: 9999px; background: var(--r-gray-50); color: var(--r-muted); border: 1px solid var(--r-line); white-space: nowrap; }
.rp-by.ai { border-style: dashed; border-color: var(--r-gray-300); }
.rp-grid { display: grid; gap: 24px 16px; padding-top: 12px; }
@media (min-width: 640px) { .rp-grid.two { grid-template-columns: 1fr 1fr; } }
.rp-card { position: relative; display: grid; gap: 8px; align-content: start; padding: 24px 20px 20px; border: 1px solid rgba(0, 0, 0, 0.16); border-radius: 16px; background: #fff; }
.rp-card .main { color: var(--r-fg); font-size: 17px; font-weight: 700; line-height: 1.85; }
.rp-card .sub { font-size: 14px; line-height: 1.9; color: var(--r-sub); }
.rp-card .sub b { color: var(--r-fg); }
.rp-card.dashed { border-style: dashed; border-color: var(--r-gray-300); background: var(--r-gray-50); }
.rp-label { position: absolute; top: -13px; left: 16px; padding: 0 12px; border-radius: 9999px; background: var(--r-p-weak); border: 1px solid var(--r-p-100); color: var(--r-p-ink); font-size: 12px; font-weight: 700; line-height: 24px; letter-spacing: 0.025em; }
.rp-label.goal { background: var(--r-a-weak); border-color: var(--r-a-weak); color: var(--r-a-ink); }
.rp-tag { justify-self: start; font-size: 12px; line-height: 1.8; padding: 0 10px; border-radius: 9999px; background: var(--r-gray-50); color: var(--r-muted); border: 1px dashed var(--r-gray-300); }
.rp-story { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.rp-story li { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; padding: 12px 0; border-top: 1px solid var(--r-line); }
.rp-story li:first-child { border-top: 0; }
.rp-step { align-self: start; margin-top: 4px; padding: 0 10px; border-radius: 9999px; background: var(--r-p-weak); color: var(--r-p-ink); font-size: 12px; font-weight: 700; line-height: 24px; white-space: nowrap; }
.rp-story p { color: var(--r-text); }
.rp-sources { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
.rp-sources blockquote { margin: 0 0 4px; padding-left: 16px; border-left: 4px solid var(--r-quote); color: var(--r-text); }
.rp-sources cite { display: block; font-style: normal; font-size: 13px; line-height: 1.8; color: var(--r-muted); }
.rp-notes { display: grid; gap: 4px; margin: 0; padding-left: 20px; }
.rp-notes .k { color: var(--r-muted); font-size: 13px; margin-right: 6px; }
.rp-foot { margin-top: 40px; padding-top: 12px; border-top: 1px solid var(--r-line); text-align: center; font-size: 12px; line-height: 1.8; color: var(--r-muted); }
`;
(() => { const st = document.createElement('style'); st.id = 'report-css'; st.textContent = REPORT_CSS; document.head.appendChild(st); })();

const RP_ICON = {
  date: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6"/></svg>'
};
const todayJa = () => { const d = new Date(); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; };
function storySteps(text) {
  const parts = String(text || '').split(/【([^】]+)】/);
  const steps = [];
  for (let i = 1; i < parts.length; i += 2) steps.push({ h: parts[i].trim(), v: (parts[i + 1] || '').trim() });
  return steps.length ? steps : [{ h: 'ストーリー', v: String(text || '').trim() }];
}
function citedChunks() { return (S.cited || []).map((id) => CHUNK[id]).filter(Boolean); }
function reportBody(appendix) {
  const C = S.confirmed;
  const v = (k) => (C[k] && C[k].text) || '（まだ決まっていません）';
  const ai = C.solution && C.solution.ai;
  const sources = citedChunks();
  const by = (t, isAi) => `<span class="rp-by${isAi ? ' ai' : ''}">${esc(t)}</span>`;
  const h = [];
  h.push(`<header class="rp-hero">
    <span class="rp-badge"><span class="dot"></span>ひとりいどばた レポート</span>
    <h1 class="rp-title">${esc(DEMO.title)}</h1>
    ${C.understanding ? `<p class="rp-lead">本人の一言：${esc(C.understanding.text)}</p>` : ''}
    <ul class="rp-meta"><li>${RP_ICON.date}${esc(todayJa())}</li><li>${RP_ICON.person}本人がまとめ、AIが下書きと資料の確認を手伝った</li>${sources.length ? `<li>${RP_ICON.doc}参考にした資料 ${sources.length}件</li>` : ''}</ul>
  </header>`);
  h.push(`<section class="rp-sec"><h2 class="rp-h2">課題と望ましい姿${by('本人', false)}</h2>
    <div class="rp-grid two">
      <div class="rp-card"><span class="rp-label">課題</span><p class="main">${esc(v('issue'))}</p>${C.current && C.current.text ? `<p class="sub"><b>現状：</b>${esc(C.current.text)}</p>` : ''}</div>
      <div class="rp-card"><span class="rp-label goal">望ましい姿</span><p class="main">${esc(v('goal'))}</p>${C.indicator && C.indicator.text ? `<p class="sub"><b>指標：</b>${esc(C.indicator.text)}</p>` : ''}</div>
    </div></section>`);
  h.push(`<section class="rp-sec"><h2 class="rp-h2">解決案${by(ai ? '本人（AI参加者の案を含む）' : '本人', false)}</h2>
    <div class="rp-grid"><div class="rp-card"><span class="rp-label">解決案</span><p class="main">${esc(v('solution'))}</p>${C.reason && C.reason.text ? `<p class="sub"><b>選んだ理由：</b>${esc(C.reason.text)}</p>` : ''}${ai ? '<span class="rp-tag">AI参加者の案を含む</span>' : ''}</div></div></section>`);
  h.push(`<section class="rp-sec"><h2 class="rp-h2">ストーリー${by('AIの下書きを本人が確定', false)}</h2>
    <ol class="rp-story">${storySteps(C.story ? C.story.text : S.story).map((st) => `<li><span class="rp-step">${esc(st.h)}</span><p>${esc(st.v)}</p></li>`).join('')}</ol></section>`);
  h.push(`<section class="rp-sec"><h2 class="rp-h2">効果の見通し${by('AIが作る項目', true)}</h2>
    <div class="rp-card dashed"><p class="sub">関連資料をもとに、似た事例と効果の幅を出典つきで示す欄です。RAG の設計と合わせて、あとで加えます。</p></div></section>`);
  if (sources.length) {
    h.push(`<section class="rp-sec"><h2 class="rp-h2">参考にした資料${by('ファシリテーターが示した事実', true)}</h2>
      <ul class="rp-sources">${sources.map((c) => `<li><blockquote>${esc(c.text)}</blockquote><cite>${esc(c.doc.title)}（${esc(c.doc.org)}・${esc(c.doc.year)}・${esc(c.doc.kind)}）</cite></li>`).join('')}</ul></section>`);
  }
  if (appendix) {
    const notes = activeNotes();
    h.push(`<section class="rp-sec"><h2 class="rp-h2">付録：ボードの付箋${by('本人の言葉から書記が作成', false)}</h2>
      <ul class="rp-notes">${notes.map((n) => `<li><span class="k">${esc((KIND[n.kind] || {}).label || '')}${isAI(n) ? '・AI参加者' : ''}</span>${esc(n.text)}</li>`).join('') || '<li>（なし）</li>'}</ul></section>`);
  }
  h.push('<footer class="rp-foot">ひとりいどばた（試作）・試作用の架空のお題と資料です</footer>');
  return `<article class="report">${h.join('')}</article>`;
}
function reportHtmlFile(appendix) {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ひとりいどばた：${esc(DEMO.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDGothic:wght@400;700&family=BIZ+UDPGothic:wght@400;700&display=swap">
<style>body { margin: 0; padding: 16px; background: #fff; } ${REPORT_CSS}</style></head>
<body>${reportBody(appendix)}</body></html>`;
}

function docSections(appendix) {
  const C = S.confirmed;
  const v = (k) => (C[k] && C[k].text) || '（未確定）';
  const s = [
    { h: 'お題', v: DEMO.title + (C.understanding ? '\n本人の一言：' + C.understanding.text : ''), by: '本人' },
    { h: '現状', v: v('current'), by: '本人' },
    { h: '課題', v: v('issue'), by: '本人' },
    { h: '望ましい姿', v: v('goal') + (C.indicator && C.indicator.text ? '\n指標：' + C.indicator.text : ''), by: '本人' },
    { h: '解決案', v: v('solution') + (C.reason && C.reason.text ? '\n理由：' + C.reason.text : ''), by: C.solution && C.solution.ai ? '本人（AI参加者の案を含む）' : '本人' },
    { h: 'ストーリー', v: v('story'), by: 'AIの下書きを本人が確定' },
    { h: '効果の見通し', v: 'RAG の設計と合わせて、あとで加えます。', by: 'AIが作る項目' }
  ];
  const src = citedChunks();
  if (src.length) s.push({ h: '参考にした資料', v: src.map((c) => `・${c.text}\n　（${c.doc.title}／${c.doc.org}・${c.doc.year}）`).join('\n'), by: 'ファシリテーターが示した事実' });
  if (appendix) {
    s.push({ h: '付録：ボードの付箋', v: activeNotes().map((n) => `・[${(KIND[n.kind] || {}).label}${isAI(n) ? '・AI参加者' : ''}] ${n.text}`).join('\n') || '（なし）', by: '本人の言葉から書記が作成' });
  }
  return s;
}
function docText(appendix) {
  const d = new Date();
  return `# ひとりいどばた：${DEMO.title}\n\n${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日\n\n` + docSections(appendix).map((s) => `## ${s.h}\n\n${s.v}\n\n（${s.by}）\n`).join('\n');
}

/* ───────── デモ ───────── */
function idle(limit) {
  const max = limit || 240000;
  return new Promise((res) => {
    const t0 = Date.now();
    const tick = () => {
      const working = Object.values(pending).some((v) => v > 0);
      if (!working || Date.now() - t0 > max || (demo && demo.stop)) res();
      else setTimeout(tick, 300);
    };
    setTimeout(tick, 250);
  });
}
async function demoSpeak(line) {
  rec = { start: Date.now(), timer: setInterval(renderComposer, 400) };
  renderComposer();
  await pause(1100);
  clearInterval(rec.timer);
  rec = null;
  busy = true;
  renderComposer();
  await pause(400);
  busy = false;
  renderComposer();
  send(line, 'voice');
}
function demoConfirm(id) {
  const vals = {};
  confirmFields(id).items.forEach((f) => { vals[f.key] = f.value || ''; });
  if (id === 'solution' && !vals.reason) vals.reason = '課題の「見守る大人のいない時間」に直接効き、今ある場所と人で始められるから。';
  if (applyConfirm(id, vals)) { toast('デモ：〔これで決める〕を押しました。'); render(); }
}
async function runDemo() {
  if (demo) return;
  const ai = S.settings.ai; const layout = S.settings.layout;
  S = fresh();
  S.settings.ai = ai; S.settings.layout = layout; S.hintClosed = false;
  addMsg('facil', ENTRY[0], { stage: 0 });
  lastMsgCount = 0;
  demo = { stop: false, label: '準備中' };
  closeSheet();
  render();
  renderComposer();
  logLocal('デモ', '再生を始めた', 'AI：台本');
  let status = 'done';
  try {
    for (let st = 0; st <= 5; st++) {
      if (demo.stop) throw new Error('stop');
      if (S.stage !== st) { goStage(st, false); await pause(800); }
      if (st === 5) { demo.label = 'まとめ（下書きを作っています）'; renderBar(); await idle(); await pause(800); }
      const lines = SCRIPT[st];
      for (let i = 0; i < lines.length; i++) {
        if (demo.stop) throw new Error('stop');
        demo.label = `${STAGES[st]}（${i + 1} / ${lines.length}）`;
        renderBar();
        await demoSpeak(lines[i]);
        await idle();
        await pause(900);
      }
      if (demo.stop) throw new Error('stop');
      if (st === 1) {
        demo.label = '意見出し（〔まとめる〕）'; renderBar();
        const p = runOrganizer();
        if (p) { await p; await idle(); }
        if (S.proposal) { S.groups = S.proposal.groups; logLocal('本人', '〔この案を使う〕', 'デモ：整理の案を採用した'); render(); }
        await pause(900);
      }
      if (st === 4) {
        demo.label = 'アイデア出し（〔ほかの人のアイデアも聞く〕）'; renderBar();
        runPersonas();
        await pause(1200);
        await idle();
        const ideas = activeNotes().filter((n) => n.kind === 'idea');
        const mine = ideas.find((n) => !isAI(n));
        const theirs = ideas.find((n) => n.author === 'persona:minami') || ideas.find(isAI);
        [mine, theirs].filter(Boolean).forEach((n) => { n.selected = true; });
        render();
        await pause(900);
      }
      const confirmId = ['understanding', null, 'issue', 'goal', 'solution', 'story'][st];
      if (confirmId) { demoConfirm(confirmId); await idle(); await pause(900); }
    }
    openSheet('doc', { appendix: false });
  } catch (e) {
    status = 'stopped';
    toast('デモを止めました。');
  } finally {
    logLocal('デモ', status === 'done' ? '最後まで進んだ' : '止めた', '');
    demo = null;
    renderComposer();
    render();
  }
}

/* ───────── 操作 ───────── */
function startStopMic() {
  if (demo || voice.state === 'transcribing') return;
  api.voice.toggle();
}
/* 録音は React 側（useVoiceInput）が持ち、状態だけを受け取る */
function setVoice(next) {
  if (next.error && next.error !== voice.error) toast(next.error);
  voice = next;
  if (composerMode === 'voice') renderComposer();
}
function saveFile(filename, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type: type + ';charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast('保存しました。');
}
function sendTyped() {
  const t = $('#txt');
  if (!t || !t.value.trim() || demo) return;
  const v = t.value;
  t.value = '';
  send(v, 'text');
  t.focus();
}
function showNote(id) {
  if (S.settings.layout === 'tabs' && S.view !== 'board') { S.view = 'board'; render(); }
  const el = document.getElementById('note-' + id);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1600);
}

const ACTIONS = {
  close: closeSheet,
  'hint-close': () => { S.hintClosed = true; render(); },
  view: (t) => { S.view = t.dataset.view; render(); },
  mic: startStopMic,
  'mode-text': () => { if (demo || voice.state !== 'idle') return; composerMode = 'text'; renderComposer(); const t = $('#txt'); if (t) t.focus(); },
  'mode-voice': () => { composerMode = 'voice'; renderComposer(); },
  send: sendTyped,
  next: () => {
    if (demo) return;
    const why = canLeave(S.stage);
    if (why) { toast(why); return; }
    if (S.stage === 5) { openSheet('doc', { appendix: false }); return; }
    goStage(S.stage + 1, false);
  },
  back: (t) => { if (!demo) openSheet('back', { stage: Number(t.dataset.stage) }); },
  'back-do': (t) => { closeSheet(); goStage(Number(t.dataset.stage), true); },
  note: (t) => openSheet('note', { id: t.dataset.note }),
  ref: (t) => showNote(t.dataset.note),
  source: (t) => openSheet('source', { id: t.dataset.chunk }),
  'note-edit': (t) => openSheet('note', { id: t.dataset.note, edit: true }),
  'note-save': (t) => {
    const n = getNote(t.dataset.note);
    const v = $('#noteText').value.trim();
    if (!v) { toast('空の付箋にはできません。消すときは〔消す〕を押してください。'); return; }
    if (n && v !== n.text) { n.text = v; n.userEdited = true; n.version += 1; recheckFor(n); }
    logLocal('本人', '〔直す〕', '付箋を直した（以後、AIは本文を上書きしない）');
    closeSheet(); render();
  },
  'note-trash': (t) => { const n = getNote(t.dataset.note); if (n) { n.status = 'trash'; n.selected = false; n.version += 1; recheckFor(n); } closeSheet(); render(); toast('ごみ箱に入れました。ごみ箱から戻せます。'); },
  'note-restore': (t) => { const n = getNote(t.dataset.note); if (n) { if ((n.kind === 'issue' || n.kind === 'goal') && activeNotes().some((x) => x.kind === n.kind)) n.kind = n.kind === 'issue' ? 'sup' : 'goalsup'; n.status = 'active'; n.version += 1; recheckFor(n); } render(); renderSheet(); },
  'note-select': (t) => { const n = getNote(t.dataset.note); if (n) n.selected = !n.selected; closeSheet(); render(); },
  trash: () => openSheet('trash'),
  log: () => openSheet('log'),
  slides: () => openSheet('slides'),
  settings: () => openSheet('settings'),
  'set-layout': (t) => { S.settings.layout = t.dataset.v; render(); renderSheet(); },
  'reset-ask': () => openSheet('settings', { reset: true }),
  'reset-do': () => {
    const keep = S.settings;
    S = fresh(); S.settings = keep;
    addMsg('facil', ENTRY[0], { stage: 0 });
    lastMsgCount = 0;
    closeSheet(); render();
  },
  retry: (t) => {
    const m = S.messages.find((x) => x.id === t.dataset.msg);
    if (!m || !m.retry) return;
    const { retry } = m;
    S.messages = S.messages.filter((x) => x !== m);
    if (retry.type === 'editor') { runEditor(); render(); return; }
    const said = S.messages.find((x) => x.id === retry.msgId);
    if (!said || said.stage !== S.stage) { toast('段階が変わったので、もう一度話してください。'); render(); return; }
    dispatch(said, retry.roles.scribe ? { facil: !!retry.roles.facil, scribe: true } : { facil: true, scribe: false });
  },
  'demo-ask': () => openSheet('demo'),
  'demo-start': () => { runDemo(); },
  'demo-stop': () => { if (demo) { demo.stop = true; demo.label = '止めています（動いているAIの返事を待っています）'; renderBar(); } },
  organize: () => { if (!demo) runOrganizer(); },
  'proposal-use': () => { S.groups = S.proposal.groups; logLocal('本人', '〔この案を使う〕', '整理の案を採用した'); closeSheet(); render(); },
  'proposal-retry': () => { closeSheet(); runOrganizer(); },
  'proposal-clear': () => { S.groups = null; closeSheet(); render(); },
  personas: () => { if (!demo) runPersonas(); },
  confirm: () => { if (!demo) openSheet('confirm', {}); },
  reconfirm: (t) => { if (!demo) openSheet('confirm', { key: t.dataset.key }); },
  'confirm-story': () => { if (!demo) openSheet('confirm', { key: 'story' }); },
  'confirm-save': (t) => saveConfirm(t.dataset.key),
  copy: () => {
    const text = docText(!!(sheet && sheet.data.appendix));
    const done = () => toast('コピーしました。');
    const fallback = () => { const ta = $('#docRaw'); if (ta) { ta.classList.remove('sr'); ta.select(); } toast('コピーできませんでした。選んだ文字を長押しでコピーしてください。'); };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  },
  'download-html': () => {
    saveFile('ひとりいどばた.html', reportHtmlFile(!!(sheet && sheet.data.appendix)), 'text/html');
  },
  download: () => {
    saveFile('ひとりいどばた.md', docText(!!(sheet && sheet.data.appendix)), 'text/markdown');
  }
};

root.addEventListener('click', (e) => {
  if (e.target.id === 'backdrop') { closeSheet(); return; }
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACTIONS[t.dataset.act];
  if (fn) fn(t, e);
});
root.addEventListener('change', (e) => {
  if (e.target.id === 'appx' && sheet && sheet.type === 'doc') { const sc = root.querySelector('.rm-body'); sheet.data.scroll = sc ? sc.scrollTop : 0; sheet.data.appendix = e.target.checked; renderSheet(); }
});
root.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'txt' && !e.isComposing) { e.preventDefault(); sendTyped(); }
  if (e.key === 'Escape' && sheet) closeSheet();
});

function destroy() {
  if (demo) demo.stop = true;
  clearTimeout(saveTimer);
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 保存できなくても動く */ }
}

renderComposer();
render();

return {
  sendVoice: (text) => send(text, 'voice'),
  setVoice,
  destroy,
};
}
