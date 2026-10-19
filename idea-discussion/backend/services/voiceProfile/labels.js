// 声のプロフィールの値の候補。試しながら増やす・減らす・変える
// 候補や指示文を変えたら PROFILE_SCHEMA_VERSION を上げる（古いプロフィールは作り直しの対象になる）

export const PROFILE_SCHEMA_VERSION = 1;

// 誰の立場からの声か（お題との関わり方）
export const STANCES = {
  affected: "当事者（自分が直接困っている・影響を受ける）",
  close: "周りの人（家族・近所・同僚など、当事者の身近な人）",
  supporter: "支える立場（支援者・専門職・現場で働く人）",
  decider: "決める・運営する立場（役員・行政・管理する側）",
  outsider: "外から見ている人（直接の関わりは薄い）",
  unknown: "読み取れない",
};

// 何に基づく声か
export const EVIDENCES = {
  experience: "自分の経験",
  observed: "見たり聞いたりしたこと",
  opinion: "考え・推測",
  unknown: "読み取れない",
};

// 何を大事にしているか（0〜3個）
export const VALUES = [
  "安全",
  "健康",
  "費用",
  "手間",
  "便利さ",
  "公平",
  "自由",
  "つながり",
  "環境",
  "学び",
  "将来",
  "伝統",
];

export const MAX_VALUES = 3;
export const MAX_REASON_LENGTH = 80;
export const MAX_CONCERN_LENGTH = 80;
