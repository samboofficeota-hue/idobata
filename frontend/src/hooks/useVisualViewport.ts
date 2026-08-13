import { useEffect, useState } from "react";

interface VisualViewportState {
  /** 現在表示されている領域の高さ（ソフトキーボードを除いた高さ） */
  height: number;
  /** ソフトキーボードなどがせり出している高さ。閉じているときは 0 */
  keyboardHeight: number;
}

/**
 * ソフトキーボードの表示・非表示に応じて、実際に見えているビューポートの
 * 高さとキーボードのせり出し量を返すフック。
 *
 * モバイルでは `position: fixed` の要素はレイアウトビューポート（キーボードを
 * 含む全体）を基準に配置されるため、`bottom: 0` のボトムシートはキーボードの
 * 裏に潜り込み、シートとキーボードの間に背景ページが透けて見える隙間ができる。
 * このフックの値でシートの高さと下端位置を補正することで隙間をなくす。
 */
export const useVisualViewport = (): VisualViewportState => {
  const [state, setState] = useState<VisualViewportState>(() => ({
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    keyboardHeight: 0,
  }));

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      setState({ height: vv.height, keyboardHeight });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return state;
};
