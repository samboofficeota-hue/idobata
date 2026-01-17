# AIによる情報生成と情報表示の構造確認結果

## 1. AIによる情報生成の構造

### 1.1 イラストまとめ（Visual Report / イラスト要約）

**管理画面での操作:**
- 個別生成: 「更新する」ボタン → `handleGenerateVisualReport()`
- 一括生成: 「一括作成」ボタン → `handleBulkGenerateVisualReports()`

**APIエンドポイント:**
- 生成: `POST /api/themes/:themeId/questions/:questionId/generate-visual-report`
- 取得: `GET /api/themes/:themeId/questions/:questionId/visual-report`

**バックエンド処理フロー:**
1. `generateVisualReport` worker (`workers/visualReportGenerator.js`)
2. → `generateQuestionVisualReport` service (`services/questionVisualReportGenerator.js`)
3. → `QuestionVisualReport`モデルに保存（`overallAnalysis`フィールドにHTMLが保存）

**データモデル:**
- モデル: `QuestionVisualReport`
- 主要フィールド:
  - `questionId`: 質問ID
  - `overallAnalysis`: HTML形式のイラスト要約（文字列）
  - `version`: バージョン番号

**フロントエンド表示:**
- フィールド名: `visualReport`（`questionDetail.visualReport`）
- コンポーネント: `IllustrationSummaryContent`
- 表示場所: 「生成されたレポート」セクション内の「イラスト要約」カード

---

### 1.2 論点まとめ（Debate Analysis / 論点まとめ）

**管理画面での操作:**
- 個別生成: 「更新する」ボタン → `handleGenerateDebateAnalysis()`
- 一括生成: 「一括作成」ボタン → `handleBulkGenerateDebateAnalysis()`

**APIエンドポイント:**
- 生成: `POST /api/themes/:themeId/questions/:questionId/generate-debate-analysis`
- 取得: `GET /api/themes/:themeId/questions/:questionId/debate-analysis`

**バックエンド処理フロー:**
1. `generateDebateAnalysisTask` worker (`workers/debateAnalysisGenerator.js`)
2. → `generateDebateAnalysis` service (`services/debateAnalysisGenerator.js`)
3. → `DebateAnalysis`モデルに保存

**データモデル:**
- モデル: `DebateAnalysis`
- 主要フィールド:
  - `questionId`: 質問ID
  - `axes`: 対立軸の配列（`title`, `options`を含む）
  - `agreementPoints`: 合意点の配列
  - `disagreementPoints`: 対立点の配列
  - `version`: バージョン番号

**フロントエンド表示:**
- フィールド名: `debateData`（`questionDetail.debateData`）
- コンポーネント: `DebatePointsContent`
- 表示場所: 「生成されたレポート」セクション内の「論点まとめ」カード

---

### 1.3 意見まとめ（Digest Draft / 市民意見レポート）

**管理画面での操作:**
- 個別生成: 「更新する」ボタン → `handleGenerateReport()`
- 一括生成: 「一括作成」ボタン → `handleBulkGenerateReports()`

**APIエンドポイント:**
- 生成: `POST /api/themes/:themeId/questions/:questionId/generate-digest`
- 取得: `GET /api/themes/:themeId/digest-drafts?questionId=:questionId`

**バックエンド処理フロー:**
1. `generateDigestDraft` worker (`workers/digestGenerator.js`)
2. → `DigestDraft`モデルに保存

**データモデル:**
- モデル: `DigestDraft`
- 主要フィールド:
  - `questionId`: 質問ID
  - `title`: タイトル
  - `content`: 内容（Markdown形式）
  - `createdAt`: 作成日時

**フロントエンド表示:**
- フィールド名: `digestDraft`（`questionDetail.digestDraft`）
- コンポーネント: `OpinionSummaryContent`
- 表示場所: 「生成されたレポート」セクション内の「意見まとめ」カード

---

## 2. 情報表示の構造

### 2.1 表示/非表示の制御

**管理画面での操作:**
- 「表示中」/「非表示」ボタン → `handleToggleVisibility()`

**APIエンドポイント:**
- 更新: `PUT /api/themes/:themeId/questions/:questionId/visibility`
- リクエストボディ: `{ "isVisible": boolean }`

**バックエンド処理:**
- `updateQuestionVisibility` controller (`controllers/questionController.js`)
- → `SharpQuestion`モデルの`isVisible`フィールドを更新

**データモデル:**
- モデル: `SharpQuestion`
- フィールド: `isVisible` (Boolean, デフォルト: `true`)

**フロントエンドでの使用:**
- 現在、`getQuestionsByTheme` APIでは`isVisible`でフィルタリングされていない
- すべての質問が返されるため、フロントエンド側でフィルタリングが必要な可能性がある

---

## 3. フロントエンドとバックエンドの対応関係

| フロントエンド表示名 | バックエンド管理画面名 | データモデル | APIエンドポイント（生成） |
|---------------------|---------------------|------------|------------------------|
| イラスト要約 | イラストまとめ | QuestionVisualReport | `/generate-visual-report` |
| 論点まとめ | 論点まとめ | DebateAnalysis | `/generate-debate-analysis` |
| 意見まとめ | 市民意見レポート | DigestDraft | `/generate-digest` |

---

## 4. 確認された問題点

### 4.1 表示/非表示のフィルタリング

**問題:**
- `getQuestionsByTheme` API（`/api/themes/:themeId/questions`）では、`isVisible`でフィルタリングされていない
- すべての質問（`isVisible: false`を含む）が返される

**影響:**
- フロントエンドで非表示に設定した質問も表示される可能性がある
- フロントエンド側でフィルタリングが必要

**推奨対応:**
- バックエンドの`getQuestionsByTheme`で`isVisible: true`の質問のみを返すように修正
- または、フロントエンド側で`isVisible`フィールドを確認してフィルタリング

---

## 5. データフロー図

```
管理画面
  ↓
[イラストまとめ] → generateVisualReport → QuestionVisualReport
[論点まとめ]     → generateDebateAnalysis → DebateAnalysis
[市民意見レポート] → generateDigestDraft → DigestDraft
[表示/非表示]    → updateQuestionVisibility → SharpQuestion.isVisible
  ↓
バックエンドAPI
  ↓
フロントエンド
  ↓
[イラスト要約] ← visualReport (QuestionVisualReport.overallAnalysis)
[論点まとめ]   ← debateData (DebateAnalysis)
[意見まとめ]   ← digestDraft (DigestDraft)
```

---

## 6. 次のステップ

1. **表示/非表示のフィルタリング修正**
   - `getQuestionsByTheme`で`isVisible: true`のみを返すように修正
   - または、フロントエンド側でフィルタリングを実装

2. **各レポートタイプの生成状態確認**
   - レポートが生成されているかどうかを管理画面で確認できるようにする
   - 生成済み/未生成の状態を表示

3. **エラーハンドリングの強化**
   - レポート生成失敗時のエラーメッセージを明確にする
   - 生成中の状態を適切に表示
