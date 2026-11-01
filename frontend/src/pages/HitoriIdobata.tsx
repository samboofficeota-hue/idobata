import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { HitoriEngine } from "../components/hitori/engine";
import { mountHitori } from "../components/hitori/engine";
import "../components/hitori/hitori.css";
import {
  useVoiceInput,
  voiceInputSupported,
} from "../components/kaigi/useVoiceInput";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  HitoriApiError,
  hitoriApi,
  storedAccessCode,
} from "../services/hitori/hitoriApi";

type Phase = "checking" | "gate" | "open";

// 参加コードは、案内のURLの # の後ろ（/hitori#code=…）でも受け取る
const codeFromHash = () =>
  new URLSearchParams(window.location.hash.slice(1)).get("code");

// ひとりいどばた：一人で声で話しながら、お題について考えをまとめる画面
// 画面の中身は components/hitori/engine.js が組み立てる。ここは参加コード、録音、APIをつなぐ
const HitoriIdobata = () => {
  const [phase, setPhase] = useState<Phase>("checking");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HitoriEngine | null>(null);

  const tryCode = useCallback(async (value: string) => {
    try {
      await hitoriApi.verifyCode(value);
      storedAccessCode.set(value);
      setPhase("open");
    } catch (e) {
      storedAccessCode.remove();
      setPhase("gate");
      setError(e instanceof Error ? e.message : "確認に失敗しました");
    }
  }, []);

  useEffect(() => {
    const fromHash = codeFromHash();
    if (fromHash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    const initial = fromHash ?? storedAccessCode.get();
    if (initial) tryCode(initial);
    else setPhase("gate");
  }, [tryCode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code) {
      setError("参加コードを入力してください");
      return;
    }
    setIsChecking(true);
    setError(null);
    await tryCode(code);
    setIsChecking(false);
  };

  const onText = useCallback((text: string) => {
    engineRef.current?.sendVoice(text);
  }, []);
  const voice = useVoiceInput(hitoriApi.transcribe, onText);
  const toggleRef = useRef(() => {});
  toggleRef.current = () => {
    if (voice.state === "recording") voice.stop();
    else voice.start();
  };

  const isOpen = phase === "open";
  useEffect(() => {
    if (!isOpen || !rootRef.current) return;
    const engine = mountHitori(rootRef.current, {
      ai: async (request) => {
        try {
          return await hitoriApi.ai(request);
        } catch (e) {
          // 参加コードが変わったときは、入力し直してもらう
          if (e instanceof HitoriApiError && e.status === 403) {
            storedAccessCode.remove();
            setError(e.message);
            setPhase("gate");
          }
          throw e;
        }
      },
      voice: {
        supported: voiceInputSupported(),
        toggle: () => toggleRef.current(),
      },
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    engineRef.current?.setVoice({
      state: voice.state,
      elapsedSec: voice.elapsedSec,
      error: voice.error,
    });
  }, [voice.state, voice.elapsedSec, voice.error]);

  if (phase === "checking") {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        読み込み中...
      </div>
    );
  }
  if (phase === "gate") {
    return (
      <div className="container mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-bold">ひとりいどばた</h1>
        <p className="mt-3 mb-6 text-base text-neutral-600">
          一人で声で話しながら、お題について考えをまとめます。始めるには、案内された参加コードを入力してください。
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label="参加コード"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={!!error}
            errorText={error ?? undefined}
          />
          <Button type="submit" disabled={isChecking}>
            {isChecking ? "確認中..." : "始める"}
          </Button>
        </form>
      </div>
    );
  }
  return <div ref={rootRef} className="hitori-root" />;
};

export default HitoriIdobata;
