# 問い詳細ページのデザイン改善案

デザインガイドライン（`frontend/project/design-guidelines.md`）および各レポートの表示仕様を踏まえた改善案です。

---

## 1. 参照したガイドライン・仕様の要点

### デザインガイドライン
- **フォント**: BIZ UDGothic（見出し・強調は Bold 700）
- **色**: セマンティックに（`text-foreground` / `bg-card` / `bg-primary` 等）を推奨
- **スペーシング**: 標準 16px、大きい 32px、**セクション間 64px**（`gap-16`）
- **UI**: shadcn の **Card**（CardHeader / CardTitle / CardContent）、**Section**（title / description）、**Button** のバリアントを活用
- **SectionHeading**: 左に primary の縦バー + 見出し（`text-2xl text-foreground font-biz`）のパターンあり

### 各レポートの個別フォーマット（イラスト要約のCSS一覧より）
- カード: `bg-gray-100` / `rounded-xl` / `p-4 md:p-6`（中〜大パディング）
- ヘッダー: `text-xl md:text-2xl` / `font-bold` / `text-gray-800`
- コンテンツエリア: `bg-blue-50` / `border-4 border-white` / `rounded-2xl` の「レポート枠」パターン

### 現状の問い詳細ページ
- セクション: 共通で `bg-gray-100 rounded-xl p-6 md:p-8`、見出しは `text-2xl font-bold text-gray-800`
- 重要論点カード（ThemePromptSection）: `from-blue-50 to-indigo-50` グラデ + `border-blue-200`
- 「みんなの意見」のみセクション見出しにアイコン（Lightbulb）あり
- 解決デザインカード: `border-green-200`、その他はグレー基調

---

## 2. 見栄えをよくするための改善案

### A. セクション見出しの統一（優先度高）

**現状**: 問い詳細では `SectionHeading` を使わず、プレーンな `<h2>` のみ。

**案**: 全セクションで **SectionHeading** を使う。

- ガイドラインの「セクションコンポーネント」と統一できる
- 左の primary バーで視覚的なリズムができ、スキャンしやすくなる
- 見出しに `font-biz` を効かせて BIZ UDGothic を明示

**実装イメージ**  
`QuestionDetail.tsx` の「みんなの論点」「みんなのアイディア」「みんなの解決デザイン」「みんなの意見」で、`<h2 className="...">` の代わりに `<SectionHeading title="みんなの論点" />` などを使用。既存の `Section` コンポーネントの `title` を使うか、単体で `SectionHeading` を import して使う。

---

### B. セクションごとにアイコンを付与（優先度中）

**現状**: 「みんなの意見」だけ Lightbulb アイコン付き。他セクションはテキストのみ。

**案**: 各セクションに意味の分かるアイコンを 1 つずつ付ける。

- みんなの論点: `MessageSquare` や `GitBranch`（論点・分岐のイメージ）
- みんなのアイディア: `Lightbulb` または `FileText`（意見まとめ）
- みんなの解決デザイン: `CheckCircle2` または `Target`（解決案）
- みんなの意見: 現状どおり `Lightbulb`

同じサイズ・同じ色トーン（例: `text-muted-foreground` または primary）に揃えると、ガイドラインの「Lucide で一貫性」に合う。

---

### C. セクション背景の役割を明確にする（優先度中）

**現状**: 全セクションが `bg-gray-100` でフラット。

**案**: ガイドラインの「セクション背景: secondary」「カード背景: card」を利用する。

- セクション外枠: `bg-muted` または `bg-secondary`（少しだけページ背景と差をつける）
- 中身の「レポート風」ブロック: `bg-card` + 軽い枠（`border border-border`）でカードとして認識しやすくする

イラスト要約の「コンテンツエリア」のように、**中だけ** `bg-blue-50` や `bg-card` で一段階レイヤーを分けると、論点・意見まとめ・解決デザインの「レポート」感が出る。

---

### D. 重要論点カードの立体感（優先度低）

**現状**: グラデ + 青ボーダーで既に目立っている。

**案**: `index.css` の **subtle-shadow** や **clean-card** を 1 枚だけ適用する。

- 重要論点カードに `subtle-shadow` を追加し、他セクションより少しだけ浮かせる
- 角丸は現状の `rounded-lg` のままか、ガイドラインの Card に合わせて `rounded-[16px]` に寄せる

---

### E. 解決デザインカードのレポート枠との整合（優先度中）

**現状**: 解決アイディアは `border-green-200` の白カード。論点・意見まとめはグレー背景のブロック。

**案**: 「レポート」としてのフォーマットをそろえる。

- 各解決アイディアカードを「中が白のレポート枠」にし、外側はセクション背景（muted）のみにする
- または、論点・意見まとめと同様に「1 つの大きなブロック（bg-card）の中に、各カードを並べる」形にし、色は `border-border` + `bg-card` で統一し、アクセントは左ボーダーやアイコンのみ green にする

こうすると「みんなの論点」「みんなのアイディア」「みんなの解決デザイン」の 3 種が同じ「レポート」言語で見える。

---

### F. 空状態・プレースホルダーの統一（優先度中）

**現状**: DebatePointsContent / CitizenOpinionContent / SolutionIdeasContent で「データなし」時の文言・余白・色がばらついている。

**案**: ガイドラインの **muted-foreground** を使い、レイアウトを揃える。

- メッセージ: `text-muted-foreground`
- コンテナ: セクションと同じ `py-8` または `py-12`、`text-center`
- 補足文: `text-sm mt-2 text-muted-foreground`

1 つの「EmptyState」コンポーネントにまとめると、今後のレポート追加時も統一しやすい。

---

### G. フォントの明示（優先度低）

**現状**: 見出しに `font-biz` が必ずしも付いていない。

**案**: ガイドラインに合わせ、ページタイトル・セクション見出しに **font-biz** を付与する。  
（Tailwind で `font-biz` が BIZ UDGothic にマッピングされている前提）

---

### H. ボタンのガイドライン準拠（優先度低）

**現状**: 「イラストまとめを見る」が `className="... bg-blue-600 ..."` の独自スタイル。

**案**: shadcn の **Button**（`variant="default"` など）を使う。  
primary 色はテーマの `hsl(var(--primary))` になり、ガイドラインの「ボタン: primary」と一致する。

---

## 3. 実装の優先順位（まとめ）

| 優先度 | 項目 | 効果 |
|--------|------|------|
| 高 | A. セクション見出しを SectionHeading で統一 | 一貫性・可読性・ガイドライン準拠 |
| 中 | B. セクションごとにアイコン | 視認性・スキャンしやすさ |
| 中 | C. セクション/カード背景の役割明確化 | 階層が分かりやすく、レポートらしさ |
| 中 | E. 解決デザインと他レポートのフォーマット整合 | 3 種のレポートが同じ「言語」で見える |
| 中 | F. 空状態の統一 | 丁寧さ・一貫性 |
| 低 | D. 重要論点カードに subtle-shadow | 立体感 |
| 低 | G. 見出しに font-biz | フォントガイドライン準拠 |
| 低 | H. イラストまとめボタンを Button に | コンポーネント・色の統一 |

まず **A → B → F** から入れると、手数が少なく見た目の変化が大きいです。その後に C・E で「レポート」としてのフォーマットをそろえると、さらに見栄えが良くなります。
