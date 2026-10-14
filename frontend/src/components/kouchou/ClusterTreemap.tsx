import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import type {
  KouchouArgument,
  KouchouCluster,
} from "../../services/kouchou/types";
import { MUTED_POINT_COLOR, textColorOn } from "./clusterColors";
import { type Rect, chartHeightForWidth, squarify } from "./kouchouChartUtils";

interface ClusterTreemapProps {
  arguments: KouchouArgument[];
  clusters: KouchouCluster[];
  // 第1階層の意見グループの色。下の階層は親の色を薄くして使う
  colorByClusterId: Map<string, string>;
  matchedArgumentIds: Set<string> | null;
  fillHeight?: boolean;
}

type Node = {
  id: string;
  label: string;
  takeaway: string;
  value: number;
  parent: string;
  // 第1階層の祖先（色を決めるため）
  topId: string;
  isArgument: boolean;
  muted: boolean;
};

const PATHBAR_HEIGHT = 36;
const HEADER_HEIGHT = 26;
const GAP = 2;

// 8桁の16進カラーで透明度を付ける（例：#3fa9f5 → #3fa9f599）
const withAlpha = (hex: string, alpha: number) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;

// 広聴AIの「階層」表示（ツリーマップ）
// kouchou-ai と同じく、選んだ階層の下2段（グループとその中身）を表示し、クリックで掘り下げる
const ClusterTreemap = ({
  arguments: args,
  clusters,
  colorByClusterId,
  matchedArgumentIds,
  fillHeight = false,
}: ClusterTreemapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rootCluster = clusters.find((c) => c.level === 0);
  const [rootId, setRootId] = useState(rootCluster?.id ?? "0");

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

  const { nodeById, childrenById } = useMemo(() => {
    const byId = new Map<string, KouchouCluster>(
      clusters.map((c) => [c.id, c])
    );
    const topIdOf = (c: KouchouCluster): string => {
      let current = c;
      while (current.level > 1) {
        const parent = byId.get(current.parent);
        if (!parent) break;
        current = parent;
      }
      return current.id;
    };

    const nodes: Node[] = clusters.map((c) => ({
      id: c.id,
      label: c.label,
      takeaway: c.takeaway,
      value: c.value,
      parent: c.parent,
      topId: topIdOf(c),
      isArgument: false,
      muted: false,
    }));
    // 意見そのものは、最も細かい意見グループの子として並べる
    for (const a of args) {
      const parent = a.cluster_ids[a.cluster_ids.length - 1];
      nodes.push({
        id: a.arg_id,
        label: a.argument,
        takeaway: "",
        value: 1,
        parent,
        topId: a.cluster_ids[1] ?? parent,
        isArgument: true,
        muted: matchedArgumentIds !== null && !matchedArgumentIds.has(a.arg_id),
      });
    }

    const children = new Map<string, Node[]>();
    for (const n of nodes) {
      if (!n.parent) continue;
      const list = children.get(n.parent) ?? [];
      list.push(n);
      children.set(n.parent, list);
    }
    for (const list of children.values())
      list.sort((a, b) => b.value - a.value);
    return {
      nodeById: new Map(nodes.map((n) => [n.id, n])),
      childrenById: children,
    };
  }, [clusters, args, matchedArgumentIds]);

  // 現在の階層までの道のり（パンくず）
  const path = useMemo(() => {
    const list: Node[] = [];
    let current = nodeById.get(rootId);
    while (current) {
      list.unshift(current);
      current = current.parent ? nodeById.get(current.parent) : undefined;
    }
    return list;
  }, [nodeById, rootId]);

  const body: Rect = {
    x: 0,
    y: PATHBAR_HEIGHT,
    w: size.width,
    h: Math.max(size.height - PATHBAR_HEIGHT, 0),
  };
  const groups = squarify(childrenById.get(rootId) ?? [], body);

  const colorOf = (n: Node) =>
    n.muted
      ? MUTED_POINT_COLOR
      : (colorByClusterId.get(n.topId) ?? MUTED_POINT_COLOR);

  const zoomTo = (n: Node) => {
    if (childrenById.has(n.id)) setRootId(n.id);
  };

  const box = (r: Rect) => ({
    left: r.x + GAP / 2,
    top: r.y + GAP / 2,
    width: Math.max(r.w - GAP, 0),
    height: Math.max(r.h - GAP, 0),
  });

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden bg-white",
        fillHeight && "h-full"
      )}
      style={fillHeight ? undefined : { height: size.height || undefined }}
    >
      <nav
        aria-label="階層"
        className="absolute inset-x-0 top-0 flex items-center gap-1 overflow-x-auto whitespace-nowrap px-1 text-sm"
        style={{ height: PATHBAR_HEIGHT }}
      >
        {path.map((n, i) => (
          <span key={n.id} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {i < path.length - 1 ? (
              <button
                type="button"
                onClick={() => setRootId(n.id)}
                className="max-w-[12rem] truncate text-primary-700 underline hover:text-primary-900"
              >
                {n.label}
              </button>
            ) : (
              <span className="max-w-[16rem] truncate font-bold">
                {n.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {groups.map((g) => {
        const color = colorOf(g);
        const inner = childrenById.get(g.id) ?? [];
        const showInner = inner.length > 0 && g.h > HEADER_HEIGHT + 24;
        const items = showInner
          ? squarify(inner, {
              x: g.x + GAP,
              y: g.y + HEADER_HEIGHT,
              w: g.w - GAP * 2,
              h: g.h - HEADER_HEIGHT - GAP,
            })
          : [];
        return (
          <div key={g.id}>
            <button
              type="button"
              onClick={() => zoomTo(g)}
              disabled={!childrenById.has(g.id)}
              title={g.takeaway ? `${g.label}\n\n${g.takeaway}` : g.label}
              className="absolute flex flex-col items-stretch justify-start overflow-hidden rounded-sm text-left disabled:cursor-default"
              style={{
                ...box(g),
                // 中に小さなグループを並べる場合は、見出しだけ濃い色にして中身を見やすくする
                backgroundColor: showInner ? withAlpha(color, 0.18) : color,
                color: textColorOn(color),
              }}
            >
              {g.isArgument ? (
                <span className="line-clamp-6 break-words p-1.5 text-xs md:text-sm">
                  {g.label}
                </span>
              ) : (
                <span
                  className="block truncate px-1.5 text-xs font-bold leading-[26px] md:text-sm"
                  style={{
                    backgroundColor: color,
                    height: HEADER_HEIGHT - GAP,
                  }}
                >
                  {`${g.label}（${g.value}件）`}
                </span>
              )}
            </button>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => zoomTo(childrenById.has(item.id) ? item : g)}
                title={
                  item.takeaway
                    ? `${item.label}\n\n${item.takeaway}`
                    : item.label
                }
                className="absolute flex items-start overflow-hidden rounded-sm p-1 text-left text-[11px] leading-snug text-foreground hover:brightness-95 md:text-xs"
                style={{
                  ...box(item),
                  backgroundColor: item.muted
                    ? withAlpha(MUTED_POINT_COLOR, 0.5)
                    : withAlpha(color, item.isArgument ? 0.45 : 0.7),
                }}
              >
                <span className="line-clamp-4 break-words">
                  {item.isArgument
                    ? item.label
                    : `${item.label}（${item.value}件）`}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default ClusterTreemap;
