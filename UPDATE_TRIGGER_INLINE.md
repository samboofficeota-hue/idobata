# インライン設定を修正する方法

## 現在の問題

インライン設定で`-f Dockerfile`となっており、ルートディレクトリの`Dockerfile`を探しています。

## 修正方法

### Buildステップを修正

現在の設定：
```yaml
- name: gcr.io/cloud-builders/docker
  args:
    - build
    - '--no-cache'
    - '-t'
    - >-
      $_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$REPO_NAME/$_SERVICE_NAME:$COMMIT_SHA
    - .
    - '-f'
    - Dockerfile
```

**修正後**：
```yaml
- name: gcr.io/cloud-builders/docker
  args:
    - build
    - '--no-cache'
    - '-t'
    - >-
      $_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$REPO_NAME/$_SERVICE_NAME:$COMMIT_SHA
    - '-f'
    - idea-discussion/backend/Dockerfile
    - '--target'
    - production
    - .
```

### 変更点

1. `-f Dockerfile` → `-f idea-discussion/backend/Dockerfile` に変更
2. `--target production` を追加（Dockerfileがマルチステージビルドの場合）
3. 引数の順序を調整（`-f`の後にパス、最後に`.`）

## 手順

1. Cloud Buildトリガーの編集画面で
2. **Configuration**セクションを開く
3. **Inline**が選択されている場合、上記の修正を適用
4. または、**Cloud Build configuration file**を選択して`cloudbuild-backend.yaml`を指定（推奨）
