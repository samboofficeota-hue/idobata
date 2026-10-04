import {
  ChartScatter,
  LayoutGrid,
  Maximize2,
  Minimize2,
  PaintBucket,
  Search,
  Settings,
  Target,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type {
  KouchouArgument,
  KouchouCluster,
} from "../../services/kouchou/types";
import ClusterScatter from "./ClusterScatter";
import ClusterTreemap from "./ClusterTreemap";
import { clusterColor } from "./clusterColors";
import {
  DEFAULT_MAX_DENSITY,
  DEFAULT_MIN_VALUE,
  getDenseClusters,
} from "./kouchouChartUtils";

type ChartView = "all" | "dense" | "treemap";

interface KouchouChartProps {
  arguments: KouchouArgument[];
  clusters: KouchouCluster[];
  // 第1階層の意見グループ（件数の多い順）と、その色
  topClusters: KouchouCluster[];
  topColorByClusterId: Map<string, string>;
  selectedClusterId: string | null;
  onSelectCluster: (id: string) => void;
}

const VIEWS: { value: ChartView; label: string; icon: LucideIcon }[] = [
  { value: "all", label: "全体", icon: ChartScatter },
  { value: "dense", label: "濃い意見", icon: Target },
  { value: "treemap", label: "階層", icon: LayoutGrid },
];

// 広聴AIの「意見の分布」。kouchou-ai のレポート画面と同じく、
// 全体／濃い意見／階層の切り替え、表示設定、全画面表示、意見の検索ができる
const KouchouChart = ({
  arguments: args,
  clusters,
  topClusters,
  topColorByClusterId,
  selectedClusterId,
  onSelectCluster,
}: KouchouChartProps) => {
  const [view, setView] = useState<ChartView>("all");
  const [showLabels, setShowLabels] = useState(true);
  // 意見グループごとの背景色（kouchou-ai と同じく初期表示はON）
  const [showHulls, setShowHulls] = useState(true);
  const [maxDensity, setMaxDensity] = useState(DEFAULT_MAX_DENSITY);
  const [minValue, setMinValue] = useState(DEFAULT_MIN_VALUE);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [query, setQuery] = useState("");
  const settingsRef = useRef<HTMLDivElement>(null);

  const denseClusters = useMemo(
    () => getDenseClusters(clusters, maxDensity, minValue),
    [clusters, maxDensity, minValue]
  );
  const isDenseEnabled = denseClusters.length > 0;

  // 設定を変えて「濃い意見」が0件になったら全体表示に戻す
  useEffect(() => {
    if (view === "dense" && !isDenseEnabled) setView("all");
  }, [view, isDenseEnabled]);

  const denseColorByClusterId = useMemo(
    () => new Map(denseClusters.map((c, i) => [c.id, clusterColor(i)])),
    [denseClusters]
  );

  const shownClusters = view === "dense" ? denseClusters : topClusters;
  const shownColors =
    view === "dense" ? denseColorByClusterId : topColorByClusterId;

  const matchedArgumentIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      args
        .filter((a) => a.argument.toLowerCase().includes(q))
        .map((a) => a.arg_id)
    );
  }, [args, query]);

  // 全画面表示中は Esc で閉じ、背景のスクロールを止める
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen]);

  // 設定パネルは外側を押すと閉じる
  useEffect(() => {
    if (!isSettingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!settingsRef.current?.contains(e.target as Node))
        setIsSettingsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isSettingsOpen]);

  const description =
    view === "treemap"
      ? "四角の大きさが意見の数を表します。グループを押すと、その中の小さなグループや意見を表示します。"
      : view === "dense"
        ? `意見が特に密集している小さなグループ（密度が上位${Math.round(maxDensity * 100)}%・${minValue}件以上）だけを色付きで表示しています。`
        : "点の1つ1つが意見です。近くにある意見ほど内容が似ています。点にカーソルを合わせる（スマホではタップする）と意見の本文が表示されます。";

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-secondary-200 bg-secondary-50 p-1">
        {VIEWS.map(({ value, label, icon: Icon }) => {
          const disabled = value === "dense" && !isDenseEnabled;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              disabled={disabled}
              title={
                disabled
                  ? "この設定条件では抽出できませんでした（表示設定で条件を変えられます）"
                  : undefined
              }
              onClick={() => setView(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors md:px-4",
                view === value
                  ? "bg-white font-bold text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground",
                disabled &&
                  "cursor-not-allowed opacity-40 hover:text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {view === "all" && (
          <button
            type="button"
            onClick={() => setShowHulls((v) => !v)}
            aria-pressed={showHulls}
            title="意見グループの範囲に背景色を付ける"
            className={cn(
              "flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm transition-colors",
              showHulls
                ? "border-primary-700 bg-primary-weak font-bold text-foreground"
                : "border-secondary-200 bg-white text-muted-foreground hover:bg-secondary-50"
            )}
          >
            <PaintBucket className="h-4 w-4" />
            背景色 {showHulls ? "ON" : "OFF"}
          </button>
        )}
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="意見を検索"
            aria-label="意見を検索"
            className="h-9 w-36 rounded-md border border-secondary-200 pl-8 pr-2 text-sm md:w-48"
          />
        </label>

        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => setIsSettingsOpen((v) => !v)}
            aria-expanded={isSettingsOpen}
            aria-label="表示設定"
            title="表示設定"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-secondary-200 bg-white hover:bg-secondary-50"
          >
            <Settings className="h-4 w-4" />
          </button>
          {isSettingsOpen && (
            <div className="absolute right-0 top-11 z-20 w-72 rounded-lg border border-secondary-200 bg-white p-4 text-sm shadow-lg">
              <p className="mb-2 font-bold">表示設定</p>
              <label className="mb-2 flex cursor-pointer items-center justify-between">
                意見グループの背景色（全体）
                <input
                  type="checkbox"
                  checked={showHulls}
                  onChange={(e) => setShowHulls(e.target.checked)}
                  className="h-4 w-4 accent-primary-700"
                />
              </label>
              <label className="mb-4 flex cursor-pointer items-center justify-between">
                意見グループ名を表示
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="h-4 w-4 accent-primary-700"
                />
              </label>
              <p className="mb-1 font-bold">濃い意見グループ</p>
              <p className="mb-3 text-xs text-muted-foreground">
                「濃い意見」に表示するグループの条件です。
              </p>
              <label className="mb-3 block">
                密度が上位 {Math.round(maxDensity * 100)}% 以内
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={maxDensity}
                  onChange={(e) => setMaxDensity(Number(e.target.value))}
                  className="mt-1 w-full accent-primary-700"
                />
              </label>
              <label className="block">
                意見が {minValue} 件以上
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={minValue}
                  onChange={(e) => setMinValue(Number(e.target.value))}
                  className="mt-1 w-full accent-primary-700"
                />
              </label>
              <p className="mt-3 text-xs text-muted-foreground">
                この条件に当てはまるグループ：{denseClusters.length}件
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          aria-label={isFullscreen ? "全画面表示を終了" : "全画面表示"}
          title={isFullscreen ? "全画面表示を終了" : "全画面表示"}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-secondary-200 bg-white hover:bg-secondary-50"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  const chart = (fillHeight: boolean) =>
    view === "treemap" ? (
      <ClusterTreemap
        arguments={args}
        clusters={clusters}
        colorByClusterId={topColorByClusterId}
        matchedArgumentIds={matchedArgumentIds}
        fillHeight={fillHeight}
      />
    ) : (
      <ClusterScatter
        arguments={args}
        clusters={shownClusters}
        colorByClusterId={shownColors}
        selectedClusterId={selectedClusterId}
        matchedArgumentIds={matchedArgumentIds}
        showLabels={showLabels}
        showHulls={view === "all" && showHulls}
        fillHeight={fillHeight}
      />
    );

  const legend = view !== "treemap" && (
    <ul className="mt-3 flex flex-wrap gap-2">
      {shownClusters.map((c) => (
        <li key={c.id} className="max-w-full">
          <button
            type="button"
            onClick={() => onSelectCluster(c.id)}
            aria-pressed={selectedClusterId === c.id}
            className={cn(
              "flex max-w-full items-center gap-2 rounded-full border-2 px-3 py-1 text-sm transition-colors",
              selectedClusterId === c.id
                ? "border-primary-700 bg-primary-weak"
                : "border-secondary-200 bg-white hover:border-primary-300"
            )}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: shownColors.get(c.id) }}
            />
            <span className="min-w-0 truncate">{c.label}</span>
            <span className="shrink-0 whitespace-nowrap text-muted-foreground">
              {c.value}件
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      {controls}
      {matchedArgumentIds && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          「{query.trim()}」を含む意見：{matchedArgumentIds.size}件
          <button
            type="button"
            onClick={() => setQuery("")}
            className="flex items-center text-primary-700 hover:text-primary-900"
          >
            <X className="h-4 w-4" />
            解除
          </button>
        </p>
      )}
      <div className="mt-3 overflow-hidden rounded-2xl border-2 border-primary-700 bg-white">
        {!isFullscreen && chart(false)}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {legend}

      {isFullscreen && (
        // biome-ignore lint/a11y/useSemanticElements: 全画面のオーバーレイ
        <div
          role="dialog"
          aria-modal="true"
          aria-label="意見の分布（全画面）"
          className="fixed inset-0 z-[60] flex flex-col gap-3 bg-white p-3 md:p-6"
        >
          {controls}
          <div className="min-h-0 flex-1">{chart(true)}</div>
          {legend}
        </div>
      )}
    </div>
  );
};

export default KouchouChart;
