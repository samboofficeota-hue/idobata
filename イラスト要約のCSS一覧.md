# イラスト要約のCSS一覧

## 1. IllustrationReportCard.tsx（カードコンテナ）

### 外側のコンテナ
```css
/* カード全体 */
.bg-gray-100          /* 背景色: グレー100 */
.rounded-xl            /* 角丸: 大きめ */
.p-4                   /* パディング: 小 */
.md:p-6                /* パディング: 中（md以上） */
.mb-6                  /* マージンボトム: 中 */
```

### ヘッダー部分
```css
/* ヘッダーコンテナ */
.flex                  /* フレックスボックス */
.flex-col              /* 縦方向（デフォルト） */
.sm:flex-row           /* 横方向（sm以上） */
.sm:justify-between    /* 両端揃え（sm以上） */
.sm:items-center       /* 中央揃え（sm以上） */
.gap-4                 /* ギャップ: 中 */
.mb-6                  /* マージンボトム: 中 */

/* タイトル */
.text-xl               /* フォントサイズ: 大 */
.md:text-2xl           /* フォントサイズ: 特大（md以上） */
.font-bold             /* フォントウェイト: 太字 */
.text-gray-800         /* テキスト色: グレー800 */
```

### コンテンツエリア
```css
/* コンテンツ背景 */
.bg-blue-50            /* 背景色: ブルー50 */
.border-4              /* ボーダー幅: 4px */
.border-white          /* ボーダー色: 白 */
.rounded-2xl           /* 角丸: 特大 */
.py-4                  /* パディング上下: 小 */
.md:py-8               /* パディング上下: 大（md以上） */
.relative              /* 相対位置指定 */
```

### コンテンツ表示エリア（折りたたみ時）
```css
/* 折りたたみ時 */
.h-[200px]             /* 高さ: 200px（固定） */
.md:h-[280px]          /* 高さ: 280px（md以上） */

/* 展開時 */
.h-auto                /* 高さ: 自動 */

/* 共通 */
.overflow-hidden       /* オーバーフロー: 非表示 */
.flex                  /* フレックスボックス */
.justify-center        /* 中央揃え（横） */
.items-center          /* 中央揃え（縦） */
```

### グラデーションオーバーレイ
```css
.absolute              /* 絶対位置指定 */
.bottom-12             /* 下から: 48px */
.left-0                /* 左: 0 */
.w-full                /* 幅: 100% */
.h-[100px]             /* 高さ: 100px */
.bg-gradient-to-t      /* グラデーション: 上方向 */
.from-blue-50          /* 開始色: ブルー50 */
.to-transparent        /* 終了色: 透明 */
.pointer-events-none   /* ポインターイベント: 無効 */
```

### 「すべて読む/閉じる」ボタン
```css
/* ボタンコンテナ */
.flex                  /* フレックスボックス */
.justify-center        /* 中央揃え（横） */
.w-full                /* 幅: 100% */
.mt-4                  /* マージントップ: 小 */

/* ボタン本体 */
.flex                  /* フレックスボックス */
.justify-center        /* 中央揃え（横） */
.items-center          /* 中央揃え（縦） */
.gap-1                 /* ギャップ: 小 */
.cursor-pointer        /* カーソル: ポインター */
.bg-transparent        /* 背景: 透明 */
.border-none           /* ボーダー: なし */
.p-0                   /* パディング: 0 */
.relative              /* 相対位置指定 */
.z-10                  /* z-index: 10 */
.group                 /* グループ（ホバー用） */

/* アイコン */
.w-6                   /* 幅: 24px */
.h-6                   /* 高さ: 24px */
.text-blue-500         /* テキスト色: ブルー500 */

/* テキスト */
.text-blue-500         /* テキスト色: ブルー500 */
.font-bold             /* フォントウェイト: 太字 */
.relative              /* 相対位置指定 */

/* アンダーライン（ホバー時） */
.absolute              /* 絶対位置指定 */
.bottom-0              /* 下: 0 */
.left-0                /* 左: 0 */
.w-0                   /* 幅: 0（初期） */
.h-0.5                 /* 高さ: 2px */
.bg-blue-500          /* 背景色: ブルー500 */
.transition-all        /* トランジション: すべて */
.duration-200          /* 時間: 200ms */
.group-hover:w-full    /* ホバー時: 幅100% */
```

### 空状態（isEmpty時）
```css
/* コンテナ */
.flex                  /* フレックスボックス */
.flex-col              /* 縦方向 */
.items-center          /* 中央揃え（横） */
.justify-center        /* 中央揃え（縦） */
.gap-4                 /* ギャップ: 中 */
.py-8                  /* パディング上下: 大 */

/* テキストコンテナ */
.flex                  /* フレックスボックス */
.flex-col              /* 縦方向 */
.gap-2                 /* ギャップ: 小 */
.text-center           /* テキスト: 中央揃え */

/* タイトル */
.text-xl               /* フォントサイズ: 大 */
.font-bold             /* フォントウェイト: 太字 */
.text-zinc-500         /* テキスト色: 亜鉛500 */
.leading-10            /* 行間: 40px */
.tracking-wide         /* 文字間隔: 広め */

/* 説明文 */
.text-base             /* フォントサイズ: ベース */
.text-zinc-500         /* テキスト色: 亜鉛500 */
.leading-8             /* 行間: 32px */
.tracking-wide         /* 文字間隔: 広め */
```

---

## 2. IllustrationSummaryContent.tsx（コンテンツ表示）

### HTMLコンテンツ（iframe）の場合
```css
/* 外側コンテナ */
.w-full                /* 幅: 100% */
.h-[600px]             /* 高さ: 600px（固定） */
.md:h-[800px]          /* 高さ: 800px（md以上） */

/* iframe */
.w-full                /* 幅: 100% */
.h-full                /* 高さ: 100% */
.border-0              /* ボーダー: なし */
.rounded-2xl           /* 角丸: 特大 */
```

### 画像URLの場合
```css
.max-w-full            /* 最大幅: 100% */
.max-h-full            /* 最大高さ: 100% */
.object-contain        /* オブジェクトフィット: 含む */
.rounded-2xl           /* 角丸: 特大 */
```

### プレースホルダー（画像がない場合）
```css
/* 外側コンテナ */
.w-full                /* 幅: 100% */
.max-w-md              /* 最大幅: 448px */
.md:max-w-2xl          /* 最大幅: 672px（md以上） */
.h-[300px]             /* 高さ: 300px */
.md:h-[500px]          /* 高さ: 500px（md以上） */
.bg-gray-300           /* 背景色: グレー300 */
.rounded-2xl           /* 角丸: 特大 */
.flex                  /* フレックスボックス */
.items-center          /* 中央揃え（横） */
.justify-center        /* 中央揃え（縦） */
.mx-auto               /* マージン左右: 自動 */

/* テキストコンテナ */
.text-center           /* テキスト: 中央揃え */
.p-4                   /* パディング: 小 */

/* メインテキスト */
.text-gray-600         /* テキスト色: グレー600 */
.text-sm               /* フォントサイズ: 小 */
.md:text-lg            /* フォントサイズ: 大（md以上） */
.block                 /* ブロック要素 */
.mb-2                  /* マージンボトム: 小 */

/* サブテキスト */
.text-gray-500         /* テキスト色: グレー500 */
.text-xs               /* フォントサイズ: 極小 */
.block                 /* ブロック要素 */
.mt-1                  /* マージントップ: 極小 */
```

---

## 3. カスタムCSS（必要に応じて追加）

現在、イラスト要約専用のカスタムCSSは定義されていません。
すべてTailwind CSSクラスで実装されています。

必要に応じて、以下のようなカスタムCSSを追加できます：

```css
/* 例: iframe内のコンテンツのスタイリング */
.illustration-iframe {
  /* カスタムスタイル */
}

/* 例: イラスト要約のアニメーション */
@keyframes illustration-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.illustration-fade-in {
  animation: illustration-fade-in 0.5s ease-in;
}
```
