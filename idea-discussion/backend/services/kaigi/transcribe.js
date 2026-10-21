import pLimit from "p-limit";
import { transcribeAudio } from "../llmService.js";

// いどばた会議室の音声入力。参加者がスマホで録った1回分（押して話す → 止める）を文字にする
// 文字は入力欄に入るだけで、送るかどうか・直すかどうかは本人が決める

// 1回の録音の上限。画面側でも同じ秒数で止める
export const MAX_RECORDING_SEC = 60;
// 60秒の録音は webm（Opus）で約0.5MB、mp4（AAC）で約1MB。余裕を見て上限を決める
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
// これより小さいファイルは、ほぼ無音か押し間違い。送らずに断る
export const MIN_AUDIO_BYTES = 1024;

// 同時に文字にする数の上限。超えた分は順番待ち（音声の利用枠は対話とは別に数えられる）
const limit = pLimit(Number(process.env.KAIGI_TRANSCRIBE_CONCURRENCY) || 10);

// ファイルの先頭のバイト列から音声の形式を判定する。拡張子は OpenAI が形式を判定するのに使う
// iPhone の Safari は mp4（AAC）、Android の Chrome は webm（Opus）で録る
export const detectAudioExtension = (buffer) => {
  if (!buffer || buffer.length < 12) return null;
  const ascii = (start, end) => buffer.subarray(start, end).toString("latin1");
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "webm";
  }
  if (ascii(4, 8) === "ftyp") return "mp4";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (
    ascii(0, 3) === "ID3" ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return "mp3";
  }
  return null;
};

const clip = (value, max) => {
  const s = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

// 言葉の手がかり。お題・背景・直前のAIの発言に出てくる言葉（地名、施設名、制度の名前など）を
// 取り違えにくくする。句読点の付いた文を渡すと、結果にも句読点が付きやすい
export const buildTranscribePrompt = (room, session) => {
  const lastAi = [...(session?.messages ?? [])]
    .reverse()
    .find((m) => m.speaker !== "user");
  const parts = [
    `お題は「${clip(room?.title, 100)}」です。`,
    room?.background ? `背景：${clip(room.background, 200)}` : "",
    lastAi ? `直前の問いかけ：${clip(lastAi.content, 150)}` : "",
    "以下は、参加者がこれについて話した内容です。",
  ];
  return parts.filter(Boolean).join("\n");
};

// 無音や雑音だけの音声に対して、話していない定型文が返ってくることがある（Whisper 系でよく知られた癖）
// 結果の全体がこうした文だけのときは、空として扱う
const PHANTOM_PHRASES = [
  "ご視聴ありがとうございました",
  "最後までご視聴いただきありがとうございました",
  "ご覧いただきありがとうございました",
  "チャンネル登録よろしくお願いします",
  "チャンネル登録お願いします",
  "おやすみなさい",
];
const PUNCTUATION = /[\s。、．，.,!！?？「」『』…・〜~ー-]/g;
const normalizePhrase = (s) => s.replace(PUNCTUATION, "");
const PHANTOMS = new Set(PHANTOM_PHRASES.map(normalizePhrase));

const PROMPT_MARKERS = [
  "以下は参加者がこれについて話した内容です",
  "直前の問いかけ：",
].map(normalizePhrase);

export const cleanTranscript = (raw) => {
  const text = String(raw ?? "").trim();
  const bare = normalizePhrase(text);
  if (!bare) return "";
  if (PHANTOMS.has(bare)) return "";
  // 手がかりの文がそのまま返ってくることもある（話していないのに、渡した文を読み上げたような結果）
  if (PROMPT_MARKERS.some((marker) => bare.includes(marker))) return "";
  return text;
};

export const transcribeForSession = (room, session, audio, extension) =>
  limit(async () => {
    const prompt = buildTranscribePrompt(room, session);
    const raw = await transcribeAudio(audio, `speech.${extension}`, {
      language: "ja",
      prompt,
    });
    return cleanTranscript(raw);
  });
