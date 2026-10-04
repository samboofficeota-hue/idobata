import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { cn } from "../../lib/utils";
import type {
  KouchouArgument,
  KouchouCluster,
} from "../../services/kouchou/types";
import { clusterColor } from "./clusterColors";

interface ClusterScatterProps {
  arguments: KouchouArgument[];
  // 第1階層の意見グループ（並び順がそのまま色のインデックスになる）
  clusters: KouchouCluster[];
  selectedClusterId: string | null;
}

type Point = {
  arg: KouchouArgument;
  cx: number;
  cy: number;
  clusterId: string;
};

const VIEW_SIZE = 1000;
const PADDING = 20;
// ポインタからこの距離（viewBox座標）以内にある最も近い点を「選択中の意見」とする
const HOVER_RADIUS = 18;

const toPercent = (v: number) => `${(v / VIEW_SIZE) * 100}%`;

// 広聴AIの散布図（意見の分布）をSVGで描画する
// kouchou-aiのclientはPlotly.jsを使っているが、いどばた側ではバンドルを軽くするため素のSVGで描く
const ClusterScatter = ({
  arguments: args,
  clusters,
  selectedClusterId,
}: ClusterScatterProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<Point | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  const colorIndexByClusterId = useMemo(
    () => new Map(clusters.map((c, i) => [c.id, i])),
    [clusters]
  );
  const labelByClusterId = useMemo(
    () => new Map(clusters.map((c) => [c.id, c.label])),
    [clusters]
  );

  const points = useMemo<Point[]>(() => {
    if (args.length === 0) return [];
    const xs = args.map((a) => a.x);
    const ys = args.map((a) => a.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scale =
      (VIEW_SIZE - PADDING * 2) /
      Math.max(maxX - minX, maxY - minY, Number.EPSILON);
    return args.map((a) => ({
      arg: a,
      cx: PADDING + (a.x - minX) * scale,
      // SVGはy軸が下向きなので反転する
      cy: VIEW_SIZE - PADDING - (a.y - minY) * scale,
      clusterId: a.cluster_ids[1] ?? "",
    }));
  }, [args]);

  // 各グループのラベルは、所属する点の重心に置く（kouchou-ai本体と同じ方式）
  const labels = useMemo(() => {
    const sums = new Map<string, { x: number; y: number; n: number }>();
    for (const p of points) {
      const s = sums.get(p.clusterId) ?? { x: 0, y: 0, n: 0 };
      s.x += p.cx;
      s.y += p.cy;
      s.n += 1;
      sums.set(p.clusterId, s);
    }
    return clusters.flatMap((c, i) => {
      const s = sums.get(c.id);
      if (!s) return [];
      return [
        { id: c.id, label: c.label, index: i, x: s.x / s.n, y: s.y / s.n },
      ];
    });
  }, [points, clusters]);

  const isDimmed = (clusterId: string) =>
    selectedClusterId !== null && selectedClusterId !== clusterId;

  // 約1万個の点それぞれにイベントを付けると重いため、SVG全体で受けて最寄りの点を探す
  const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      ctm.inverse()
    );
    let nearest: Point | null = null;
    let nearestDist = HOVER_RADIUS * HOVER_RADIUS;
    for (const p of points) {
      if (isDimmed(p.clusterId)) continue;
      const d = (p.cx - pt.x) ** 2 + (p.cy - pt.y) ** 2;
      if (d < nearestDist) {
        nearest = p;
        nearestDist = d;
      }
    }
    setHovered(nearest);
  };

  return (
    <div>
      <label className="mb-2 flex w-fit items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={showLabels}
          onChange={(e) => setShowLabels(e.target.checked)}
          className="h-4 w-4 accent-primary-700"
        />
        グループ名を表示
      </label>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
          className="block w-full h-auto rounded-[16px] border-2 border-primary-700 bg-white touch-pan-y"
          role="img"
          aria-label="意見の分布図"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={(e) => {
            // タッチ操作では指を離した後も吹き出しを残す
            if (e.pointerType === "mouse") setHovered(null);
          }}
        >
          {points.map((p) => (
            <circle
              key={p.arg.arg_id}
              cx={p.cx}
              cy={p.cy}
              r={4}
              className={cn(
                clusterColor(colorIndexByClusterId.get(p.clusterId) ?? 0).fill,
                "transition-opacity"
              )}
              opacity={isDimmed(p.clusterId) ? 0.08 : 0.75}
            />
          ))}
          {hovered && (
            <circle
              cx={hovered.cx}
              cy={hovered.cy}
              r={9}
              className="fill-none stroke-primary-950"
              strokeWidth={3}
            />
          )}
        </svg>

        {showLabels &&
          labels.map((l) => (
            <div
              key={l.id}
              className={cn(
                "pointer-events-none absolute flex max-w-[40%] -translate-x-1/2 -translate-y-1/2 items-start gap-1 rounded-md border border-secondary-200 bg-white/90 px-2 py-1 text-[10px] font-bold leading-snug shadow-sm md:text-xs transition-opacity",
                isDimmed(l.id) && "opacity-30"
              )}
              style={{ left: toPercent(l.x), top: toPercent(l.y) }}
            >
              <span
                className={cn(
                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                  clusterColor(l.index).bg
                )}
              />
              <span className="line-clamp-2">{l.label}</span>
            </div>
          ))}

        {hovered && (
          <div
            role="tooltip"
            // スマホでは地図の幅が狭く吹き出しがはみ出すため、地図の下に表示する
            className={cn(
              "pointer-events-none mt-2 rounded-lg border-2 border-primary-700 bg-white p-3 shadow-md md:absolute md:z-10 md:mt-0 md:w-64 md:max-w-[80%]",
              hovered.cx > VIEW_SIZE / 2
                ? "md:-translate-x-full md:-ml-3"
                : "md:ml-3",
              hovered.cy > VIEW_SIZE / 2
                ? "md:-translate-y-full md:-mt-3"
                : "md:mt-3"
            )}
            style={{ left: toPercent(hovered.cx), top: toPercent(hovered.cy) }}
          >
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  clusterColor(
                    colorIndexByClusterId.get(hovered.clusterId) ?? 0
                  ).bg
                )}
              />
              <span className="truncate">
                {labelByClusterId.get(hovered.clusterId)}
              </span>
            </p>
            <p className="text-sm leading-relaxed break-words line-clamp-6">
              {hovered.arg.argument}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClusterScatter;
