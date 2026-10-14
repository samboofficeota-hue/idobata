import { useEffect, useState } from "react";
import type { KaigiSession } from "../../services/kaigi/types";

// サーバーが返した残り秒数を起点に、手元の時計で1秒ずつ減らす（端末の時計のずれに左右されない）
export const useCountdown = (timing: KaigiSession["timing"] | undefined) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!timing?.startedAt) return;
    const receivedAt = Date.now();
    setElapsed(0);
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - receivedAt) / 1000)),
      1000
    );
    return () => window.clearInterval(id);
  }, [timing]);

  if (!timing?.startedAt) return null;
  return {
    total: timing.totalRemainingSec - elapsed,
    step:
      timing.stepRemainingSec === null
        ? null
        : timing.stepRemainingSec - elapsed,
  };
};

export const formatClock = (sec: number) => {
  const sign = sec < 0 ? "-" : "";
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
};
