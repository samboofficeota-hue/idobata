import Papa from "papaparse";

export interface ParsedCsv {
  columns: string[];
  rows: Record<string, string>[];
}

// Excelで保存したCSVはShift_JISのことが多いため、UTF-8で読めなければShift_JISとして読む
const decode = (buffer: ArrayBuffer): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("shift_jis").decode(buffer);
  }
};

export async function parseCsv(file: File): Promise<ParsedCsv> {
  const text = decode(await file.arrayBuffer()).replace(/^﻿/, "");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(result.errors[0].message);
  }
  return {
    columns: (result.meta.fields ?? []).filter((c) => c !== ""),
    rows: result.data,
  };
}

const COMMENT_COLUMN_NAMES = [
  "comment",
  "comment-body",
  "コメント",
  "意見",
  "本文",
];

// コメント列の候補を推定する（名前が一致する列、なければ平均文字数が最も長い列）
export function guessCommentColumn({ columns, rows }: ParsedCsv): string {
  const byName = columns.find((c) =>
    COMMENT_COLUMN_NAMES.includes(c.toLowerCase())
  );
  if (byName) return byName;

  const sample = rows.slice(0, 200);
  let best = columns[0] ?? "";
  let bestLength = -1;
  for (const column of columns) {
    const avg =
      sample.reduce((sum, row) => sum + (row[column]?.length ?? 0), 0) /
      Math.max(sample.length, 1);
    if (avg > bestLength) {
      best = column;
      bestLength = avg;
    }
  }
  return best;
}

// kouchou-ai本体と同じ推奨値（コメント数の立方根を第1階層、その2乗を第2階層）
export function recommendedClusters(commentCount: number): [number, number] {
  const lv1 = Math.max(2, Math.min(10, Math.round(Math.cbrt(commentCount))));
  const lv2 = Math.max(2, Math.min(1000, lv1 * lv1));
  return [lv1, lv2];
}
