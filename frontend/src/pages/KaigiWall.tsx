import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import BreadcrumbView from "../components/common/BreadcrumbView";
import SectionHeading from "../components/common/SectionHeading";
import MeetingLink from "../components/kaigi/MeetingLink";
import SlideCard from "../components/kaigi/SlideCard";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { kaigiApi } from "../services/kaigi/kaigiApi";
import type { KaigiRoom, KaigiWallSlide } from "../services/kaigi/types";

// 会議室の壁：提出された提案スライドが並ぶ。新しい提案は Socket.IO で届く
const KaigiWall = () => {
  const { roomId = "" } = useParams();
  const [room, setRoom] = useState<KaigiRoom | null>(null);
  const [slides, setSlides] = useState<KaigiWallSlide[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  const load = useCallback(() => {
    kaigiApi
      .getWall(roomId)
      .then((res) => {
        setRoom(res.room);
        setSlides(res.slides);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "読み込みに失敗しました")
      );
  }, [roomId]);

  useEffect(load, [load]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_BASE_URL || "", {
      reconnection: true,
      reconnectionAttempts: 5,
    });
    socket.on("connect", () => socket.emit("subscribe-kaigi-room", roomId));
    socket.on("kaigi-slide-posted", (slide: KaigiWallSlide) =>
      setSlides((prev) =>
        prev.some((s) => s.id === slide.id) ? prev : [...prev, slide]
      )
    );
    return () => {
      socket.emit("unsubscribe-kaigi-room", roomId);
      socket.disconnect();
    };
  }, [roomId]);

  const tags = useMemo(
    () => Array.from(new Set(slides.flatMap((s) => s.tags))).sort(),
    [slides]
  );
  const visible = tag ? slides.filter((s) => s.tags.includes(tag)) : slides;

  return (
    <div className="container mx-auto px-4 py-8">
      <BreadcrumbView
        items={[
          { label: "いどばた会議室", href: "/kaigi" },
          { label: room?.title ?? "お題", href: `/kaigi/${roomId}` },
          { label: "壁", href: `/kaigi/${roomId}/wall` },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading title="会議室の壁" className="mb-0" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            更新
          </Button>
          <Button asChild size="sm">
            <Link to={`/kaigi/${roomId}`}>自分の提案をつくる</Link>
          </Button>
        </div>
      </div>
      {room && <p className="mt-2 text-lg">{room.title}</p>}
      {room?.meeting && (
        <div className="mt-3 max-w-3xl">
          <MeetingLink meeting={room.meeting} />
        </div>
      )}

      {error && (
        <p className="mt-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          {error}
        </p>
      )}

      {tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2" aria-label="タグで絞り込む">
          {[null, ...tags].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              aria-pressed={tag === t}
              onClick={() => setTag(t)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                tag === t
                  ? "border-primary-700 bg-primary-700 text-white"
                  : "border-primary-300 bg-white text-primary-700"
              )}
            >
              {t ? `#${t}` : "すべて"}
            </button>
          ))}
        </div>
      )}

      {!error && slides.length === 0 && (
        <p className="mt-10 text-center text-neutral-600">
          まだ提案は貼り出されていません。
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((slide) => (
          <SlideCard key={slide.id} slide={slide} nickname={slide.nickname} />
        ))}
      </div>
    </div>
  );
};

export default KaigiWall;
