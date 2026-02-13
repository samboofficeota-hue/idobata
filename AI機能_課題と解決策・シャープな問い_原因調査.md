# 課題と解決策の抽出・シャープな問い「シャープにならない」原因調査

修正は行わず、原因となりそうなポイントを整理する。

---

## 1. データの流れの整理

```
[抽出のトリガー]
  チャット送信  →  chatController  →  setTimeout(processExtraction, 0)  ※毎回
  インポート    →  importController →  processExtraction
  手動「意見を送る」 →  POST .../threads/:threadId/extract  →  processExtraction（2件以上ユーザーメッセージ必須）

[抽出結果の保存]
  processExtraction  →  Problem / Solution に themeId 付きで保存
                    →  ChatThread.extractedProblemIds / extractedSolutionIds に追加
                    →  linkItemToQuestions で QuestionLink 作成（既存の SharpQuestion と関連付け）

※ **フォーク元との比較**（digitaldemocracy2030/idobata の main を参照）:
- **同じ**: チャット送信時の非同期抽出（setTimeout + processExtraction）、インポート時の processExtraction、保存フロー（Problem/Solution の themeId・ChatThread 更新・linkItemToQuestions）はフォーク元と同一構成。
- **現行のみ**: 手動トリガー「POST .../threads/:threadId/extract」（triggerExtractionForThread）はフォーク元の themeChatRoutes には存在しない。現行で追加されたAPI。

[シャープな問いの生成]
  入力: Problem.find({ themeId }, "statement") のみ（Solution は使っていない）
  課題が0件 → 早期 return（問いは生成されない）
  課題が1件以上 → その statement 一覧を LLM に渡して HMW 形式で 6 問生成
```

**結論**: シャープな問いは **課題（Problem）の statement だけ** を元にしている。課題が少ない・似通っている・抽象的だと、問いも少なく・汎用的になりやすい。

---

## 2. 「課題と解決策の抽出を随時行なっていない」に関連しそうなポイント

### 2.1 抽出が走るタイミングが限られている

| トリガー | 条件 | 備考 |
|----------|------|------|
| **チャット送信時** | 1回の送信ごとに1回 | バックエンドで `setTimeout(processExtraction, 0)` で非同期実行。メッセージ数による制限はなし。 |
| **インポート時** | インポート1件ごとに1回 | ImportedItem が pending のときのみ。 |
| **手動「意見を送る」** | 同一スレッドでユーザーメッセージが **2件以上** | `triggerExtractionForThread`。フロントの「わたしの意見を送る」がこの API を呼ぶ。 |

**随時でない点**:

- **既存スレッドの一括・定期再抽出がない**
  - 全 ChatThread を走査して `processExtraction` をかけるバッチや cron は存在しない。
  - 過去スレッドは「そのスレッドで新しくメッセージを送る」か「手動で意見を送る」をしない限り、再抽出されない。
- チャットが少ない／インポートをあまり使わない運用だと、Problem/Solution がそもそも溜まりにくい。

### 2.2 抽出プロンプトが「無理に作らない」方針

`extractionWorker.js` のチャット用プロンプトには次のルールがある。

- **「情報が不足している場合は、無理に問題や解決策を生成しないでください。良質な statement を作成するための十分な情報がない場合は、空の配列を返してください。」**

そのため、

- 短文やあいまいな発言だけのスレッドでは `additions` が空になりやすい。
- 結果として、チャットはあるが Problem/Solution が増えない、という状態になり得る。

### 2.3 非同期実行まわり

- 抽出は `setTimeout(..., 0)` で fire-and-forget。キューやリトライはない。
- `processExtraction(job).catch(...)` でログだけ取り、失敗してもチャット応答は成功扱い。
- LLM の不調・タイムアウト・パース失敗で抽出が落ちても、ユーザーには見えず、**同じスレッドの再抽出は手動 or 再送信しないと走らない**。

### 2.4 手動トリガーの条件

- `triggerExtractionForThread` は「ユーザーメッセージが 2 件未満」だと 400 で弾く。
- 1 往復しかしていないスレッドでは、手動「意見を送る」でも抽出が実行されない。

---

## 3. 「シャープな問いが全然シャープになっていない」に関連しそうなポイント

### 3.1 入力が Problem の statement のみ

- `questionGenerator.js` の `generateSharpQuestions(themeId)` は  
  `Problem.find({ themeId }, "statement").lean()` だけを入力にしている。
- **Solution は一切使っていない**（フォーク元との差分は未確認だが、現行は問題文のみ）。
- 課題が 0 件のテーマでは問い生成自体がスキップされる。

→ 抽出が随時でなく課題が少ないと、そもそも問いのタネが少ない／偏る。

### 3.2 課題の「量」と「質」

- 課題が少ない（例: 1〜3 件）と、同じような問題文から 6 問を無理に作ることになり、**似た表現・汎用的な問い**になりやすい。
- 課題文が抽象的・短い（抽出が厳しめで「無理に作らない」結果、短い statement だけが残っている場合など）だと、HMW にしても具体性・シャープさが出にくい。

### 3.3 日次バッチの条件が厳しい

`dailyBatchProcessor.js` の `autoGenerateSharpQuestions`:

- **「課題が 10 件以上」かつ「問いが 5 件未満」** のときだけ `generateSharpQuestions(themeId)` を実行。
- 課題が 10 件未満のテーマは、日次では**一度も**シャープな問いが自動生成されない。
- 管理画面からの手動「シャープな問い生成」は、この条件に関係なく実行される（`themeId` 指定で呼ぶため、0 件でも LLM は呼ばれるが、0 件なら早期 return）。

→ 運用として「バッチ任せ」にしていると、課題が 10 件に満たないテーマは問いが更新されず、古い問いだけが並ぶ／「シャープでない」印象になりやすい。

### 3.4 モデル指定

- 現行: `callLLM(messages, true, "gpt-5-mini")` で固定（比較 MD より）。
- フォーク元: `google/gemini-2.5-pro-preview-03-25` を使用している記載あり。
- モデル差で、同じプロンプトでも「問いの具体性・シャープさ」に差が出る可能性はある。

### 3.5 プロンプトの「Consolidate similar problems」

- 現行のシステムプロンプトには  
  **「Consolidate similar problems into broader HMW questions where appropriate」** がある（比較 MD より）。
- 類似課題をまとめることで、問いの数は減り、**より抽象的・汎用的な問い**になりやすい。  
  「全然シャープになっていない」という印象と整合する可能性がある。

### 3.6 問いの更新・重複

- `SharpQuestion.findOneAndUpdate(..., { questionText, themeId }, { upsert: true })` で、  
  **同一 themeId 内で questionText が同じなら新規作成されない**。
- 課題が増えて再度「シャープな問い」を生成しても、既存と文言がかぶると増えず、**古い問いが残り続ける**可能性がある。
- 意図的に「似た問いを減らす」設計だが、課題の質が上がったあとに「問いを刷新したい」というニーズとは相性が悪い場合がある。

---

## 4. 抽出 ⇔ シャープな問いのつながりでまとめると

1. **抽出が「随時」ではない**
   - 既存スレッドの一括・定期再抽出がない。
   - チャット送信・インポート・手動「意見を送る」のときだけ。
   - チャットが少ない／手動を押さないと、Problem が増えにくい。

2. **抽出が「無理に作らない」**
   - 情報不足だと additions が空になりやすく、課題数が伸びにくい。

3. **シャープな問いは「課題の statement だけ」が入力**
   - 課題が少ない・似ている・抽象的 → 問いも少ない／汎用的になりやすい。

4. **日次バッチは「課題 10 件以上 & 問い 5 件未満」のみ**
   - 課題が 10 件未満のテーマは、バッチでは問いが更新されない。

5. **類似課題の統合指示**
   - 「Consolidate similar problems into broader HMW」で、問いがより抽象的になりうる。

6. **モデル**
   - 現行は gpt-5-mini 固定。フォーク元は Gemini。表現力の差の可能性あり。

---

## 5. 原因となりそうなポイント一覧（修正時の参照用）

| # | 観点 | 場所 | 内容 |
|---|------|------|------|
| 1 | 抽出トリガー | 全体 | 既存スレッドの一括・定期再抽出がない。随時実行は「送信時・インポート・手動」のみ。 |
| 2 | 抽出の厳しさ | extractionWorker.js プロンプト | 「情報不足なら無理に生成しない」→ additions が空になりやすい。 |
| 3 | シャープな問いの入力 | questionGenerator.js | Problem の statement のみ。Solution 未使用。0 件でスキップ。 |
| 4 | 日次バッチ条件 | dailyBatchProcessor.js | 課題 10 件以上 & 問い 5 件未満のときだけ自動生成。 |
| 5 | 類似統合 | questionGenerator.js システムプロンプト | 「Consolidate similar problems into broader HMW」で抽象的になりうる。 |
| 6 | 問いの更新 | questionGenerator.js | questionText + themeId で upsert。同じ文言は増えず古い問いが残りうる。 |
| 7 | 非同期・エラー | chatController.js / extractionWorker | 抽出は fire-and-forget。失敗時のリトライ・一覧再実行なし。 |
| 8 | 手動抽出の条件 | chatController.js triggerExtractionForThread | ユーザーメッセージ 2 件未満だと 400。 |
| 9 | モデル | questionGenerator.js / llmService.js | 現行 gpt-5-mini。フォーク元は Gemini。 |

これらを踏まえて、  
「抽出を随時（定期・一括）かけるか」「プロンプトや条件を緩めるか」「問いの入力に Solution を足すか」「バッチ条件・問い更新方針を見直すか」などを検討するとよい。
