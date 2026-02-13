# AI機能：現行実装とフォーク元のファイル構成比較

比較元: [AI機能_フォーク元と現行実装の比較.md](./AI機能_フォーク元と現行実装の比較.md)  
フォーク元: https://github.com/digitaldemocracy2030/idobata

---

## 1. 現行実装（ローカル）のファイル構成

### 1.1 リポジトリルート

```
idobata/
├── idea-discussion/          # 対話・問い・AI生成の中核
│   ├── backend/
│   └── docs/                 # legacy-chat-sequence.md 等
├── frontend/                 # 市民向けUI
├── admin/                    # 管理画面（AI一括生成トリガー等）
├── policy-edit/
├── docs/                     # AI_Usage_Documentation.md 等
├── AI機能_フォーク元と現行実装の比較.md
└── AI情報生成と表示構造の確認結果.md
```

### 1.2 idea-discussion/backend（AI関連を中心に）

```
idea-discussion/backend/
├── controllers/
│   ├── chatController.js         # 対話AI（フェーズ制御 or customPrompt）→ LLM 1回
│   ├── digestController.js       # 意見まとめ生成のAPI
│   ├── questionController.js     # 論点まとめ・イラストまとめ・シャープな問い等のAPI
│   └── adminController.js        # 論点一括生成など
├── workers/
│   ├── extractionWorker.js       # 課題・解決策の抽出（チャット送信後非同期）
│   ├── digestGenerator.js        # 意見まとめ（Digest Draft）生成
│   ├── questionGenerator.js      # シャープな問い（HMW）生成
│   ├── debateAnalysisGenerator.js  # 論点まとめ：サービスを呼ぶ薄いラッパー
│   ├── visualReportGenerator.js    # イラストまとめ：サービスを呼ぶ薄いラッパー
│   ├── solutionIdeasGenerator.js   # 解決策アイデア（比較MDの表には未記載）
│   ├── reportGenerator.js
│   ├── policyGenerator.js
│   ├── linkingWorker.js
│   └── dailyBatchProcessor.js
├── services/
│   ├── llmService.js              # 共通 LLM 呼び出し（現行は gpt-5-mini デフォルト）
│   ├── debateAnalysisGenerator.js  # 論点JSON + formattedReport(HTML) の2段階生成
│   ├── questionVisualReportGenerator.js  # イラスト要約HTML生成
│   ├── auth/
│   ├── embedding/
│   ├── storage/
│   └── socketService.js
├── models/
│   ├── ChatThread.js (or .ts)
│   ├── DigestDraft.js
│   ├── DebateAnalysis.js
│   ├── SharpQuestion.js
│   ├── Problem.js / Solution.js / QuestionLink.js
│   └── ...
├── routes/
│   ├── themeChatRoutes.js
│   ├── themeDigestRoutes.js
│   ├── themeGenerateQuestionsRoutes.js
│   └── ...
└── docs/  # なし（idea-discussion/docs にあり）
```

### 1.3 AI機能ごとの「入口 → Worker/Service → モデル」対応（現行）

| 機能 | ルート/コントローラ | Worker / Service | モデル |
|------|---------------------|------------------|--------|
| 対話AI | themeChatRoutes → chatController | 直接 llmService（フェーズプロンプト） | ChatThread |
| 課題・解決策抽出 | チャット送信後キュー | extractionWorker → llmService | Problem, Solution, QuestionLink |
| 意見まとめ | themeDigestRoutes → digestController | digestGenerator → llmService | DigestDraft |
| 論点まとめ | questionController / adminController | debateAnalysisGenerator(worker) → debateAnalysisGenerator(service) | DebateAnalysis |
| イラストまとめ | questionController | visualReportGenerator(worker) → questionVisualReportGenerator(service) | QuestionVisualReport |
| シャープな問い | themeGenerateQuestionsRoutes → questionController | questionGenerator → llmService | SharpQuestion |

---

## 2. フォーク元（digitaldemocracy2030/idobata）のファイル構成

### 2.1 idea-discussion 直下

```
idea-discussion/
├── backend/
├── docs/          # legacy-chat-sequence.md 等（対話AIのシステムプロンプト記載）
├── project/
├── README.md
└── tmp/
```

### 2.2 idea-discussion/backend（GitHub API で取得した構成）

```
idea-discussion/backend/
├── controllers/     # 中身は取得タイムアウトのため未取得（chatController 等と想定）
├── workers/
│   ├── debateAnalysisGenerator.js   # 約633B → サービス呼び出しの薄いラッパー想定
│   ├── digestGenerator.js           # 約7KB
│   ├── extractionWorker.js          # 約31KB
│   ├── linkingWorker.js
│   ├── policyGenerator.js
│   ├── questionGenerator.js
│   ├── reportGenerator.js
│   └── visualReportGenerator.js     # 約620B → サービス呼び出しの薄いラッパー想定
├── services/
│   ├── debateAnalysisGenerator.js  # 約5.8KB（論点JSONのみ、1回LLM）
│   ├── llmService.js                # 約4.2KB
│   ├── questionVisualReportGenerator.js  # 約7.8KB
│   ├── llmService.test.js
│   ├── socketService.js
│   ├── auth/
│   ├── embedding/
│   └── storage/
├── models/
├── routes/
├── middleware/
├── scripts/
├── tests/
├── utils/
├── types/
├── server.js
├── package.json
├── Dockerfile
└── tsconfig.json
```

フォーク元では **debateAnalysisGenerator** が workers と services の両方に存在（worker が service を呼ぶ構成）。**イラストまとめ**は workers/visualReportGenerator → services/questionVisualReportGenerator の流れと想定。

---

## 3. 構成の対応関係と主な差分

### 3.1 ディレクトリ・ファイルの対応

| 役割 | フォーク元 | 現行実装 | 備考 |
|------|------------|----------|------|
| 対話AI | controllers/chatController.js（要確認） | controllers/chatController.js | 現行はフェーズ制御プロンプト、フォーク元は legacy-chat-sequence のシステムプロンプト |
| 課題・解決策 | workers/extractionWorker.js | 同一パス | プロンプトはほぼ同一、モデルは現行が gpt-5-mini 統一 |
| 意見まとめ | workers/digestGenerator.js | 同一パス | フォーク元は Policy 必須・Gemini、現行は Policy 任意・gpt-5-mini・Markdown 指定追加 |
| 論点まとめ | workers + services/debateAnalysisGenerator | 同一パス | フォーク元は Gemini 1回→JSONのみ。現行は gpt-5-mini 2回（JSON＋HTML）、formattedReport 保存 |
| イラストまとめ | workers/visualReportGenerator + services/questionVisualReportGenerator | 同一パス | フォーク元は未取得。現行は日付挿入・デザイン仕様明文化 |
| シャープな問い | workers/questionGenerator.js | 同一パス | フォーク元は Gemini、現行は gpt-5-mini。プロンプトはほぼ同一 |
| LLM共通 | services/llmService.js | 同一パス | フォーク元は Gemini 指定あり、現行は OpenAI(gpt-5-mini) 統一 |

### 3.2 現行のみ存在するもの

- **backend/models/ChatThread.ts** など TypeScript 化されたモデル
- **backend/types/index.ts**
- **workers/solutionIdeasGenerator.js**（比較MDの機能一覧には未記載）
- **build/**（ビルド成果物）

### 3.3 ドキュメントの所在

| ドキュメント | 現行 | フォーク元 |
|--------------|------|------------|
| 対話シーケンス・システムプロンプト | idea-discussion/docs/legacy-chat-sequence.md | idea-discussion/docs/（同様に存在） |
| AI利用説明 | docs/AI_Usage_Documentation.md | 要確認 |
| 比較・確認用MD | AI機能_フォーク元と現行実装の比較.md、AI情報生成と表示構造の確認結果.md | なし（現行のみ） |

---

## 4. 改善時に参照するファイルの優先順位（現行）

精度改善のため、フォーク元と突き合わせて見るべき現行ファイルは次のとおり。

1. **対話AIの精度**
   - `idea-discussion/backend/controllers/chatController.js`（現行のフェーズ制御）
   - `idea-discussion/docs/legacy-chat-sequence.md`（フォーク元に近いプロンプトの参考）

2. **課題・解決策の抽出精度**
   - `idea-discussion/backend/workers/extractionWorker.js`

3. **意見まとめの品質**
   - `idea-discussion/backend/workers/digestGenerator.js`

4. **論点まとめの品質**
   - `idea-discussion/backend/services/debateAnalysisGenerator.js`
   - `idea-discussion/backend/workers/debateAnalysisGenerator.js`（入口のみ）

5. **シャープな問いの品質**
   - `idea-discussion/backend/workers/questionGenerator.js`

6. **LLM呼び出し・モデル指定**
   - `idea-discussion/backend/services/llmService.js`（デフォルトモデル・Gemini併用の有無）

フォーク元の該当ファイルは GitHub の raw または API で取得して差分比較するとよい。

---

## 5. まとめ

- **ディレクトリ構造はほぼ同一**で、AI関連は `controllers` → `workers` / `services` → `llmService` の流れが共通。
- **相違点**は主に次の3点：
  1. **プロンプト設計**（対話AIのフェーズ制御 vs 従来型深掘り、意見まとめの Markdown 指定など）
  2. **使用モデル**（フォーク元: Gemini 多用、現行: gpt-5-mini 統一）
  3. **論点まとめ**の2段階化（JSON＋HTML）と **formattedReport**、**意見まとめ**の Policy 任意対応。

精度改善では、上記「4. 改善時に参照するファイル」を現行とフォーク元で並べてプロンプト・モデル指定を比較し、必要に応じてフォーク元のプロンプトやモデル選択を部分的に取り込むとよい。
