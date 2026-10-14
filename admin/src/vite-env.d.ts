interface ImportMeta {
  readonly env: {
    readonly VITE_API_BASE_URL: string;
    // 利用者向けサイトのURL（広聴AIの「公開ページを見る」リンクに使う）
    readonly VITE_FRONTEND_BASE_URL?: string;
    [key: string]: string | boolean | undefined;
  };
}
