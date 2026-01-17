# GitHubリポジトリのPolicyDraftデータについて

## 結論

**GitHubの親リポジトリ（digitaldemocracy2030/idobata）には、PolicyDraftの実際のデータは含まれていません。**

## 確認結果

### 1. リポジトリに含まれているもの

✅ **PolicyDraftのモデル定義（スキーマ）**
- `idea-discussion/backend/models/PolicyDraft.js`
- データベースの構造定義

✅ **PolicyDraftを生成するコード**
- `idea-discussion/backend/workers/policyGenerator.js`
- `idea-discussion/backend/controllers/policyController.js`
- PolicyDraftを生成・取得する処理

✅ **サンプルデータスクリプト（一部）**
- `idea-discussion/backend/scripts/addSampleQuestions.js`
- ただし、これは`SharpQuestion`（シャープな問い）のサンプルデータのみ
- PolicyDraftのサンプルデータは含まれていない

### 2. リポジトリに含まれていないもの

❌ **PolicyDraftの実際のデータ**
- データベースに保存されているPolicyDraftのレコード
- シードデータやサンプルデータ

❌ **DigestDraftの実際のデータ**
- 同様に、DigestDraftのレコードも含まれていない

❌ **その他のデータベースデータ**
- Problem、Solution、DebateAnalysisなども含まれていない

## 理由

これは一般的なOSSプロジェクトの構造です：

1. **ソースコードは公開される**
   - モデル定義、コントローラー、ルートなど
   - データを生成・操作するコード

2. **データベースのデータは公開されない**
   - 実際のデータは実行時に生成される
   - または、ユーザーが自分で生成する必要がある
   - プライバシーやセキュリティの観点から、実際のデータは含めない

3. **シードデータは任意**
   - 開発・テスト用のサンプルデータは、必要に応じてスクリプトとして提供される
   - ただし、PolicyDraftのシードデータは現在提供されていない

## PolicyDraftを取得する方法

### 1. 自分で生成する（推奨）

**管理画面から生成:**
- 管理画面で「政策ドラフト生成」ボタンを押す
- または、APIエンドポイントを直接呼び出す：
  ```
  POST /api/themes/:themeId/questions/:questionId/generate-policy
  ```

**生成の前提条件:**
- 質問（SharpQuestion）が存在する
- その質問に関連する問題点（Problem）と解決策（Solution）が存在する

### 2. データベースから直接確認

**MongoDBで確認:**
```javascript
// すべてのPolicyDraftを確認
db.policydrafts.find().pretty()

// 特定の質問に関連するPolicyDraftを確認
db.policydrafts.find({ questionId: ObjectId("...") }).pretty()
```

### 3. APIエンドポイントで確認

**エンドポイント:**
```
GET /api/themes/:themeId/policy-drafts
```

**レスポンス:**
- PolicyDraftが存在する場合、配列で返される
- 存在しない場合、空の配列`[]`が返される

## まとめ

- **GitHubリポジトリにはPolicyDraftのデータは含まれていない**
- **PolicyDraftは実行時に生成される必要がある**
- **生成には、質問と関連する問題点・解決策が必要**
- **管理画面やAPIから生成できる**

現在「意見まとめが表示されない」問題は、PolicyDraftが存在しないため、DigestDraftが生成されていないことが原因の可能性が高いです。
