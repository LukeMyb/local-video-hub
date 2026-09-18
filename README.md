# Local Video Hub

ローカルの動画ファイルを管理・閲覧し、AIによる自動タグ付けを行うための統合ツールセットです。動画ギャラリーを閲覧するWebクライアント（Client）、自動ダウンロードを行うバックエンドAPI（Server）、動画にタグを付与するAIスクリプト（Tagger）で構成されています。

## 特徴 (Features)

- **バックエンドAPI (`server/`)**
  - FastAPIと `yt-dlp` を用いたバックグラウンド動画ダウンロード機能。
  - iOSショートカットと連携し、スマホ（Xなど）からワンタップでPCへ動画を保存可能。
  - APIキー認証によるセキュアなローカルネットワーク公開。
- **Webクライアント (`client/`)**
  - React + Vite 構成の高速なフロントエンド。
  - Tailwind CSS を用いたモダンなUI、PWA (Progressive Web App) 対応。
  - プレイヤー画面から動画を「ゴミ箱 (trash)」へ移動する論理削除機能と、元に戻す復元機能を搭載。Jellyfinのライブラリスキャンとも自動連動。
- **AI動画タガー (`tagger/`)**
  - 動画 (`.mp4`) から自動的に複数フレームを抽出し、画像認識AIによってタグを生成。
  - JellyfinやKodiで読み込み可能な `.nfo` ファイルにタグ情報を自動追記。

---

## ディレクトリ構成

```text
local-video-hub/
├── .env                        # APIキーなど環境変数
├── README.md                   # このドキュメント
├── requirements.txt            # Pythonの依存関係
├── start_local-video-hub.vbs   # 起動用スクリプト
├── bin/
│   └── ffmpeg.exe              # 動画処理用バイナリ
├── client/                     # Webクライアント (React/Vite)
│   ├── src/                    # フロントエンドのソースコード
│   │   ├── api/                # API通信用関数
│   │   ├── assets/             # 静的アセット
│   │   ├── components/         # UIコンポーネント
│   │   ├── hooks/              # カスタムフック
│   │   ├── pages/              # ページコンポーネント (Home.jsx, Player.jsx等)
│   │   ├── utils/              # ユーティリティ関数
│   │   ├── App.jsx             # アプリケーションのルート
│   │   └── main.jsx            # Reactエントリポイント
│   ├── package.json            # Node.jsパッケージ設定
│   └── vite.config.js          # Vite設定
├── config/
│   └── x.com_cookies.txt       # 動画ダウンロード用Cookie
├── downloads/                  # 動画の保存先
│   └── inbox/                  # 自動ダウンロードされた動画の初期保存先
├── server/                     # バックエンドAPI (FastAPI)
│   └── main.py                 # APIサーバーのメインスクリプト
└── tagger/                     # AI動画タグ生成ツール
    └── tagger.py               # タグ抽出・NFO更新スクリプト
```

- `client/` : ビデオギャラリーを表示するためのReact/Viteアプリケーション。
- `server/` : 動画ダウンロードリクエストを受け付けるFastAPIバックエンド。
- `tagger/` : 動画からタグを抽出し、`.nfo` ファイルを編集するPythonスクリプト。
- `bin/` : 外部バイナリファイル（`ffmpeg.exe` 等）の配置場所。
- `config/` : 設定ファイル（`x.com_cookies.txt` 等）の配置場所。
- `downloads/inbox/` : ダウンロードされた動画の初期保存先。
- `start_local-video-hub.vbs` : フロントエンドとバックエンドを同時にバックグラウンド起動するスクリプト。

---

## セットアップ

### 1. 全体設定とバックエンド (`server/`)

#### 必要な環境・ファイル
- Python 3.10以上
- `ffmpeg.exe` (動画と音声の結合に使用。`bin/` ディレクトリ内に配置してください)
- `x.com_cookies.txt` (Xの動画保存用。`config/` ディレクトリ内に配置してください)

#### インストールと環境設定
1. プロジェクトルートに `.env` ファイルを作成し、APIキーを設定します。
   ```text
   API_KEY=your_secret_key_here
   ```
2. Pythonの仮想環境を作成し、有効化します。（起動スクリプトが `.venv` を使用するため）
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```
3. Pythonの依存関係をインストールします。
   ```bash
   pip install -r requirements.txt
   ```

### 2. Web Client (`client/`)

#### 必要な環境
- Node.js (v18 以上推奨)

#### インストールとビルド
```bash
cd client
npm install
npm run build
```

---

## 使い方 (Usage)

### 1. システムの起動
プロジェクトルートにある `start_local-video-hub.vbs` をダブルクリックします。
バックグラウンドで自動的に以下の2つが起動します。
- Webクライアント (ポート: 3096)
- ダウンロードAPI (ポート: 9096)

#### PC起動時に自動実行する場合（スタートアップ登録）
毎回手動で起動するのが手間の場合は、以下の手順でWindowsのスタートアップに登録することをおすすめします。
1. `start_local-video-hub.vbs` を右クリックし、「ショートカットの作成」を選択します。
2. キーボードの `Windowsキー + R` を押し、「ファイル名を指定して実行」を開きます。
3. `shell:startup` と入力して「OK」をクリックすると、スタートアップフォルダが開きます。
4. 手順1で作成した**ショートカット**を、開いたスタートアップフォルダの中に移動（またはコピー）します。
（これ以降、PCを再起動するたびに自動的にシステムがバックグラウンドで立ち上がるようになります）

### 2. AI Video Tagger によるタグ付け
対象の動画ファイル単体、または動画が含まれるディレクトリのパスを指定して実行します。
```bash
# ファイル単体の処理
python tagger/tagger.py "C:\path\to\your\video.mp4"

# ディレクトリ全体の一括処理
python tagger/tagger.py "C:\path\to\your\videos_folder"
```

**【便利な実行方法（バッチファイル）】**
`tagger/run_tagger.bat` をダブルクリックして実行すると、対話式のコマンドプロンプトが起動します。`media/` フォルダ内のライブラリ一覧が表示されるので、処理したいフォルダの番号を入力するだけで、パスの指定や仮想環境の起動を自動で行い、一括タグ付けを開始できます。

### 3. iOSからのワンタップ保存（ショートカット）
iPhoneからPC（API）へURLを送信し、自動ダウンロードを開始できます。

1. **ショートカットの追加:**
[ショートカットを追加する (iCloud Link)](https://www.icloud.com/shortcuts/09623062280e4716abcce8579c1c7abd)

2. **初期設定:**
   ショートカット内の設定で、以下の2箇所をご自身の環境に合わせて書き換えてください。
   - URL: `http://<PCのローカルIPまたはTailscale IP>:9096/download`
   - api_key: `.env` に設定したAPIキーの文字列

3. **実行:**
   X等のアプリで共有ボタンを押し、「PCへ保存（ショートカット名）」をタップするだけで、バックグラウンドで `downloads/inbox/` に動画が保存されます。

### 4. 動画の論理削除と復元（ゴミ箱機能）
プレイヤー画面右上にある「ゴミ箱」ボタンを押すことで、元のライブラリ（`media/...`）から隔離用の `trash` ディレクトリへ動画ファイル一式（`.nfo` や `.jpg` 等を含む）を移動させることができます（論理削除）。
- **完全削除ではなく移動:** 誤操作防止のためファイルはPC上から削除されず、`media/trash/...` 内に元のフォルダ構造を保ったまま退避されます。Jellyfin上で「trash」ライブラリを登録しておけば、一覧から確認可能です。
- **復元機能:** ゴミ箱に移動した動画を再度プレイヤーで開き、右上の「復元」ボタンを押すことで、元のライブラリの正しい位置へ復帰します。
- **Jellyfinとの連動:** 削除や復元を行うと、バックグラウンドで自動的にJellyfinのAPIを叩いてライブラリスキャンを要求し、シームレスに最新の状態がUIに反映されます。

---

## 注意事項
- **X(Twitter) のクッキーに関する注意:** 動画をダウンロードするための `config/x.com_cookies.txt` は、必ずブラウザで**ログイン状態**のままエクスポートしてください（`auth_token` という項目が含まれている必要があります）。一部の動画（ログインが必須な動画など）は、この `auth_token` が存在しない、または有効期限が切れていると取得できずに失敗します。有効期限切れの場合はショートカット実行時に即座にエラーが返されるため、再度クッキーを出力してファイルを上書きしてください。
- Taggerスクリプトは初回実行時に Hugging Face からAIモデルを自動ダウンロードします。
- セキュリティのため、`.env`, `config/`, `bin/` などの機密情報や巨大バイナリはGitの管理から除外（`.gitignore`）されています。
