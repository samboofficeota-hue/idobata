# いどばた会議室 Google 連携

> 作成日：2026-10-18 ／ ステータス：実装済み。Google Cloud 側の設定と本番での確認はまだ

ホストが自分の Google アカウントをお題ごとに連携すると、次の2つができる。

1. **Google カレンダーに Meet 付きの予定を作る**。Meet の URL は参加者のページ（`/kaigi/:roomId`）と壁（`/kaigi/:roomId/wall`）に表示される
2. **会議のあとで、Meet の文字起こしと録画の場所を取り込む**。ホスト用の画面で読めて、テキストとして保存できる

操作はすべて**ホスト用の画面**（`/kaigi/:roomId/host`）で行う。

---

## 1. しくみ

```
ホスト用の画面 ──(x-kaigi-host-key)──▶ backend ──▶ Google の同意画面
                                         ▲              │
                                         └─ /api/kaigi/google/callback（state と PKCE で照合）
                                                        │
                       リフレッシュトークンを暗号化して保存（KaigiGoogleAccount）
                                                        │
                  Calendar API で予定と Meet を作る ／ Meet REST API で記録を読む
```

- **ホスト用の鍵**：お題を作ると、32バイトの乱数の鍵が1回だけ返る。DB には SHA-256 のハッシュだけを保存する（`KaigiRoom.hostKeyHash`）
  - 作ったブラウザでは localStorage に保存される
  - ほかの端末では「ホスト用のURL」（`/kaigi/:roomId/host#key=...`）から開く。`#` より後ろはサーバーに送られない
- **OAuth**：サーバー側の認可コードフローに PKCE（S256）を使う。`state` は1回だけ使え、10分で消える（`KaigiOAuthState`）
  - ID トークンは検証してから使う
  - アクセストークンはブラウザに渡さない
- **トークンの保存**：リフレッシュトークンを AES-256-GCM で暗号化して `KaigiGoogleAccount` に保存する。鍵は `KAIGI_GOOGLE_TOKEN_KEY`
  - お題と同じ日に自動で削除される（TTL）
  - Google に取り消された場合（`invalid_grant`）は、保存していたトークンを消し、ホストに連携し直してもらう
- **連携の解除**：Google の取り消しは、そのアカウントがこのアプリに出した許可をまとめて無効にする。そのため、同じアカウントで連携している別のお題がなくなったときだけ取り消す
- **記録の保存**：Meet の記録は `KaigiMeetRecord` に保存し、お題と同じ日に自動で削除する
  - 文字起こしはホスト用の鍵がないと読めない

### 要求する権限（スコープ）

| スコープ | 用途 | Google の区分 |
|---|---|---|
| `openid` `email` | 連携したアカウントの表示 | 非機密 |
| `https://www.googleapis.com/auth/calendar.events` | 予定と Meet を作る・日時を変える・削除する | 機密（sensitive） |
| `https://www.googleapis.com/auth/meetings.space.readonly` | 会議の記録・参加者名・文字起こし・録画の場所を読む | 機密（sensitive） |

Drive のスコープは使わない。録画と文字起こしのドキュメントは、Google が返すリンク（ホストのドライブ）を表示するだけにしている。

### API（backend）

| メソッド・パス | 説明 |
|---|---|
| `GET /api/kaigi/rooms/:roomId/host` | 連携の状態と予定 |
| `POST /api/kaigi/rooms/:roomId/host/google/connect` | 同意画面のURLを返す |
| `DELETE /api/kaigi/rooms/:roomId/host/google` | 連携を解除する |
| `PUT /api/kaigi/rooms/:roomId/host/meeting` | `{ startAt, durationMinutes }`。予定と Meet を作る。すでにあれば日時を変える |
| `DELETE /api/kaigi/rooms/:roomId/host/meeting` | 予定を削除する |
| `GET /api/kaigi/rooms/:roomId/host/records` | 取り込み済みの記録 |
| `POST /api/kaigi/rooms/:roomId/host/records/sync` | Meet から取り込む |
| `GET /api/kaigi/google/callback` | 同意画面から戻る先（ホスト用の鍵は不要） |

`/host` 以下は、すべてヘッダー `x-kaigi-host-key` が必要。

---

## 2. Google Cloud Console の設定

1. プロジェクトを選ぶ（いどばたと同じ GCP プロジェクトでよい）
2. **API を有効にする**：「API とサービス」→「ライブラリ」で次の2つ
   - Google Calendar API
   - Google Meet REST API
3. **OAuth 同意画面**（Google Auth Platform → ブランディング／対象／データアクセス）
   - ユーザーの種類：外部（Workspace の組織内だけで使うなら内部）
   - アプリ名、サポートメール、ホームページ、プライバシーポリシーの URL
   - 承認済みドメイン：`sambo-office.com` など、フロントと backend のドメイン
   - データアクセスに、上の表の 2 つの機密スコープを追加する
   - 公開ステータスが「テスト中」の間は、テストユーザーに登録したアカウントだけが連携できる。リフレッシュトークンも7日で切れる
4. **OAuth クライアント ID を作る**（種類：ウェブアプリケーション）
   - 承認済みのリダイレクト URI（環境ごとに完全一致で登録する）
     - 本番：`https://<backend のドメイン>/api/kaigi/google/callback`
     - 開発：`http://localhost:3000/api/kaigi/google/callback`
   - JavaScript 生成元は不要（ブラウザから Google を直接呼ばないため）
5. **本番公開の前に、アプリの確認（verification）を申請する**
   - 機密スコープを外部ユーザーに使ってもらうには、Google の確認が必要
   - 必要なもの：ドメインの所有確認、プライバシーポリシー、スコープの用途の説明と操作の動画
   - 確認が終わるまでは「テスト中」のまま、テストユーザーで運用する

## 3. backend の環境変数

| 変数 | 内容 |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 手順4のクライアント |
| `KAIGI_GOOGLE_REDIRECT_URI` | 手順4で登録したリダイレクト URI と同じ値 |
| `KAIGI_GOOGLE_TOKEN_KEY` | 32バイトを base64 にした値。`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `KAIGI_FRONTEND_URL` | 連携のあとに戻る利用者向けサイト（例：`https://idobata.sambo-office.com`） |

- シークレット（クライアントシークレット・暗号化キー）は Secret Manager か Railway の変数に入れ、リポジトリには置かない
- 4つがそろわないと Google 連携は無効になり、ホスト用の画面に「準備中」と表示される
- `KAIGI_GOOGLE_TOKEN_KEY` を変えると、連携済みのお題はすべて連携し直しになる

## 4. 使うときの注意

- **文字起こしと録画には条件がある**
  - Google Workspace の対応エディションでのみ使える（個人の Gmail アカウントでは作られない）
  - 会議中に、主催者が Meet で「文字起こし」「録画」を開始しておく必要がある
  - 会議が終わってから、Google 側でファイルができるまで数分から数十分かかる。それまでは「Meet から取り込む」を押しても何も入らないか、「開催中」と表示される
- **参加者の招待**：予定はホストのカレンダーに作るだけで、招待メールは送らない（`sendUpdates=none`）。参加者への案内は、お題の URL か、カレンダーから招待する
- **Meet の入室**：Meet の入室の設定（ノックが必要か、など）は、ホストのアカウントの既定に従う
- **このしくみを入れる前に作ったお題**：ホスト用の鍵がないので、ホスト用の画面を使えない。必要なら、お題を作り直す

## 5. まだやっていないこと

- 文字起こしを壁や AI の要約に使う（今は取り込んで読む・保存するだけ）
- 会議が終わったら自動で取り込む（Google Workspace Events API で通知を受け取る）
- ホストのログイン（今は、お題を作るパスワードとお題ごとの鍵だけ）
