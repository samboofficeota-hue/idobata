import type { KouchouCluster } from "../../services/kouchou/types";

// 「濃い意見」の初期値（kouchou-ai の ClientContainer と同じ）
export const DEFAULT_MAX_DENSITY = 0.2;
export const DEFAULT_MIN_VALUE = 5;

// 図の高さ。広い画面では横長、スマホではほぼ正方形にする
export function chartHeightForWidth(width: number): number {
  if (width < 640) return Math.round(width * 0.95);
  return Math.min(Math.max(Math.round(width * 0.56), 420), 640);
}

export function deepestLevel(clusters: KouchouCluster[]): number {
  return clusters.reduce((max, c) => Math.max(max, c.level), 0);
}

// 最も細かい階層の意見グループのうち、密度が上位 maxDensity 以内で、
// 意見が minValue 件以上あるものを「濃い意見グループ」とする（kouchou-ai と同じ条件）
export function getDenseClusters(
  clusters: KouchouCluster[],
  maxDensity: number,
  minValue: number
): KouchouCluster[] {
  const level = deepestLevel(clusters);
  return clusters
    .filter((c) => c.level === level)
    .filter((c) => (c.density_rank_percentile ?? 1) <= maxDensity)
    .filter((c) => c.value >= minValue)
    .sort((a, b) => b.value - a.value);
}

export type Rect = { x: number; y: number; w: number; h: number };

// 面積が値に比例するように長方形を分割する（squarified treemap）
// items は値の大きい順に並んでいること
export function squarify<T extends { value: number }>(
  items: T[],
  bounds: Rect
): (T & Rect)[] {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (total <= 0 || bounds.w <= 0 || bounds.h <= 0) return [];
  const scale = (bounds.w * bounds.h) / total;
  const result: (T & Rect)[] = [];
  let rest = items.filter((i) => i.value > 0);
  let { x, y, w, h } = bounds;

  const worst = (row: T[], side: number) => {
    const areas = row.map((i) => i.value * scale);
    const sum = areas.reduce((a, b) => a + b, 0);
    const max = Math.max(...areas);
    const min = Math.min(...areas);
    return Math.max(
      (side * side * max) / (sum * sum),
      (sum * sum) / (side * side * min)
    );
  };

  while (rest.length > 0) {
    const side = Math.min(w, h);
    const row: T[] = [rest[0]];
    let i = 1;
    while (
      i < rest.length &&
      worst([...row, rest[i]], side) <= worst(row, side)
    ) {
      row.push(rest[i]);
      i += 1;
    }
    rest = rest.slice(i);

    const rowArea = row.reduce((sum, item) => sum + item.value * scale, 0);
    if (w >= h) {
      // 左端に縦一列で並べる
      const colW = rowArea / h;
      let cy = y;
      for (const item of row) {
        const ih = (item.value * scale) / colW;
        result.push({ ...item, x, y: cy, w: colW, h: ih });
        cy += ih;
      }
      x += colW;
      w -= colW;
    } else {
      // 上端に横一列で並べる
      const rowH = rowArea / w;
      let cx = x;
      for (const item of row) {
        const iw = (item.value * scale) / rowH;
        result.push({ ...item, x: cx, y, w: iw, h: rowH });
        cx += iw;
      }
      y += rowH;
      h -= rowH;
    }
  }
  return result;
}

// 点の集まりを囲む最小の凸多角形（凸包）を求める（Andrew の monotone chain）
// 意見グループごとの背景色の範囲に使う（kouchou-ai の public-viewer と同じ表現）
export function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of [...sorted].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
