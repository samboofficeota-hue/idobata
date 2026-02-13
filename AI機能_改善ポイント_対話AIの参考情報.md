# AI機能 改善ポイント：対話AIの参考情報（テーマ単位）

対話AIの回答精度悪化の**原因**として特定した点と、その改善方針を記録する。

---

## 1. 原因の要約

**テーマ単位チャット**で、参考情報（既存の問い・課題・解決策）の**取得方法**がフォーク元と異なっている。

| 観点 | フォーク元 | 現行実装 |
|------|------------|----------|
| **取得タイミング** | チャット処理の**その場**で DB を参照 | **日次バッチで選別した結果**を参照（`getQualityOpinionsForChat`） |
| **選定基準** | QuestionLink を **その場で aggregate** し、**関連度 0.8 以上**のものだけを採用 | 品質スコア（relevance × 0.7 + Like 正規化 × 0.3）でソートし、**閾値 0.3 以上・上限 10 件** |
| **問いとの対応** | 各「問い」ごとに、その問いに関連する課題・解決策（関連度 ≥0.8）を最大10件ずつ **$sample** で取得し、問い→課題・解決策の対応が分かる形でプロンプトに渡す | テーマ全体で「品質の高い課題・解決策」を一括で最大10件ずつ取得。**問いと課題・解決策の対応関係はプロンプトに含めていない** |

この違いにより、現行では「どの問いに関連する意見か」が LLM に伝わりにくく、参考情報の質・文脈がフォーク元より劣る可能性がある。

---

## 2. 現行実装の該当箇所

### 2.1 テーマ単位の参考情報取得（現行）

- **ファイル**: `idea-discussion/backend/controllers/chatController.js`
- **処理**: `context !== "question"` または `questionId` がない場合の **else** 分岐（おおよそ 213 行付近）
  - `getQualityOpinionsForChat(themeId, 10)` を呼び出し、返却された `qualityProblems` / `qualitySolutions` と `SharpQuestion.find({ themeId })` の一覧を `referenceOpinions` に結合
  - 問いリストと「関連性の高い課題」「関連性の高い解決策」を**並列に**列挙しているだけで、**問いと課題・解決策の紐付けは渡していない**

### 2.2 getQualityOpinionsForChat（現行）

- **ファイル**: `idea-discussion/backend/workers/dailyBatchProcessor.js`
- **処理**: `getQualityOpinionsForChat(themeId, limit = 10)`
  - テーマに属する SharpQuestion 一覧 → その questionId に対する QuestionLink を全件取得
  - 各 link について `calculateQualityScore(linkedItemId, linkedItemType, relevanceScore)` で品質スコアを計算（relevance × 0.7 + Like 正規化 × 0.3）
  - 品質スコアでソートし、**0.3 以上**のものから **limit 件**（デフォルト 10）の Problem ID / Solution ID を選別
  - 選んだ ID で Problem / Solution を取得して返す
- **特徴**: 「関連度 0.8 以上」という条件は使っておらず、**Like を含む品質スコア**で選んでいる。また「問いごと」のグルーピングはしていない。

---

## 3. フォーク元の挙動（参照用）

- **ファイル**: フォーク元 `idea-discussion/backend/controllers/chatController.js` の `handleNewMessageByTheme`（テーマ単位の else 分岐）
- **処理の流れ**:
  1. `SharpQuestion.find({ themeId }).lean()` でテーマ内の問い一覧を取得
  2. **各問いについて**:
     - QuestionLink を **aggregate** で取得
       - 課題: `linkedItemType: "problem"`, `linkType: "prompts_question"`, **`relevanceScore: { $gte: 0.8 }`**
       - 解決策: `linkedItemType: "solution"`, `linkType: "answers_question"`, **`relevanceScore: { $gte: 0.8 }`**
     - それぞれ **`$sample: { size: 10 }`** で最大 10 件をランダムに選択
     - 問い文・その問いに関連する課題リスト・解決策リストを **問い単位で** まとめて `referenceOpinions` に追加
  3. 最後に「これらの重要論点や関連意見も踏まえ、ユーザーとの対話を深めてください」という一文を付与

→ **その場で** QuestionLink を **関連度 0.8 以上** に絞り、**問いと課題・解決策の対応が分かる形**で LLM に渡している。

---

## 4. 改善方針（推奨）

1. **テーマ単位**の参考情報取得を、現行の `getQualityOpinionsForChat` 依存から、**フォーク元と同様の「その場で QuestionLink を aggregate する方式」に変更する**。
2. 選定基準を **関連度（relevanceScore）0.8 以上** に揃える（フォーク元に合わせる）。必要に応じて、件数上限（問いあたり 10 件など）もフォーク元に合わせる。
3. **問いごと**に「その問いに関連する課題・解決策」をまとめ、プロンプトでは「問い → 関連課題・関連解決策」が分かる形式で渡す（フォーク元の文言・構造を参考にするとよい）。
4. 上記を `chatController.js` のテーマ単位の else 分岐に実装する。`getQualityOpinionsForChat` は、他で使っていなければ削除またはテーマ単位チャットでは使わないようにする。

---

## 5. 変更対象ファイル（想定）

| ファイル | 変更内容 |
|----------|----------|
| `idea-discussion/backend/controllers/chatController.js` | テーマ単位の参考情報取得を、`getQualityOpinionsForChat` の代わりに、SharpQuestion 一覧 × QuestionLink aggregate（relevanceScore >= 0.8、問いごとに課題・解決策を最大10件程度）で組み立てる処理に変更 |
| `idea-discussion/backend/workers/dailyBatchProcessor.js` | テーマ単位チャットから `getQualityOpinionsForChat` を参照しなくなる場合、当該関数は他用途がなければ残すか削除するか検討（他で使用していれば残す） |

---

## 6. 補足（対話AIの参考情報について）

- **問い単位**（`context === "question"` かつ `questionId` あり）の参考情報は、現行でも QuestionLink をその場で aggregate し、関連度 0.8 以上で取得しているため、**フォーク元と同様の考え方**になっている。変更不要。
- 本ドキュメントは対話AIの参考情報（セクション1〜5）、シャープな問いの生成（セクション7）、**対話AIの体験・方針**（セクション8）の改善ポイントを含む。抽出精度の詳細は別ドキュメント（`AI機能_課題と解決策・シャープな問い_原因調査.md`）を参照。

---

## 7. シャープな問いの生成：問いが増え続ける問題と改善方針

### 7.1 現象

「シャープな問い」ボタンを押すたびに問いが追加され、同一テーマで 18 件など、件数がどんどん増えていく。

### 7.2 原因（プログラム上の要因）

- **重複判定が「文言完全一致」のみ**  
  重複とみなす条件が `questionText` の完全一致のため、LLM が毎回少しずつ違う表現（例：「現状は〜だが、それを〜にできるだろうか？」と「現状は〜。それを〜にすることは望ましいだろうか？」）を返すと、別の問いとして **新規挿入**される。その結果、1 回の実行で最大 6 件、複数回押下で 12 件・18 件と増えていく。
- **件数上限のない設計**  
  プロンプトでは「6 問生成」と指定しているが、DB 上で「1 テーマあたり最大 N 件」といった制限はなく、生成のたびに件数が加算されていく。

### 7.3 現行実装の該当箇所

- **ファイル**: `idea-discussion/backend/workers/questionGenerator.js`
- **処理**:
  - LLM で 6 件の問いを生成（`llmResponse.questions`）
  - 各要素について `SharpQuestion.findOneAndUpdate({ questionText: questionText.trim(), themeId }, { $setOnInsert: { ... } }, { upsert: true, new: true })` を実行
  - 一致する `questionText` が既に存在すれば更新はしない（`$setOnInsert` のため）が、**存在しなければ新規作成**。件数制限は行っていない。

### 7.4 改善方針（プログラム上の改善点）

- **プロンプトで 6 問生成は維持**  
  LLM には従来どおり「6 問生成」を指示する。変更なし。
- **重複している問いは新規作成しない**  
  完全一致に限らず、**既存の問いと重複している**（意味が近い・表記ゆれ程度の違いなど）と判定された場合は、新規挿入しない。重複判定には、文言の正規化（空白・句読点の統一など）や類似度の閾値、あるいは LLM による重複判定など、実装可能な方法で「重複」を定義する。
- **1 テーマにつき最大 10 件**  
  当該 themeId の SharpQuestion が **すでに 10 件ある場合は、今回生成した 6 件からは新規挿入しない**。10 件未満の場合のみ、重複でないものに限って挿入し、**合計が 10 件を超えないようにする**（既存の問いの削除や置き換えは行わない）。

### 7.5 変更対象ファイル（想定）

| ファイル | 変更内容 |
|----------|----------|
| `idea-discussion/backend/workers/questionGenerator.js` | ・LLM で 6 問生成する処理はそのまま。<br>・保存ループで、各問いについて：(1) 当該 themeId の既存 SharpQuestion 件数がすでに 10 件なら、その問いは挿入しない。(2) 既存問いとの**重複**（完全一致に加え、正規化後の一致や類似度で判定）があれば、その問いは挿入しない。(3) 重複がなく、かつ件数が 10 未満のときだけ新規挿入（upsert）する。<br>・挿入後に themeId の件数が 10 を超えないように、1 件ずつ挿入する際に件数を確認する。 |

### 7.6 補足

- **日次バッチの条件はそのまま残す**  
  `dailyBatchProcessor.js` の「シャープな問いの自動生成」条件（**課題が 10 件以上かつ問いが 5 件未満**のときだけ `generateSharpQuestions` を呼ぶ）は変更しない。

---

## 8. 対話AIの体験問題（最大の課題）と改善の方向性

ユーザーから以下のような声が上がっており、対話AIにおける**最大の問題**として扱う。

### 8.1 起きている事象

1. **ユーザーが回答にイライラする**  
   対話の進め方や AI の返し方に不満がたまり、ストレスを感じる。
2. **対話が建設的に進まず、一方的に情報提供を求められる印象**  
   ユーザーが「聞かれるばかりで、一緒に考えている感じがしない」「こちらの話を踏まえた応答が少ない」と感じる。
3. **ユーザーの回答に沿いすぎて、テーマと関係ないところで深掘りしてしまう**  
   ユーザーが言った方向に流され、**このテーマで議論すべき範囲**から外れた話題にまで深く入り込んでいく。

### 8.2 現行設計との対応づけ（想定要因）

現行の対話AIは **フェーズ制御型** のプロンプト（`chatController.js` のデフォルト systemPrompt）になっており、次のような設計が上記の事象と結びついている可能性がある。

| 事象 | 想定される要因（プログラム・プロンプト面） |
|------|--------------------------------------------|
| イライラする | **Phase 1 で「質問のみ」「要約・仮説・解決策の提示は一切禁止」** と厳格に指定しているため、聞く一方で共感や要約の返しが少なく、**尋問のように感じられる**。心理的安全性は謳っているが、「質問だけ」が続くルールが強く出ている。 |
| 一方的に情報提供を求められる | **「課題の材料収集」「引き出すことに専念」** が前面に出ており、ユーザーへの**ねぎらい・受け止め・簡潔な整理の返し**がプロンプトで弱い。フォーク元のように「簡潔な応答」「抽出支援」と並列で「話題の誘導」があるのに対し、現行は「何をしてよいか」が質問に偏っている。 |
| テーマから外れて深掘りする | **「テーマや参考情報に沿って話題を戻す」指示がプロンプトにない**。参考情報（既存の問い・課題・解決策）は渡しているが、「このテーマで議論されている問いのどれかに自然に引き戻す」「ユーザーの話がテーマから外れつつあるときは優しく方向を示す」といった**話題のアンカー**の指示がない。そのためユーザーの発言に流されやすく、テーマ外に逸れても深掘りし続けてしまう。 |

加えて、**テーマ単位**では参考情報の出し方がフォーク元と異なり（セクション1〜5）、「どの問いに関連するか」が LLM に伝わりにくいため、**話題をテーマの問いに結びつける**ことが難しくなっている可能性もある。

### 8.3 改善の方向性（プログラム・プロンプト）

以下は、上記を踏まえた改善の**方向性**である。具体的な文言は実装時に調整する。

1. **「質問のみ」のバランスを見直す**  
   - Phase 1 でも、**短い共感・受け止め**（「なるほど」「その状況は大変ですね」など）を認めるか、質問とセットで 1 文程度返してよいか検討する。  
   - 「要約・仮説・解決策の提示は禁止」は維持しつつ、**ユーザーが話した内容を一度受け止めてから質問する**流れをプロンプトで明示し、一方的な「質問の連打」にならないようにする。

2. **参考情報を「話題の軸」として使う指示を足す**  
   - 参考情報（既存の問い・課題・解決策）を **「このテーマで議論してほしい範囲・方向の目安」** として扱うよう指示する。  
   - ユーザーの話が **テーマや参考情報の問いから外れつつある** と判断したときは、**押し付けにならない程度に**「〇〇という問いとも関連しそうですね」など、テーマの問いに自然に引き戻す一文を入れてよいとプロンプトに書く。  
   - フォーク元の「話題の誘導」にある「参考情報として提示された既存の重要論点のどれかをピックアップしてそれについて議論することを優しく提案」に近い役割を、現行プロンプトにも持たせる。

3. **テーマとの整合を明示する**  
   - 「このチャットは【このテーマ】についての対話である。ユーザーの発言がテーマや参考情報の問いと関係ない方向に進みすぎたときは、深掘りしすぎず、テーマに関連する観点を優しく提示する」といった**テーマの枠**をプロンプトに追加する。  
   - 尋問にならないよう、「答えを引き出す」より **「テーマの範囲内で、ユーザーと一緒に整理する」** トーンを強める。

4. **参考情報の渡し方の改善（セクション1〜5）とセットで行う**  
   - テーマ単位で「その場で QuestionLink を aggregate し、関連度 0.8 以上・問いごとに課題・解決策を渡す」方式に変える（セクション4）ことで、**どの問いに関連するか**が LLM に伝わりやすくなり、話題の誘導やテーマからの逸脱防止にも寄与する。

### 8.4 変更対象（想定）

| 対象 | 内容 |
|------|------|
| `idea-discussion/backend/controllers/chatController.js` のデフォルト systemPrompt | 上記 8.3 の方向性を反映したプロンプト文言の見直し（Phase 1 のバランス、参考情報の使い方・話題の誘導・テーマの枠の明示）。Theme.customPrompt を使う場合は、運用で同様の観点を customPrompt に含めるか検討。 |
| 参考情報の組み立て（テーマ単位） | セクション4・5のとおり、問いごとに課題・解決策を渡す方式に変更し、対話の「話題の軸」として使いやすくする。 |

---

### 8.6 プロンプト改訂案（フェーズ制御を見直した案）と検討メモ

**背景**: フェーズ制御がうまく機能していないため、フェーズを前面に出さない改訂案を検討する。

**セクション構成（読み方）**
- **8.6.1** = 採用候補の**プロンプト本文**（そのまま実装にコピーして使うブロック）
- **8.6.2** = 改善のための**批判的指摘**（6項目）と修正時のチェックリスト
- **8.6.3** = **テーマ・参考情報・課題・解決策**の記述の形と参照元（実装でどこから取得するか）

---

#### 8.6.1 【プロンプト本文】ユーザー改訂案（原文）

**用途**: 対話AIのシステムプロンプトとして採用する改訂案。実装時はこのブロックを `chatController.js` の systemPrompt に渡す（または Theme.customPrompt のベースにする）。

```
あなたはテーマ型対話のファシリテーターです。
目的は、ユーザーの考えを3〜4往復の自然な対話で引き出すことです。

この対話には「テーマ」が設定されています。
対話は常にこのテーマに関係する範囲で行います。

ただし、ユーザーの発言を無理に遮ったり、話題を強引に戻したりしてはいけません。
話が広がった場合は、テーマと関係しそうな接点を見つけて、
「その視点はテーマの〇〇ともつながりそうですね」とやわらかく橋をかけてください。

「参考情報」として、
他ユーザーの意見から整理された「問題」や「解決策」の論点が与えられます。
これは質問テンプレではなく、対話の視点ヒントとして使います。
そのまま読み上げたり、機械的に順番に聞いたりしてはいけません。

対話の目標は次の4点をユーザーの言葉から引き出すことです：
・現状の認識（事実）
・それに対する感情や評価
・背景にある経験
・条件や主張のこだわり度合い

ルール：
・毎回まず短く受け止めてから質問する
・質問は1ターン1問（最大2問）
・尋問調にしない
・仮の言い換えや軽い仮説は許可する（断定は禁止）
・解決策はユーザーから出るまで提示しない
・段取りやフェーズの存在を感じさせない
```

---

#### 8.6.2 【批判的指摘】改善のための指摘と修正チェックリスト

**用途**: 8.6.1 のプロンプトを適用・修正する際のチェックリスト。各「提案」を反映するとよい。

**修正時のチェックリスト（要約）**
1. **往復数** → 「3〜4往復」を目安表現に緩和（厳格な上限にしない）
2. **テーマ** → プロンプトに「テーマ名は【テーマ】として示されます」を追記
3. **4つの目標** → 各項目に短い補足を追加（何が起きているか／どう感じているか／どんな経緯／どこを変えたいか）
4. **軽い仮説** → 許可例・不可例を1行追加
5. **終了** → ルールに「特にない／ここまでと言ったらねぎらって終える」を追加
6. **初回** → 「最初の1回はテーマに触れつつ話したいことを1つ聞く」を追加

| 観点 | 指摘 | 提案 |
|------|------|------|
| **「3〜4往復」** | 往復数を明示すると、LLM が「あと2往復で終わらせよう」と**カウントし始め**、ユーザーがまだ話したいときに早く締めようとする可能性がある。また「3〜4往復で引き出す」は目標としてやや硬い。 | 「数往復の自然な対話で」「3〜4往復を目安に」など**目安**に留め、厳格な上限にしない。あるいは「短い対話のあいだに」とだけ書き、往復数は書かない。 |
| **「テーマ」の参照** | プロンプト内で「テーマ」とだけ書いてあり、**テーマの具体的な文言がどこから来るか**が LLM には分からない。実際には別メッセージでテーマ名・説明が渡される想定だと思われるが、プロンプト側に「テーマ名（または説明）は直後に示されます」と一行あると、参考情報と合わせて解釈しやすい。 | 冒頭またはテーマの段落で「テーマ名（または短い説明）が、このあと【テーマ】として示されます」と明記する。実装では【テーマ】を `theme.title` 等で埋める。 |
| **4つの目標** | 「現状の認識」「感情・評価」「背景の経験」「こだわり度合い」は良いが、**毎ターン何を聞くかの指針**としてやや抽象的。ファシリテーターが「次はこだわりを聞こう」と選びやすくするため、一言ずつ例やキーワードがあるとよい。 | 各項目に短い補足を足す。例：「現状の認識（何が起きているか）」「感情・評価（どう感じているか）」「背景の経験（どんな経緯があるか）」「こだわり度合い（どこを変えたいか）」など。長くしすぎない範囲で。 |
| **「軽い仮説」の境界** | 「仮の言い換えや軽い仮説は許可」は良いが、**どこまでが許可でどこからが断定か**が LLM に曖昧。 | 例を一つ入れる。「例：『もしかして〇〇という感覚に近いですか？』は可。『それは〇〇ですね』と決めつけるのは不可。」 |
| **終了の扱い** | 現行の Phase 5 にあった「ユーザーがこれ以上ないと言ったときの締め」が**ない**。そのままだと、ユーザーが「特にないです」「ここまで」と言っても、AI がまた質問を続けたり、締めの言葉がばらついたりする。 | ルールに一行追加。「ユーザーが『特にない』『ここまで』などと示したら、短くねぎらって対話を終える。」 |
| **初回の振る舞い** | 最初の1ターンで、**何をきっかけに話してもらうか**の指示がない。テーマに触れてから聞くか、いきなり「何について話したいか」かで挙動が変わる。 | 「最初の1回は、テーマに軽く触れつつ、ユーザーが話したいことを1つ聞く」など、初回だけのルールを一文でよいので書く。 |

---

#### 8.6.3 【データ仕様】テーマ・参考情報の記述の形と参照元

**用途**: 実装時に【テーマ】と【参考情報】を**どのデータソース（ファイル・モデル・変数）から取得し、どの形式で LLM に渡すか**を定義する。ChatGPT 等が実装タスクを行うときは、ここを参照して組み立てる。

以下、テーマ・参考情報・課題・解決策それぞれについて「役割」「参照元（取得方法）」「推奨の形」を記載する。

**テーマ**

- **役割**: 対話の範囲の軸。「このテーマに関係する範囲で」の「このテーマ」が何かを LLM が認識するため。
- **参照元（実装上の取得方法）**:
  - **themeId**: チャット送信 API のパスパラメータ。`req.params.themeId` で取得する。ルート例：`POST /themes/:themeId/chat/messages`（`idea-discussion/backend/routes/themeChatRoutes.js` で `router.post("/messages", handleNewMessageByTheme)` とマウントされている）。
  - **テーマの文言**: themeId をキーに **Theme モデル** から取得する。`idea-discussion/backend/controllers/chatController.js` の `handleNewMessageByTheme` 内で、すでに `const theme = await Theme.findById(themeId)` によりテーマ文書を取得している（customPrompt 用）。【テーマ】としてプロンプトに渡す値は、この `theme` の **`theme.title`**（必須）を使う。必要に応じて **`theme.description`**（任意）を足して短い説明にしてもよい。
  - **モデル定義**: `idea-discussion/backend/models/Theme.js`。スキーマに `title`（String, required）, `description`（String, required: false）, `slug`, `isActive`, `customPrompt` などがある。
- **推奨の形**:
  - プロンプト本文では「この対話にはテーマが設定されています。テーマ名（または短い説明）は以下【テーマ】に示します。」のように書く。
  - **実装で渡す中身**: `theme.title` を必須とし、1行で渡す。例：`【テーマ】${theme.title}`。必要なら `【テーマ】${theme.title}：${theme.description}` のように description を付ける（長くなりすぎない範囲で）。
- **置き場所**: 参考情報の**直前**の system メッセージに「【テーマ】〇〇」と入れるか、参考情報ブロックの**先頭1行**に【テーマ】を置く。プロンプト内で「【テーマ】は参考情報の直前に示されます」と書いておけば、LLM は両方をセットで解釈しやすい。

**参考情報**

- **役割**: 質問の台本ではなく「視点ヒント」。どのような論点（問題・解決策）がこのテーマで議論されているかを示し、深掘りの方向の候補にする。
- **参照元（実装上の組み立て方）**:
  - 参考情報は **「問い」（SharpQuestion）** と、各問いに関連する **「課題」（Problem）**・**「解決策」（Solution）** を組み合わせた1つのテキストブロックとして、`idea-discussion/backend/controllers/chatController.js` の `handleNewMessageByTheme` 内で `referenceOpinions` 変数に組み立てられている。
  - **問い単位**（`context === "question"` かつ `questionId` あり）のとき: 1つの問いと、その問いに紐づく課題・解決策だけを取得し、`referenceOpinions` に格納する（下記「課題」「解決策」の問い単位の取得方法を参照）。
  - **テーマ単位**（上記以外）のとき: テーマ内の全問い一覧（`SharpQuestion.find({ themeId })`）と、`getQualityOpinionsForChat(themeId, 10)` が返す課題・解決策の一覧を組み合わせて `referenceOpinions` に格納する。現行は問いと課題・解決策の**対応関係**はプロンプトに含めていない（セクション4・5で「問いごとに」渡す方式への変更を推奨）。
  - 組み立てた `referenceOpinions` は、`llmMessages` に `{ role: "system", content: referenceOpinions }` として push され、LLM に渡される（参考情報が空でない場合）。
- **推奨の形（アウトプット＝渡すテキストの形）**:
  - **見出し＋箇条書き**が扱いやすい。
  - 問いが複数ある場合は、**問いごとにブロック**にし、その問いに関連する「課題」「解決策」を短い文で列挙する（セクション4・5の「問いごとに課題・解決策を渡す」方式と一致）。
  - 1問いあたり **4〜8行程度**（問い1行＋課題2〜4行＋解決策2〜4行）。全体で **問い3〜6個・総量で20〜40行** を目安にすると、「視点ヒント」として使いつつ、トークンも抑えられる。
  - 例（形だけ）:
    ```
    【参考情報】他ユーザーの意見から整理された論点です。対話の視点のヒントとして使ってください。

    問い: 〇〇という状況を、どう〇〇に変えられるか？
      関連する課題: ・… ・…
      関連する解決策: ・… ・…

    問い: △△について、……
      関連する課題: ・…
      関連する解決策: ・…
    ```
- **プロンプト側の記述**: 「『参考情報』として、上記【参考情報】ブロックに、このテーマで議論されている問いと、それぞれに関連する課題・解決策の論点が示されます。質問のテンプレートではなく、対話の視点ヒントとして使い、そのまま読み上げたり順番に聞いたりしないでください。」のように、**どこに何が書いてあるか**を短く説明するとよい。

**課題（Problem）**

- **役割**: 参考情報の一部。他ユーザーから抽出された「問題・課題」の論点。対話の視点ヒントとして、どのような課題がこのテーマで議論されているかを示す。
- **参照元（実装上の取得方法）**:
  - **モデル**: `idea-discussion/backend/models/Problem.js`。スキーマの主なフィールドは **`statement`**（課題文、String, required）, **`themeId`**（所属テーマの ObjectId）, `sourceOriginId`, `sourceType`, `version` など。参考情報としてプロンプトに渡すのは **`statement`**（および `combinedStatement` 等のフォールバックがあればそれ）。
  - **問い単位のとき**: `chatController.js` 内で、`QuestionLink.aggregate` により取得。条件は `questionId: question._id`, `linkedItemType: "problem"`, `linkType: "prompts_question"`, **`relevanceScore: { $gte: 0.8 }`**。`$lookup` で `problems` コレクションと結合し、`themeId` が当該テーマのものだけを採用。関連度の高い順に最大15件。問い（SharpQuestion）に「関連性の高い課題」として紐づけて `referenceOpinions` に追記する。
  - **テーマ単位のとき**: `getQualityOpinionsForChat(themeId, 10)` を呼ぶ。内部では `dailyBatchProcessor.js` で、テーマに属する SharpQuestion 一覧 → その `questionId` に対する **QuestionLink** を全件取得 → 各 link の `linkedItemType === "problem"` について品質スコア（relevance × 0.7 + Like 正規化 × 0.3）を計算 → 0.3 以上で上位 **limit 件**（デフォルト 10）の `linkedItemId` を選び、**`Problem.find({ _id: { $in: selectedProblemIds } })`** で文書を取得して返す。chatController では返却された `qualityProblems` の各要素の `statement`（等）を「関連性の高い課題」として `referenceOpinions` に列挙する。
- **DB コレクション名**: `problems`（Mongoose モデル名は `Problem`）。

**解決策（Solution）／解決案**

- **役割**: 参考情報の一部。他ユーザーから抽出された「解決策・解決の案」の論点。対話の視点ヒントとして、どのような解決策がこのテーマで議論されているかを示す。UI や文脈では「解決案」と呼ぶこともあるが、実装では **Solution モデル** で一貫している。
- **参照元（実装上の取得方法）**:
  - **モデル**: `idea-discussion/backend/models/Solution.js`。スキーマの主なフィールドは **`statement`**（解決策の具体的な内容、String, required）, **`themeId`**（所属テーマの ObjectId）, `sourceOriginId`, `sourceType`, `version` など。参考情報としてプロンプトに渡すのは **`statement`**。
  - **問い単位のとき**: `chatController.js` 内で、`QuestionLink.aggregate` により取得。条件は `questionId: question._id`, `linkedItemType: "solution"`, `linkType: "answers_question"`, **`relevanceScore: { $gte: 0.8 }`**。`$lookup` で `solutions` コレクションと結合し、`themeId` が当該テーマのものだけを採用。関連度の高い順に最大15件。問いに「関連性の高い解決策」として紐づけて `referenceOpinions` に追記する。
  - **テーマ単位のとき**: `getQualityOpinionsForChat(themeId, 10)` の返り値の `solutions`。内部では `dailyBatchProcessor.js` で、QuestionLink の `linkedItemType === "solution"` について同様に品質スコアでソートし、上位 limit 件の ID で **`Solution.find({ _id: { $in: selectedSolutionIds } })`** を実行して返す。chatController では返却された `qualitySolutions` の各要素の `statement` を「関連性の高い解決策」として `referenceOpinions` に列挙する。
- **DB コレクション名**: `solutions`（Mongoose モデル名は `Solution`）。

**問い（SharpQuestion）**

- **役割**: 参考情報の軸。テーマ内で議論されている「シャープな問い」（HMW 形式など）。課題・解決策はこの問いと **QuestionLink** で関連づけられている。
- **参照元**: **モデル**は `idea-discussion/backend/models/SharpQuestion.js`。主なフィールドは **`questionText`**, **`tagLine`**, **`tags`**, **`themeId`**。問い単位のときは `SharpQuestion.findById(questionId)`、テーマ単位のときは `SharpQuestion.find({ themeId }).lean()` で一覧取得。**QuestionLink** は `idea-discussion/backend/models/QuestionLink.js` で定義。`questionId`（SharpQuestion の _id）, `linkedItemId`（Problem または Solution の _id）, `linkedItemType`（"problem" | "solution"）, `linkType`（"prompts_question" | "answers_question"）, **`relevanceScore`** を持つ。課題・解決策を「どの問いにどの関連度で紐づくか」で選ぶときに使う。

---

#### 8.6.4 アウトプットの形（AI の返答の形）

ここでの「アウトプット」は、**AI がユーザーに返す1回のメッセージの形**を指す。

- **推奨**: **「受け止め＋質問」で、全体で 4 行（4 文）程度**
  - 1〜2文: 受け止め（共感・要約の一言）。尋問にならないように必須。
  - 1〜2文: 質問（1問、多くて2問）。長文の質問は避ける。
- **改行**: 受け止めと質問のあいだに 1 行空けると、ユーザーには読みやすい。「4行ぐらい」は、この 2 ブロックで 2〜4 行という意味でよい。
- **プロンプトへの書き方**: ルールに「1回の返答は、短い受け止め（1〜2文）＋質問（1〜2問）で、全体で4文以内。必要なら受け止めと質問のあいだで改行する。」と明示する。

---

#### 8.6.5 【実装用メタプロンプト】8.6.3・8.6.4 準拠の実装指示（ChatGPT 用）

**用途**: このブロックを ChatGPT 等に渡し、8.6.3（データ仕様）と 8.6.4（返答形式）に基づく実装や回答を**最速で**生成させる。人間の可読性より LLM の解釈速度を優先した圧縮仕様。

```
[TASK] chatController.js で【テーマ】と【参考情報】を組み立て、対話AIの systemPrompt と合わせて LLM に渡す実装を行え。返答は受け止め+質問で4文以内。

[DATA: テーマ]
src: req.params.themeId → Theme.findById(themeId) → theme.title [, theme.description]
file: idea-discussion/backend/controllers/chatController.js (handleNewMessageByTheme)
out: 1行。「【テーマ】」+ theme.title [ + "："+ theme.description ]. 参考情報ブロック直前に挿入。

[DATA: 参考情報] referenceOpinions 組み立て
branch: (context==="question" && questionId) ? 問い単位 : テーマ単位

問い単位:
  Q: SharpQuestion.findById(questionId). questionText, tagLine を出し「問い:」「概要:」で referenceOpinions に追加。
  P: QuestionLink.aggregate $match: { questionId: question._id, linkedItemType:"problem", linkType:"prompts_question", relevanceScore:{$gte:0.8} } $lookup problems, themeId===themeId, sort relevanceScore desc, limit 15. 各 statement を「この問いに関連性の高い課題」として追加。
  S: 同様 linkedItemType:"solution", linkType:"answers_question", relevanceScore>=0.8, $lookup solutions, limit 15. 「関連性の高い解決策」として statement 追加。

テーマ単位(推奨: 問いごとブロック):
  Q一覧: SharpQuestion.find({ themeId }).lean(). 各 q に対し
  P,S: QuestionLink で questionId in questionIds, relevanceScore>=0.8 で aggregate, $lookup problems/solutions, themeId 一致. 問いごとに「問い: q.questionText」「関連する課題: ・statement…」「関連する解決策: ・statement…」のブロックを referenceOpinions に追加.
  (現行代替) getQualityOpinionsForChat(themeId,10) → qualityProblems, qualitySolutions の statement を「関連性の高い課題」「関連性の高い解決策」として列挙。問いとの対応は出さない。

モデル/コレクション: Theme(Theme.js), SharpQuestion(SharpQuestion.js), Problem(Problem.js), Solution(Solution.js), QuestionLink(QuestionLink.js). Problem/Solution の参照用フィールドは statement, themeId.

[OUTPUT: 対話AIの1回の返答]
format: [受け止め 1〜2文]\n\n[質問 1〜2問]. 全体で4文以内. 尋問にしない.

[FILES]
chatController: idea-discussion/backend/controllers/chatController.js
dailyBatchProcessor: idea-discussion/backend/workers/dailyBatchProcessor.js (getQualityOpinionsForChat)
models: idea-discussion/backend/models/{Theme,SharpQuestion,Problem,Solution,QuestionLink}.js
```
