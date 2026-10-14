import type { KaigiOutputKey, KaigiSpeaker } from "../../services/kaigi/types";

// AIの名前と立場（backend の services/kaigi/prompts.js の PERSONAS と合わせる）
export const SPEAKERS: Record<
  KaigiSpeaker,
  { name: string; role: string; bubble: string; badge: string }
> = {
  user: {
    name: "あなた",
    role: "",
    bubble: "bg-primary-50 border-primary-300",
    badge: "bg-primary-700 text-white",
  },
  facilitator: {
    name: "ファシリ",
    role: "ファシリテーター",
    bubble: "bg-white border-neutral-300",
    badge: "bg-neutral-700 text-white",
  },
  member1: {
    name: "ミナミ",
    role: "当事者の目線",
    bubble: "bg-amber-50 border-amber-300",
    badge: "bg-amber-600 text-white",
  },
  member2: {
    name: "ケンジ",
    role: "反対の立場",
    bubble: "bg-rose-50 border-rose-300",
    badge: "bg-rose-600 text-white",
  },
  member3: {
    name: "ソラ",
    role: "外から来た人",
    bubble: "bg-emerald-50 border-emerald-300",
    badge: "bg-emerald-600 text-white",
  },
  editor: {
    name: "編集者",
    role: "編集者",
    bubble: "bg-white border-neutral-300",
    badge: "bg-neutral-500 text-white",
  },
};

export const OUTPUT_LABELS: Record<KaigiOutputKey, string> = {
  domain: "対象領域",
  issue: "課題",
  solution: "解決策",
};

export const OUTPUT_KEYS: KaigiOutputKey[] = ["domain", "issue", "solution"];

// 工程（backend の services/kaigi/steps.js と合わせる）
export const STEP_LABELS: Record<number, string> = {
  1: "お題",
  2: "思いを書き出す",
  3: "みんなの声を見る",
  4: "課題を絞る",
  5: "課題を言葉にする",
  6: "アイディアを広げる",
  7: "行ったり来たり",
  8: "決める",
  9: "ストーリーにする",
  10: "スライドにする",
};

export const CAPACITY_OPTIONS = [
  { value: 5, label: "5人まで", price: "500円" },
  { value: 10, label: "10人まで", price: "1,000円" },
  { value: 50, label: "50人まで", price: "3,000円" },
];
