// 意見グループの色分け
// デザインガイドラインに従い、直接カラーコードは使わず tailwind.config.js のカラースケールのみを使う
const CLUSTER_COLOR_CLASSES = [
  { fill: "fill-primary-700", bg: "bg-primary-700" },
  { fill: "fill-accent-700", bg: "bg-accent-700" },
  { fill: "fill-primary-950", bg: "bg-primary-950" },
  { fill: "fill-accent-400", bg: "bg-accent-400" },
  { fill: "fill-primary-400", bg: "bg-primary-400" },
  { fill: "fill-accent-950", bg: "bg-accent-950" },
  { fill: "fill-secondary-600", bg: "bg-secondary-600" },
  { fill: "fill-primary-200", bg: "bg-primary-200" },
  { fill: "fill-accent-100", bg: "bg-accent-100" },
  { fill: "fill-secondary-900", bg: "bg-secondary-900" },
] as const;

export function clusterColor(index: number) {
  return CLUSTER_COLOR_CLASSES[index % CLUSTER_COLOR_CLASSES.length];
}
