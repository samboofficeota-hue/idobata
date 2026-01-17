# PolicyDraftとDigestDraftの関係

## 概要

`PolicyDraft`（政策ドラフト）と`DigestDraft`（意見まとめ/ダイジェスト）は、**親子関係**にあります。

```
PolicyDraft（親）
  ↓ 依存関係
DigestDraft（子）
```

## データモデルの関係

### PolicyDraft（政策ドラフト）

**モデル構造:**
```javascript
{
  questionId: ObjectId,        // 対象の質問ID
  title: String,               // タイトル
  content: String,             // 本文（約14,000文字）
  sourceProblemIds: [ObjectId], // 参考にした問題点
  sourceSolutionIds: [ObjectId], // 参考にした解決策
  version: Number              // バージョン番号
}
```

**特徴:**
- 質問（SharpQuestion）に関連する問題点（Problem）と解決策（Solution）から生成
- 専門的な政策文書
- 約14,000文字の長文
- ビジョンレポート + 解決手段レポートの2部構成

### DigestDraft（意見まとめ/ダイジェスト）

**モデル構造:**
```javascript
{
  questionId: ObjectId,            // 対象の質問ID
  policyDraftId: ObjectId,        // ⭐ 元となるPolicyDraftのID（必須）
  title: String,                  // タイトル
  content: String,                // 本文（約4,700文字 = 元の1/3）
  sourceProblemIds: [ObjectId],   // 参考にした問題点
  sourceSolutionIds: [ObjectId],  // 参考にした解決策
  version: Number                 // バージョン番号
}
```

**特徴:**
- **`policyDraftId`フィールドで`PolicyDraft`への参照を持つ**（必須）
- `PolicyDraft`を基に生成される
- 一般市民向けに読みやすく噛み砕いた内容
- `PolicyDraft`の約1/3の長さ（約4,700文字）

## 生成プロセスの関係

### 1. PolicyDraftの生成

**生成元:**
- 質問（SharpQuestion）
- 関連する問題点（Problem）
- 関連する解決策（Solution）

**生成処理:**
```javascript
generatePolicyDraft(questionId)
  → PolicyDraftを生成・保存
```

**結果:**
- 専門的な政策文書が生成される
- データベースに`PolicyDraft`が保存される

### 2. DigestDraftの生成

**生成元:**
- 質問（SharpQuestion）
- 関連する問題点（Problem）
- 関連する解決策（Solution）
- **⭐ PolicyDraft（必須）**

**生成処理:**
```javascript
generateDigestDraft(questionId)
  → PolicyDraftを検索（必須）
  → PolicyDraftが見つからない場合、処理を中断
  → PolicyDraftが見つかった場合、それを基にDigestDraftを生成
  → DigestDraftを保存（policyDraftIdを設定）
```

**重要なポイント:**
- `PolicyDraft`が存在しない場合、`DigestDraft`は生成されない
- `DigestDraft`の`policyDraftId`フィールドに、元となった`PolicyDraft`のIDが保存される

## 生成フロー図

```
1. 質問（SharpQuestion）が存在
   ↓
2. 関連する問題点・解決策を収集
   ↓
3. PolicyDraftを生成
   ├─ 専門的な政策文書（約14,000文字）
   └─ データベースに保存
   ↓
4. DigestDraftを生成（PolicyDraftが必要）
   ├─ PolicyDraftを検索
   ├─ PolicyDraftが見つからない → 処理中断
   ├─ PolicyDraftが見つかった → それを基に生成
   ├─ 一般市民向けのダイジェスト（約4,700文字）
   └─ データベースに保存（policyDraftIdを設定）
```

## 依存関係の詳細

### DigestDraftがPolicyDraftに依存する理由

**コードから見る依存関係:**
```javascript
// digestGenerator.js (68-79行目)
const latestPolicyDraft = await PolicyDraft.findOne({
  questionId: questionId,
})
  .sort({ createdAt: -1 })
  .limit(1);

if (!latestPolicyDraft) {
  console.error(
    `[DigestGenerator] No policy draft found for questionId: ${questionId}`
  );
  return; // ⭐ PolicyDraftがない場合、処理を中断
}
```

**LLMへのプロンプト:**
```javascript
// digestGenerator.js (117-131行目)
content: `Generate a digest for the following:

Question: ${question.questionText}

Related Problems: ...
Related Solutions: ...

Policy Report:                    // ⭐ PolicyDraftの内容を使用
Title: ${latestPolicyDraft.title}
Content: ${latestPolicyDraft.content}

Please provide the output as a JSON object with "title" and "content" keys. 
The digest should be much more accessible to general readers than the policy report.`
```

**保存時の参照:**
```javascript
// digestGenerator.js (157-165行目)
const newDraft = new DigestDraft({
  questionId: questionId,
  policyDraftId: latestPolicyDraft._id,  // ⭐ PolicyDraftのIDを保存
  title: llmResponse.title,
  content: llmResponse.content,
  ...
});
```

## 用途の違い

### PolicyDraft（政策ドラフト）
- **対象読者:** 政策立案者、専門家
- **内容:** 詳細な分析、専門用語、複雑なトレードオフ
- **長さ:** 約14,000文字
- **用途:** 政策の詳細な検討、意思決定の参考

### DigestDraft（意見まとめ）
- **対象読者:** 一般市民
- **内容:** 平易な表現、重要なポイントの強調、全体像の伝達
- **長さ:** 約4,700文字（PolicyDraftの約1/3）
- **用途:** 市民への情報提供、理解促進

## まとめ

1. **`DigestDraft`は`PolicyDraft`に依存している**
   - `PolicyDraft`が存在しない場合、`DigestDraft`は生成されない
   - `DigestDraft`の`policyDraftId`フィールドで`PolicyDraft`を参照

2. **生成順序が重要**
   - まず`PolicyDraft`を生成する必要がある
   - その後、`DigestDraft`を生成できる

3. **用途が異なる**
   - `PolicyDraft`: 専門家向けの詳細な政策文書
   - `DigestDraft`: 一般市民向けの読みやすいダイジェスト

4. **「意見まとめが表示されない」原因**
   - `PolicyDraft`が存在しないため、`DigestDraft`が生成されていない可能性が高い
