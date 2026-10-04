import { useMemo } from "react";
import { cn } from "../../lib/utils";
import type { KouchouArgument } from "../../services/kouchou/types";
import { clusterColor } from "./clusterColors";

interface ClusterScatterProps {
  arguments: KouchouArgument[];
  // 第1階層の意見グループID → 色のインデックス
  colorIndexByClusterId: Map<string, number>;
  selectedClusterId: string | null;
}

const VIEW_SIZE = 1000;
const PADDING = 20;

// 広聴AIの散布図（意見の分布）をSVGで描画する
// kouchou-aiのclientはPlotly.jsを使っているが、いどばた側ではバンドルを軽くするため素のSVGで描く
const ClusterScatter = ({
  arguments: args,
  colorIndexByClusterId,
  selectedClusterId,
}: ClusterScatterProps) => {
  const points = useMemo(() => {
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
      id: a.arg_id,
      cx: PADDING + (a.x - minX) * scale,
      // SVGはy軸が下向きなので反転する
      cy: VIEW_SIZE - PADDING - (a.y - minY) * scale,
      clusterId: a.cluster_ids[1] ?? "",
    }));
  }, [args]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
      className="w-full h-auto rounded-[16px] border-2 border-primary-700 bg-white"
      role="img"
      aria-label="意見の分布図"
    >
      {points.map((p) => {
        const colorIndex = colorIndexByClusterId.get(p.clusterId) ?? 0;
        const dimmed =
          selectedClusterId !== null && selectedClusterId !== p.clusterId;
        return (
          <circle
            key={p.id}
            cx={p.cx}
            cy={p.cy}
            r={4}
            className={cn(clusterColor(colorIndex).fill, "transition-opacity")}
            opacity={dimmed ? 0.08 : 0.75}
          />
        );
      })}
    </svg>
  );
};

export default ClusterScatter;
