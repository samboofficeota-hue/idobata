import Papa from "papaparse";
import type { KouchouComment } from "../../services/kouchou/types";

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

// CSVの行を kouchou-ai に送るコメントに変換する
// id列が空・重複している行には行番号のIDを振り、IDが一意になるようにする
export function buildComments(
  csv: ParsedCsv | null,
  commentColumn: string,
  attributeColumns: string[]
): KouchouComment[] {
  if (!csv) return [];
  const seen = new Set<string>();
  const comments: KouchouComment[] = [];
  csv.rows.forEach((row, index) => {
    const text = (row[commentColumn] ?? "").trim();
    if (text === "") return;
    let id = row.id || row["comment-id"] || `csv-${index + 1}`;
    if (seen.has(id)) id = `csv-${index + 1}`;
    seen.add(id);
    const comment: KouchouComment = {
      id,
      comment: text,
      source: row.source || null,
      url: row.url || null,
    };
    for (const column of attributeColumns) {
      comment[`attribute_${column}`] = row[column] ?? "";
    }
    comments.push(comment);
  });
  return comments;
}
