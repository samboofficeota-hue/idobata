// 意見グループの色分け
// UIの色は tailwind.config.js のカラースケールに揃えるが、グループの塗り分けは
// テーマ色（青・水色・グレー）だけでは見分けがつかないため、kouchou-ai の
// ScatterChart と同じ配色をデータ表示専用に使う
const CLUSTER_COLORS = [
  "#7ac943",
  "#3fa9f5",
  "#ff7997",
  "#e0dd02",
  "#d6410f",
  "#b39647",
  "#7cccc3",
  "#a147e6",
  "#ff6b6b",
  "#4ecdc4",
  "#ffbe0b",
  "#fb5607",
  "#8338ec",
  "#3a86ff",
  "#ff006e",
  "#8ac926",
  "#1982c4",
  "#6a4c93",
  "#f72585",
  "#7209b7",
] as const;

// 絞り込みや「濃い意見」で対象外になった意見の色
export const MUTED_POINT_COLOR = "#cccccc";

export function clusterColor(index: number): string {
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
}

// 背景色の明るさに応じて、読みやすい文字色（白か濃いグレー）を返す
export function textColorOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1f2937" : "#ffffff";
}
