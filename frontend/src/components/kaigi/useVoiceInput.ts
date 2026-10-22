import { useCallback, useEffect, useRef, useState } from "react";
import { measureVoicedSec } from "./voiceLevel";

// 音声入力：押して話す → もう一度押して止める → サーバーで文字にする
// 文字は入力欄に入るだけで、送るのは本人（間違いを直してから送れる）

// 1回の録音の上限（backend の services/kaigi/transcribe.js と合わせる）
export const MAX_RECORDING_SEC = 60;
// これより短い録音は押し間違いとみなして送らない
const MIN_RECORDING_MS = 600;
// 声のある区間がこれより短ければ、マイクに声が入っていないとみなして送らない
const MIN_VOICED_SEC = 0.3;
const MIC_SILENT_MESSAGE =
  "マイクに声が入っていませんでした。Bluetooth のイヤホンを使っている場合は、スマホ本体のマイクに向かって話してください";

export type VoiceState = "idle" | "recording" | "transcribing";

// 録れる形式を端末に合わせて選ぶ。iPhone の Safari は mp4、Android の Chrome は webm
const pickMimeType = () => {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
};

export const voiceInputSupported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  typeof MediaRecorder !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia);

const micErrorMessage = (error: unknown) => {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "マイクの使用が許可されていません。ブラウザの設定でこのサイトのマイクを許可してください";
  }
  if (name === "NotFoundError") return "マイクが見つかりませんでした";
  return "マイクを使えませんでした。もう一度試してください";
};

export const useVoiceInput = (
  transcribe: (audio: Blob) => Promise<string>,
  onText: (text: string) => void
) => {
  const [state, setState] = useState<VoiceState>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  // 画面を離れたら、録音中のものは送らずに捨てる
  const discardRef = useRef(false);

  const releaseMic = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      setError(micErrorMessage(e));
      return;
    }
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      releaseMic();
      recorderRef.current = null;
      if (discardRef.current) return;
      const duration = Date.now() - startedAtRef.current;
      if (duration < MIN_RECORDING_MS || chunks.length === 0) {
        setState("idle");
        setError("短すぎて聞き取れませんでした。押してから話してください");
        return;
      }
      setState("transcribing");
      try {
        const audio = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        const voicedSec = await measureVoicedSec(audio);
        if (voicedSec !== null && voicedSec < MIN_VOICED_SEC) {
          setError(MIC_SILENT_MESSAGE);
          return;
        }
        const text = await transcribe(audio);
        if (text) onText(text);
        else setError("声が聞き取れませんでした。もう一度話してください");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "音声を文字にできませんでした"
        );
      } finally {
        if (!discardRef.current) setState("idle");
      }
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    recorder.start();
    setState("recording");
    timerRef.current = window.setInterval(() => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSec(sec);
      if (sec >= MAX_RECORDING_SEC) stop();
    }, 250);
  }, [state, transcribe, onText, releaseMic, stop]);

  useEffect(() => {
    // 開発時の StrictMode は一度片付けてから付け直すので、ここで戻しておく
    discardRef.current = false;
    return () => {
      discardRef.current = true;
      stop();
      releaseMic();
    };
  }, [stop, releaseMic]);

  return {
    state,
    elapsedSec,
    error,
    start,
    stop,
    clearError: () => setError(null),
  };
};
