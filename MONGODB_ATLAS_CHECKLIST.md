# MongoDB Atlas 確認チェックリスト

## Cloud Build中に確認すべき項目

### 🔴 最優先（必須）

#### 1. ネットワークアクセス設定
**場所**: MongoDB Atlas → Network Access

- [ ] **IPホワイトリストを確認**
  - `0.0.0.0/0` が許可されているか確認
  - または、Cloud RunのIPアドレスが許可されているか確認
  - **アクション**: 許可されていない場合は追加

**手順**:
1. MongoDB Atlasにログイン
2. 左メニューから「Network Access」を選択
3. 「IP Access List」タブを確認
4. `0.0.0.0/0` が含まれているか確認
5. 含まれていない場合は「Add IP Address」をクリックして追加

#### 2. クラスターのリージョン確認
**場所**: MongoDB Atlas → Database → Clusters

- [ ] **クラスターのリージョンが適切か確認**
  - Cloud Runは `asia-northeast1` (Tokyo) で動作
  - MongoDB Atlasも `Asia Pacific (Tokyo)` または近いリージョンが推奨
  - **アクション**: リージョンが遠い場合は移行を検討（時間がかかるため後回しでも可）

**確認方法**:
1. MongoDB Atlas → Database → Clusters
2. クラスター名をクリック
3. 「Configuration」タブでリージョンを確認

### 🟡 重要（推奨）

#### 3. 接続文字列の確認
**場所**: MongoDB Atlas → Database → Connect → Drivers

- [ ] **接続文字列が正しいか確認**
  - ユーザー名とパスワードが正しいか
  - データベース名が正しいか
  - **アクション**: 必要に応じて接続文字列を再生成

**最適化オプション**:
接続文字列に以下のパラメータを追加することを検討：
```
?srvMaxHosts=3&maxPoolSize=10&minPoolSize=2&maxIdleTimeMS=60000
```

**注意**: コード側（`server.js`）で既に設定している場合は、接続文字列のパラメータと重複しないように注意。

#### 4. 接続数の監視
**場所**: MongoDB Atlas → Metrics → Connections

- [ ] **接続数が上限に達していないか確認**
  - M0 (Free tier): 最大500接続
  - M10以上: より多くの接続が可能
  - **アクション**: 接続数が上限に近い場合はクラスターをアップグレード

**確認方法**:
1. MongoDB Atlas → Metrics
2. 「Connections」タブを選択
3. 「Current Connections」と「Available Connections」を確認

### 🟢 オプション（時間がある場合）

#### 5. データベースユーザーの権限確認
**場所**: MongoDB Atlas → Database Access

- [ ] **ユーザーの権限が適切か確認**
  - 必要なデータベースへの読み書き権限があるか
  - **アクション**: 権限が不足している場合は修正

#### 6. Private Endpointの設定（高度）
**場所**: MongoDB Atlas → Network Access → Private Endpoint

- [ ] **Private Endpointの設定を検討**
  - Google Cloud VPCとMongoDB Atlas間のプライベート接続
  - より高速で安定した接続
  - **アクション**: 設定には時間がかかるため、後回しでも可

## 即座に実行すべきアクション

### ステップ1: ネットワークアクセスを確認・修正（5分）

1. MongoDB Atlasにログイン: https://cloud.mongodb.com
2. 「Network Access」を選択
3. 「IP Access List」を確認
4. `0.0.0.0/0` が含まれていない場合は追加

### ステップ2: クラスターのリージョンを確認（2分）

1. 「Database」→「Clusters」を選択
2. クラスター名をクリック
3. リージョンが `Asia Pacific (Tokyo)` または近いリージョンか確認

### ステップ3: 接続数の監視を開始（1分）

1. 「Metrics」→「Connections」を選択
2. 接続数が正常範囲内か確認

## よくある問題と解決方法

### 問題1: 接続タイムアウト

**原因**: IPホワイトリストにCloud RunのIPが含まれていない

**解決方法**:
- Network Access → IP Access List に `0.0.0.0/0` を追加

### 問題2: 接続が遅い

**原因**: クラスターのリージョンが遠い

**解決方法**:
- クラスターを `Asia Pacific (Tokyo)` に移行（時間がかかる）

### 問題3: 接続数が上限に達している

**原因**: クラスターの接続数制限

**解決方法**:
- クラスターをアップグレード（M0 → M10以上）
- または、`maxPoolSize`を減らす

## 確認後の次のステップ

1. ✅ ネットワークアクセスを確認・修正
2. ✅ クラスターのリージョンを確認
3. ⏳ Cloud Buildの完了を待つ
4. ⏳ デプロイ後に接続をテスト
5. ⏳ 必要に応じて追加の最適化を実施

## 参考リンク

- [MongoDB Atlas Network Access](https://cloud.mongodb.com/v2/68bd031d1aa563719788dfab#/security/network/whitelist)
- [MongoDB Atlas Connection String](https://cloud.mongodb.com/v2/68bd031d1aa563719788dfab#/clusters/connect)
- [MongoDB Atlas Metrics](https://cloud.mongodb.com/v2/68bd031d1aa563719788dfab#/metrics)
