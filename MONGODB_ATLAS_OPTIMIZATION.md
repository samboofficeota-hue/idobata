# MongoDB Atlas 最適化ガイド

## Cloud Build中に確認・修正できるMongoDB Atlas設定

### 1. ネットワークアクセス設定（最重要）

**確認場所**: MongoDB Atlas → Network Access

#### 推奨設定

1. **IPホワイトリストの確認**
   - Cloud RunのIPアドレスが許可されているか確認
   - **推奨**: `0.0.0.0/0` を一時的に許可（本番環境では特定IPに制限）
   - Cloud Runは動的IPを使用するため、すべてのIPを許可する必要がある場合があります

2. **Private Endpointの設定（オプション、推奨）**
   - Google Cloud VPCとMongoDB Atlas間のプライベート接続
   - より高速で安定した接続
   - セキュリティも向上

**設定手順**:
1. MongoDB Atlas → Network Access → Private Endpoint
2. "Add Private Endpoint" をクリック
3. Google Cloudプロジェクトを選択
4. リージョン: `asia-northeast1` (Tokyo) を選択

### 2. 接続文字列の最適化

**確認場所**: MongoDB Atlas → Database → Connect → Drivers

現在のコードでは接続オプションを設定していますが、接続文字列自体にも最適化オプションを追加できます。

#### 推奨される接続文字列パラメータ

```
mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority&srvMaxHosts=3&maxPoolSize=10&minPoolSize=2&maxIdleTimeMS=60000
```

**パラメータ説明**:
- `srvMaxHosts=3`: SRVレコードから返されるホスト数を制限（接続オーバーヘッドを削減）
- `maxPoolSize=10`: 最大接続プールサイズ（コード側でも設定済み）
- `minPoolSize=2`: 最小接続プールサイズ（コード側でも設定済み）
- `maxIdleTimeMS=60000`: アイドル接続を60秒後に閉じる

**注意**: コード側（`server.js`）で既に設定している場合は、接続文字列のパラメータと重複しないように注意してください。

### 3. クラスターのリージョン確認

**確認場所**: MongoDB Atlas → Database → Clusters

#### 確認事項

1. **クラスターのリージョン**
   - Cloud Runが `asia-northeast1` (Tokyo) で動作している場合
   - MongoDB Atlasも `Asia Pacific (Tokyo)` または近いリージョンに配置することを推奨
   - リージョンが遠いと、接続に時間がかかります

2. **クラスターのタイプ**
   - **M0 (Free tier)**: 接続数制限あり（最大500接続）
   - **M10以上**: より多くの接続とリソース

**リージョン変更手順**（必要に応じて）:
1. MongoDB Atlas → Database → Clusters
2. クラスター名をクリック
3. "Edit Configuration" → "Cloud Provider & Region"
4. リージョンを `Asia Pacific (Tokyo)` に変更

### 4. 接続プールの監視

**確認場所**: MongoDB Atlas → Metrics → Connections

#### 監視すべきメトリクス

1. **Current Connections**: 現在の接続数
2. **Available Connections**: 利用可能な接続数
3. **Connection Pool Wait Time**: 接続プールの待機時間

#### 最適化のヒント

- 接続数が上限に近い場合: クラスターをアップグレードするか、`maxPoolSize`を減らす
- 待機時間が長い場合: `minPoolSize`を増やすか、クラスターのリソースを増やす

### 5. データベースユーザーの権限確認

**確認場所**: MongoDB Atlas → Database Access

#### 確認事項

1. **認証方法**: Username/Password が正しく設定されているか
2. **データベース権限**: 必要なデータベースへの読み書き権限があるか
3. **ネットワークアクセス**: ユーザーがネットワークアクセスリストからアクセス可能か

### 6. インデックスの最適化（オプション）

**確認場所**: MongoDB Atlas → Database → Collections

#### 確認事項

1. **インデックスの存在**: よく使用されるクエリフィールドにインデックスがあるか
2. **インデックスの使用状況**: Performance Advisorで推奨インデックスを確認

**注意**: インデックスの追加は、データベースのパフォーマンスに影響しますが、起動時の接続タイムアウトには直接関係しません。

### 7. クラスターのパフォーマンス設定

**確認場所**: MongoDB Atlas → Database → Clusters → Configuration

#### 確認事項

1. **Auto-Scaling**: 有効になっているか
2. **Backup**: バックアップ設定（起動には影響しないが、運用上重要）

## 即座に確認すべき項目（優先度: 高）

### ✅ 1. ネットワークアクセス

```
MongoDB Atlas → Network Access
```

- [ ] IPホワイトリストに `0.0.0.0/0` が含まれているか（またはCloud RunのIPが許可されているか）
- [ ] 接続がブロックされていないか

### ✅ 2. クラスターのリージョン

```
MongoDB Atlas → Database → Clusters
```

- [ ] クラスターが `Asia Pacific (Tokyo)` または近いリージョンにあるか
- [ ] Cloud Run (`asia-northeast1`) との距離が近いか

### ✅ 3. 接続文字列の確認

```
MongoDB Atlas → Database → Connect → Drivers
```

- [ ] 接続文字列が正しいか
- [ ] ユーザー名とパスワードが正しいか
- [ ] データベース名が正しいか

### ✅ 4. 接続数の監視

```
MongoDB Atlas → Metrics → Connections
```

- [ ] 接続数が上限に達していないか
- [ ] 異常な接続数の増加がないか

## 接続文字列の最適化例

現在のコードでは以下の設定を使用しています：

```javascript
await mongoose.connect(mongoUri, {
  connectTimeoutMS: 30000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
  heartbeatFrequencyMS: 10000,
});
```

**追加で検討できる最適化**:

1. **`maxIdleTimeMS`を追加**:
   ```javascript
   maxIdleTimeMS: 60000, // 60秒後にアイドル接続を閉じる
   ```

2. **接続文字列に`srvMaxHosts`を追加**:
   ```
   mongodb+srv://...?srvMaxHosts=3&...
   ```

## トラブルシューティング

### 接続タイムアウトが発生する場合

1. **ネットワークアクセスを確認**
   - IPホワイトリストに `0.0.0.0/0` を追加（一時的）
   - または、Cloud RunのIPアドレスを特定して追加

2. **クラスターのリージョンを確認**
   - Cloud Runと同じリージョン（`asia-northeast1`）に配置

3. **接続プールの設定を確認**
   - `maxPoolSize`が大きすぎないか
   - `minPoolSize`が適切か

4. **MongoDB Atlasのログを確認**
   - MongoDB Atlas → Logs で接続エラーを確認

### 接続が不安定な場合

1. **Private Endpointの設定を検討**
   - VPCとMongoDB Atlas間のプライベート接続

2. **クラスターのアップグレードを検討**
   - M0 (Free tier) から M10以上にアップグレード

3. **接続プールの設定を調整**
   - `minPoolSize`を増やす
   - `maxIdleTimeMS`を調整

## 次のステップ

1. **ネットワークアクセスを確認・修正**（最優先）
2. **クラスターのリージョンを確認**
3. **接続文字列に`srvMaxHosts=3`を追加**（オプション）
4. **接続数の監視を開始**

これらの設定を確認・修正することで、Cloud Runからの接続がより高速で安定します。
