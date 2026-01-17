# PolicyDraftの存在確認方法

## 確認方法

### 1. APIエンドポイントで確認（推奨）

**エンドポイント:**
```
GET /api/themes/:themeId/policy-drafts
```

**実装:**
- `idea-discussion/backend/controllers/policyController.js`の`getPolicyDraftsByTheme`
- テーマ内のすべての質問に関連する`PolicyDraft`を取得

**使用例:**
```bash
# テーマIDを指定してPolicyDraftを取得
curl http://localhost:3000/api/themes/{themeId}/policy-drafts
```

**レスポンス:**
```json
[
  {
    "_id": "...",
    "questionId": "...",
    "title": "政策ドラフトのタイトル",
    "content": "政策ドラフトの内容",
    "createdAt": "2024-01-01T00:00:00.000Z",
    ...
  }
]
```

### 2. 管理画面のダウンロード出力で確認

**エンドポイント:**
```
GET /api/themes/:themeId/download-output
```

**実装:**
- `idea-discussion/backend/controllers/adminController.js`の`getDownloadOutput`
- 各質問の`policyDraft`情報を含む

**レスポンス構造:**
```json
{
  "theme": {...},
  "questions": [
    {
      "id": "...",
      "questionText": "...",
      "policyDraft": {
        "title": "...",
        "content": "...",
        "createdAt": "..."
      }  // ⭐ ここにPolicyDraftの情報が含まれる
    }
  ]
}
```

### 3. データベースで直接確認

**MongoDBで直接確認:**
```javascript
// MongoDBシェルまたはMongoDB Compassで実行
use your_database_name

// すべてのPolicyDraftを確認
db.policydrafts.find().pretty()

// 特定の質問に関連するPolicyDraftを確認
db.policydrafts.find({ questionId: ObjectId("...") }).pretty()

// PolicyDraftの数を確認
db.policydrafts.countDocuments()

// 質問IDごとのPolicyDraft数を確認
db.policydrafts.aggregate([
  {
    $group: {
      _id: "$questionId",
      count: { $sum: 1 }
    }
  }
])
```

### 4. バックエンドのログで確認

**生成処理のログ:**
- `generatePolicyDraft`が実行されると、以下のログが出力される：
  ```
  [PolicyGenerator] Starting policy draft generation for questionId: ...
  [PolicyGenerator] Found question: "..."
  [PolicyGenerator] Successfully saved policy draft with ID: ...
  ```

**確認方法:**
- バックエンドのコンソールログを確認
- または、ログファイルを確認

### 5. フロントエンドのAPIクライアントで確認

**フロントエンドのコード:**
```typescript
// frontend/src/services/api/apiClient.ts
async getPolicyDraftsByTheme(themeId: string): Promise<HttpResult<PolicyDraft[]>> {
  return this.httpClient.get<PolicyDraft[]>(`/themes/${themeId}/policy-drafts`);
}
```

**ブラウザの開発者ツールで確認:**
1. ブラウザの開発者ツールを開く（F12）
2. Networkタブを開く
3. ページをリロード
4. `/api/themes/{themeId}/policy-drafts`のリクエストを探す
5. レスポンスを確認

## 確認すべきポイント

### 1. PolicyDraftが存在するか
- APIレスポンスに`PolicyDraft`のデータが含まれているか
- データベースに`PolicyDraft`が保存されているか

### 2. 質問との関連
- 各質問（SharpQuestion）に対して`PolicyDraft`が存在するか
- `questionId`が正しく関連付けられているか

### 3. 生成のタイミング
- `PolicyDraft`がいつ生成されたか（`createdAt`フィールド）
- 最新の`PolicyDraft`が取得されているか

## トラブルシューティング

### PolicyDraftが存在しない場合

**原因:**
1. `PolicyDraft`がまだ生成されていない
2. 生成処理が失敗した
3. データベースの接続に問題がある

**対処法:**
1. 管理画面で「政策ドラフト生成」ボタンを押す
2. バックエンドのログでエラーを確認
3. データベースの接続を確認

### PolicyDraftが存在するがDigestDraftが生成されない場合

**原因:**
1. `DigestDraft`の生成処理で`PolicyDraft`が見つからない
2. `questionId`の型が一致していない

**対処法:**
1. `DigestDraft`の生成処理のログを確認
2. `questionId`の型変換を確認

## 確認用スクリプト（Node.js）

```javascript
// checkPolicyDrafts.js
const mongoose = require('mongoose');
const PolicyDraft = require('./models/PolicyDraft');
const SharpQuestion = require('./models/SharpQuestion');

async function checkPolicyDrafts() {
  await mongoose.connect('mongodb://localhost:27017/your_database');
  
  // すべての質問を取得
  const questions = await SharpQuestion.find({});
  
  console.log(`Total questions: ${questions.length}`);
  
  // 各質問に対してPolicyDraftの存在を確認
  for (const question of questions) {
    const policyDraft = await PolicyDraft.findOne({ 
      questionId: question._id 
    }).sort({ createdAt: -1 });
    
    if (policyDraft) {
      console.log(`✓ Question "${question.questionText}" has PolicyDraft`);
    } else {
      console.log(`✗ Question "${question.questionText}" has NO PolicyDraft`);
    }
  }
  
  await mongoose.disconnect();
}

checkPolicyDrafts();
```
