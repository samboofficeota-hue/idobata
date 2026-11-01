export type HitoriVoiceState = {
  state: "idle" | "recording" | "transcribing";
  elapsedSec: number;
  error: string | null;
};

export type HitoriApi = {
  ai: (request: {
    kind: string;
    args: unknown[];
    state: unknown;
  }) => Promise<unknown>;
  voice: { supported: boolean; toggle: () => void };
};

export type HitoriEngine = {
  sendVoice: (text: string) => void;
  setVoice: (voice: HitoriVoiceState) => void;
  destroy: () => void;
};

export function mountHitori(root: HTMLElement, api: HitoriApi): HitoriEngine;
