import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { cn } from "../../lib/utils";
import type {
  KouchouArgument,
  KouchouCluster,
} from "../../services/kouchou/types";
import { MUTED_POINT_COLOR, textColorOn } from "./clusterColors";
import { chartHeightForWidth, convexHull } from "./kouchouChartUtils";

interface ClusterScatterProps {
  arguments: KouchouArgument[];
  // 色分けする意見グループ（「全体」は第1階層、「濃い意見」は最も細かい階層の一部）
  clusters: KouchouCluster[];
  colorByClusterId: Map<string, string>;
  selectedClusterId: string | null;
  // 検索に一致した意見のID。null なら絞り込みなし
  matchedArgumentIds: Set<string> | null;
  showLabels: boolean;
  // 意見グループの範囲に薄い背景色を付ける
  showHulls?: boolean;
  // 全画面表示では親要素の高さいっぱいに広げる
  fillHeight?: boolean;
}

type Point = {
  arg: KouchouArgument;
  cx: number;
  cy: number;
  cluster: KouchouCluster | null;
  muted: boolean;
};

const PADDING = 24;
const POINT_RADIUS = 5;
// ポインタからこの距離（px）以内にある最も近い点を「選択中の意見」とする
const HOVER_RADIUS = 16;
// ラベルの最大幅（md:max-w-[240px]）の半分
const LABEL_HALF_WIDTH = 120;

// 広聴AIの散布図（意見の分布）をSVGで描画する
// kouchou-aiのclientはPlotly.jsを使っているが、いどばた側ではバンドルを軽くするため素のSVGで描く
const ClusterScatter = ({
  arguments: args,
  clusters,
  colorByClusterId,
  selectedClusterId,
  matchedArgumentIds,
  showLabels,
  showHulls = false,
  fillHeight = false,
}: ClusterScatterProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<Point | null>(null);

  // SVGの座標を実際の表示サイズ（px）に合わせ、点の大きさが画面幅で変わらないようにする
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const height = fillHeight ? el.clientHeight : chartHeightForWidth(width);
      setSize({ width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fillHeight]);

  const points = useMemo<Point[]>(() => {
    const { width, height } = size;
    if (args.length === 0 || width === 0) return [];
    const xs = args.map((a) => a.x);
    const ys = args.map((a) => a.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const sx = (width - PADDING * 2) / Math.max(maxX - minX, Number.EPSILON);
    const sy = (height - PADDING * 2) / Math.max(maxY - minY, Number.EPSILON);
    const clusterById = new Map(clusters.map((c) => [c.id, c]));
    return args.map((a) => {
      const clusterId = a.cluster_ids.find((id) => clusterById.has(id));
      const cluster = clusterId ? (clusterById.get(clusterId) ?? null) : null;
      return {
        arg: a,
        cx: PADDING + (a.x - minX) * sx,
        // SVGはy軸が下向きなので反転する
        cy: height - PADDING - (a.y - minY) * sy,
        cluster,
        muted:
          cluster === null ||
          (matchedArgumentIds !== null && !matchedArgumentIds.has(a.arg_id)),
      };
    });
  }, [args, clusters, size, matchedArgumentIds]);

  // 各グループのラベルは、所属する点の重心に置く（kouchou-ai本体と同じ方式）
  const labels = useMemo(() => {
    const sums = new Map<string, { x: number; y: number; n: number }>();
    for (const p of points) {
      if (!p.cluster) continue;
      const s = sums.get(p.cluster.id) ?? { x: 0, y: 0, n: 0 };
      s.x += p.cx;
      s.y += p.cy;
      s.n += 1;
      sums.set(p.cluster.id, s);
    }
    return clusters.flatMap((c) => {
      const s = sums.get(c.id);
      if (!s) return [];
      // 端に近いラベルが細く折り返されないよう、中心を内側に寄せる
      const margin = Math.min(LABEL_HALF_WIDTH, size.width / 2);
      const x = Math.min(Math.max(s.x / s.n, margin), size.width - margin);
      const y = Math.min(Math.max(s.y / s.n, 20), size.height - 20);
      return [{ cluster: c, x, y }];
    });
  }, [points, clusters, size]);

  const isDimmed = (p: Point) =>
    selectedClusterId !== null &&
    !p.arg.cluster_ids.includes(selectedClusterId);

  // 点が多いと1つずつイベントを付けるのは重いため、SVG全体で受けて最寄りの点を探す
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
      if (p.muted || isDimmed(p)) continue;
      const d = (p.cx - pt.x) ** 2 + (p.cy - pt.y) ** 2;
      if (d < nearestDist) {
        nearest = p;
        nearestDist = d;
      }
    }
    setHovered(nearest);
  };

  const toLeft = (x: number) => `${(x / Math.max(size.width, 1)) * 100}%`;
  const toTop = (y: number) => `${(y / Math.max(size.height, 1)) * 100}%`;
  const colorOf = (p: Point) =>
    p.muted || !p.cluster
      ? MUTED_POINT_COLOR
      : (colorByClusterId.get(p.cluster.id) ?? MUTED_POINT_COLOR);

  // 対象外（灰色）の点を先に描き、色付きの点が上に来るようにする
  // 各グループを囲む多角形（点が3つ未満のグループは描かない）
  const hulls = useMemo(() => {
    if (!showHulls) return [];
    return clusters.flatMap((c) => {
      const members = points
        .filter((p) => p.cluster?.id === c.id)
        .map((p): [number, number] => [p.cx, p.cy]);
      if (members.length < 3) return [];
      const hull = convexHull(members);
      if (hull.length < 3) return [];
      return [
        { cluster: c, path: hull.map(([x, y]) => `${x},${y}`).join(" ") },
      ];
    });
  }, [showHulls, clusters, points]);

  const orderedPoints = useMemo(
    () => [...points.filter((p) => p.muted), ...points.filter((p) => !p.muted)],
    [points]
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", fillHeight && "h-full")}
    >
      {size.width > 0 && (
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          className="block bg-white touch-pan-y"
          role="img"
          aria-label="意見の分布図"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={(e) => {
            // タッチ操作では指を離した後も吹き出しを残す
            if (e.pointerType === "mouse") setHovered(null);
          }}
        >
          {hulls.map((h) => {
            const color =
              colorByClusterId.get(h.cluster.id) ?? MUTED_POINT_COLOR;
            const dimmed =
              selectedClusterId !== null && selectedClusterId !== h.cluster.id;
            return (
              <polygon
                key={h.cluster.id}
                points={h.path}
                fill={color}
                fillOpacity={dimmed ? 0.05 : 0.2}
                stroke={color}
                strokeOpacity={dimmed ? 0.2 : 1}
                strokeWidth={1.5}
                strokeLinejoin="round"
                className="transition-opacity"
              />
            );
          })}
          {orderedPoints.map((p) => (
            <circle
              key={p.arg.arg_id}
              cx={p.cx}
              cy={p.cy}
              r={POINT_RADIUS}
              fill={colorOf(p)}
              className="transition-opacity"
              opacity={p.muted ? 0.5 : isDimmed(p) ? 0.12 : 0.9}
            />
          ))}
          {hovered && (
            <circle
              cx={hovered.cx}
              cy={hovered.cy}
              r={POINT_RADIUS + 4}
              fill="none"
              stroke={colorOf(hovered)}
              strokeWidth={3}
            />
          )}
        </svg>
      )}

      {showLabels &&
        labels.map((l) => (
          <div
            key={l.cluster.id}
            className={cn(
              "pointer-events-none absolute w-max max-w-[40%] md:max-w-[240px] -translate-x-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] font-bold leading-snug shadow-sm md:text-sm transition-opacity",
              selectedClusterId !== null &&
                selectedClusterId !== l.cluster.id &&
                selectedClusterId !== l.cluster.parent &&
                "opacity-30"
            )}
            style={{
              left: toLeft(l.x),
              top: toTop(l.y),
              backgroundColor: colorByClusterId.get(l.cluster.id),
              color: textColorOn(
                colorByClusterId.get(l.cluster.id) ?? MUTED_POINT_COLOR
              ),
            }}
          >
            <span className="line-clamp-3">{l.cluster.label}</span>
          </div>
        ))}

      {hovered && (
        <div
          role="tooltip"
          // スマホでは地図の幅が狭く吹き出しがはみ出すため、地図の下に表示する
          className={cn(
            "pointer-events-none mt-2 rounded-lg border-2 bg-white p-3 shadow-md md:absolute md:z-10 md:mt-0 md:w-72 md:max-w-[80%]",
            hovered.cx > size.width / 2
              ? "md:-translate-x-full md:-ml-3"
              : "md:ml-3",
            hovered.cy > size.height / 2
              ? "md:-translate-y-full md:-mt-3"
              : "md:mt-3"
          )}
          style={{
            left: toLeft(hovered.cx),
            top: toTop(hovered.cy),
            borderColor: colorOf(hovered),
          }}
        >
          <p className="mb-1 text-xs font-bold text-muted-foreground break-words">
            {hovered.cluster?.label}
          </p>
          <p className="text-sm leading-relaxed break-words line-clamp-6">
            {hovered.arg.argument}
          </p>
        </div>
      )}
    </div>
  );
};

export default ClusterScatter;
