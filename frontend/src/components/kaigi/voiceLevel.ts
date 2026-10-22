// 録音に声が入っているかを、送る前に端末の中で確かめる
// iPhone の Safari では、Bluetooth のイヤホンマイクにつないでいると、ほとんど無音で録れることがあった
// （2026-10-23 の実機の試験。iPhone 本体のマイクではクリアに取れた）。無音を送ると、
// AIがお題の言葉をそのまま返すなど、話していない文字が入るので、送らずに案内する

// 50ミリ秒ずつに区切り、音の大きさ（RMS）がこれを超える区間を「声がある」とみなす
const FRAME_SEC = 0.05;
const VOICE_RMS = 0.01;

// 声がある区間の合計（秒）。調べられないブラウザでは null（そのまま送る）
export const measureVoicedSec = async (audio: Blob): Promise<number | null> => {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await audio.arrayBuffer());
    const samples = decoded.getChannelData(0);
    const frame = Math.max(1, Math.round(decoded.sampleRate * FRAME_SEC));
    let voicedFrames = 0;
    for (let start = 0; start < samples.length; start += frame) {
      const end = Math.min(start + frame, samples.length);
      let sum = 0;
      for (let i = start; i < end; i++) sum += samples[i] * samples[i];
      if (Math.sqrt(sum / (end - start)) > VOICE_RMS) voicedFrames++;
    }
    return voicedFrames * FRAME_SEC;
  } catch {
    return null;
  } finally {
    ctx.close().catch(() => {});
  }
};
