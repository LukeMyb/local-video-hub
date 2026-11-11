# Local Video Hub

ローカルの動画ファイルを管理・閲覧し、AIによる自動タグ付けを行うための統合ツールセットです。動画ギャラリーを閲覧するWebクライアント（Client）、動画ダウンロードやお気に入り・ファイル管理を行うバックエンドAPI（Server）、動画へのAIタグ付けやデータ移行を行うスクリプト群（Scripts）で構成されています。

## 特徴 (Features)

- **バックエンドAPI (`server/`)**
  - FastAPIと `yt-dlp` を用いたバックグラウンド動画ダウンロード機能（X / TikTok 対応、クッキー有効期限の事前チェック機能付き）。
  - iOSショートカットと連携し、スマホからワンタップでPCへ動画を保存可能。
  - JellyfinのDBに依存しないファイル名ベースの独自お気に入りデータベース（SQLite: `data/favorites.db`）を提供。ファイルを移動したりライブラリを再構築してもお気に入り状態が維持されます。
  - APIキー認証によるセキュアなローカルネットワーク公開。
- **Webクライアント (`client/`)**
  - React + Vite 構成の高速なフロントエンド。Tailwind CSS を用いたモダンなUI、PWA (Progressive Web App) 対応。
  - **ホーム・検索機能**: タグによる複数キーワード検索（サジェスト補完付き）、お気に入りフィルター、追加日時の昇順・降順ソート、ランダム再生、一番上での引っ張り（または上スクロール）によるグリッド再読み込み。
  - **グリッド列数調整**: スマホのピンチイン・アウトやPCの `Shift + マウスホイール` で列数を自由に変更可能。スマホの縦横回転時には比率に応じて自動で列数を調整。
  - **サイドバードロワー**: 右スワイプで開閉でき、ライブラリの検索や最近開いた履歴順での並び替えに対応。
  - **高機能プレイヤー**: ピンチズーム＆ドラッグ移動、シークバー長押しによる詳細シークバー（最大2段・元の位置マーカー付き）、別ライブラリへのファイル移動、ゴミ箱（`trash`）への論理削除・復元機能を搭載。
- **管理・AIスクリプト (`scripts/`)**
  - 動画 (`.mp4`) から自動的に複数フレームを抽出し、画像認識AIによってタグを生成（`tagger.py`）。
  - JellyfinやKodiで読み込み可能な `.nfo` ファイルにタグ情報を自動追記。
  - Jellyfin上のお気に入りデータをアプリ独自のSQLiteデータベース（`data/favorites.db`）へ移行するスクリプト（`import_favorites.py`）を収録。
- **タスクトレイ常駐ランチャー (`tray_app.py`)**
  - Windowsタスクトレイに常駐し、他のPython / Node.jsアプリを巻き込まずにこのツールのバックエンド（ポート `9096`）・フロントエンド（ポート `3096`）のみをピンポイントで起動・停止・再起動可能。
  - トレイアイコンからワンクリックでのブラウザ起動や、プロジェクトフォルダをVS Codeで開くショートカットを搭載。

---

## ディレクトリ構成

```text
local-video-hub/
├── .env                         # バックエンド用環境変数 (API_KEY など)
├── README.md                    # このドキュメント
├── requirements.txt             # Pythonの依存関係
├── tray_app.py                  # タスクトレイ常駐ランチャー
├── start_local-video-hub.vbs    # 起動用スクリプト (tray_app.py を非表示起動)
├── bin/
│   └── ffmpeg.exe               # 動画処理用バイナリ
├── client/                      # Webクライアント (React/Vite)
│   ├── public/                  # 静的ファイル・Favicon・PWA用アイコン一式
│   ├── src/                     # フロントエンドのソースコード
│   │   ├── api/                 # API通信用関数 (jellyfin.js, backend.js)
│   │   ├── assets/              # 静的アセット
│   │   ├── components/          # UIコンポーネント (home, player, common)
│   │   ├── hooks/               # カスタムフック
│   │   ├── pages/               # ページコンポーネント (Home.jsx, Player.jsx)
│   │   ├── utils/               # ユーティリティ関数
│   │   ├── App.jsx              # アプリケーションのルート
│   │   └── main.jsx             # Reactエントリポイント
│   ├── .env                     # フロントエンド用環境変数 (Jellyfin / Backend接続設定)
│   ├── package.json             # Node.jsパッケージ設定
│   └── vite.config.js           # Vite・PWA設定
├── config/
│   ├── x.com_cookies.txt        # X (Twitter) 動画ダウンロード用Cookie
│   └── tiktok.com_cookies.txt   # TikTok 動画ダウンロード用Cookie
├── data/
│   └── favorites.db             # お気に入り管理用SQLiteデータベース (自動生成)
├── downloads/                   # 動画の保存先
│   └── inbox/                   # 自動ダウンロードされた動画の初期保存先
├── media/                       # Jellyfinライブラリ用の動画データ配置先
│   └── trash/                   # 論理削除された動画の退避先ディレクトリ
├── server/                      # バックエンドAPI (FastAPI)
│   ├── logs/                    # ダウンロードログ (download.log, failed.txt)
│   └── main.py                  # APIサーバーのメインスクリプト
└── scripts/                     # 管理・AIスクリプト
    ├── tagger.py                # タグ抽出・NFO更新スクリプト
    ├── run_tagger.bat           # 対話式タグ付けバッチファイル
    ├── import_favorites.py      # Jellyfinお気に入り移行スクリプト
    └── run_import_favorites.bat # お気に入り移行用バッチファイル
```

- `client/` : ビデオギャラリーを表示するためのReact/Viteアプリケーション。
- `server/` : 動画ダウンロード、お気に入り管理、ファイル移動・論理削除を受け付けるFastAPIバックエンド。
- `scripts/` : 動画からタグを抽出し `.nfo` ファイルを編集するスクリプトや、お気に入り移行スクリプト。
- `bin/` : 外部バイナリファイル（`ffmpeg.exe` 等）の配置場所。
- `config/` : 設定ファイル（`x.com_cookies.txt`, `tiktok.com_cookies.txt` 等）の配置場所。
- `data/` : アプリ独自の永続化データ（`favorites.db`）の保存先。
- `downloads/inbox/` : ダウンロードされた動画の初期保存先。
- `media/` : 各ライブラリの動画ファイルおよび論理削除用の `trash/` フォルダの配置場所。
- `tray_app.py` : バックエンドとフロントエンドのプロセス管理を行うタスクトレイ常駐ランチャー。
- `start_local-video-hub.vbs` : `pythonw.exe` 経由で `tray_app.py` をコンソール非表示で起動するスクリプト。

---

## セットアップ

### 1. 全体設定とバックエンド (`server/`)

#### 必要な環境・ファイル
- Python 3.10以上
- `ffmpeg.exe` (動画と音声の結合に使用。`bin/` ディレクトリ内に配置してください)
- `x.com_cookies.txt` / `tiktok.com_cookies.txt` (XやTikTokの動画保存用。`config/` ディレクトリ内に配置してください)

#### インストールと環境設定
1. プロジェクトルートに `.env` ファイルを作成し、バックエンド用のAPIキーを設定します。
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

#### 環境変数の設定とビルド
1. `client/.env` ファイルを作成し、JellyfinおよびバックエンドAPIの接続情報を設定します。
   ```text
   VITE_JELLYFIN_URL=http://<JellyfinサーバーのIP>:8096
   VITE_JELLYFIN_API_KEY=<JellyfinのAPIキー>
   VITE_JELLYFIN_USER_ID=<JellyfinのユーザーID>
   VITE_BACKEND_URL=http://<PCのIP>:9096
   VITE_BACKEND_API_KEY=<ルートの.envと同じAPI_KEY>
   ```
2. パッケージのインストールとビルドを実行します。
   ```bash
   cd client
   npm install
   npm run build
   ```

---

## 使い方 (Usage)

### 1. システムの起動（タスクトレイ常駐）
プロジェクトルートにある `start_local-video-hub.vbs` をダブルクリックします。
タスクトレイに `LocalVideoHub` アイコンが表示され、バックグラウンドで自動的に以下の2つが起動します。
- Webクライアント (ポート: `3096`)
- バックエンドAPI (ポート: `9096`)

#### タスクトレイメニューの操作
トレイアイコンを右クリック（または左クリックでブラウザ起動）すると以下の操作を行えます。
- **🌐 ブラウザで開く**: デフォルトブラウザでWebクライアントを開きます。
- **📁 プロジェクトフォルダをVS Codeで開く**: VS Codeでこのプロジェクトを開きます。
- **⏸ 常駐を停止 / ▶ 常駐を再開**: 他の常駐アプリを巻き込まずに、このツールのサーバープロセスのみを停止・再開します（開発時にターミナルで手動起動したい場合などに便利です）。
- **🔄 常駐サーバーを再起動**: フロントエンドのビルド（`npm run build`）後など、変更を即座に反映したい時にサーバーを再起動します。
- **❌ トレイから完全終了**: サーバーを停止し、タスクトレイ常駐ランチャー自体も終了します。

#### PC起動時に自動実行する場合（スタートアップ登録）
毎回手動で起動するのが手間の場合は、以下の手順でWindowsのスタートアップに登録することをおすすめします。
1. `start_local-video-hub.vbs` を右クリックし、「ショートカットの作成」を選択します。
2. キーボードの `Windowsキー + R` を押し、「ファイル名を指定して実行」を開きます。
3. `shell:startup` と入力して「OK」をクリックすると、スタートアップフォルダが開きます。
4. 手順1で作成した**ショートカット**を、開いたスタートアップフォルダの中に移動（またはコピー）します。
（これ以降、PCを再起動するたびに自動的にシステムがバックグラウンドで立ち上がるようになります）

### 2. AI Video Tagger によるタグ付け・お気に入り移行
対象の動画ファイル単体、または動画が含まれるディレクトリのパスを指定して実行します。
```bash
# ファイル単体の処理
python scripts/tagger.py "C:\path\to\your\video.mp4"

# ディレクトリ全体の一括処理
python scripts/tagger.py "C:\path\to\your\videos_folder"
```

**【便利な実行方法（バッチファイル）】**
`scripts/run_tagger.bat` をダブルクリックして実行すると、対話式のコマンドプロンプトが起動します。`media/` フォルダ内のライブラリ一覧が表示されるので、処理したいフォルダの番号を入力するだけで、パスの指定や仮想環境の起動を自動で行い、一括タグ付けを開始できます。

**【Jellyfinお気に入りデータの移行】**
Jellyfin上で登録したお気に入りデータをアプリの独自DB（`data/favorites.db`）へ取り込む場合は、以下のスクリプトを実行します。
```bash
python scripts/import_favorites.py
```
`scripts/run_import_favorites.bat` をダブルクリックしても実行できます（仮想環境の起動も自動で行います）。何度実行しても、取り込み済みのファイルはスキップされます。

### 3. iOSからのワンタップ保存（ショートカット）
iPhoneからPC（API）へURLを送信し、自動ダウンロードを開始できます。

1. **ショートカットの追加:**
[ショートカットを追加する (iCloud Link)](https://www.icloud.com/shortcuts/09623062280e4716abcce8579c1c7abd)

2. **初期設定:**
   ショートカット内の設定で、以下の2箇所をご自身の環境に合わせて書き換えてください。
   - URL: `http://<PCのローカルIPまたはTailscale IP>:9096/download`
   - api_key: `.env` に設定したAPIキーの文字列

3. **実行:**
   XやTikTok等のアプリで共有ボタンを押し、「PCへ保存（ショートカット名）」をタップするだけで、バックグラウンドで `downloads/inbox/` に動画が保存されます。

### 4. 動画のライブラリ間移動と論理削除（ゴミ箱機能）
プレイヤー画面右上のボタンから、動画ファイル一式（`.nfo` や `-poster.jpg` 等の関連ファイルを含む）の整理を行えます。
- **別ライブラリへの移動:** 右上の矢印ボタンから移動先のライブラリを選択すると、`media/<移動先ライブラリ>/` へ関連ファイルごと移動します。お気に入り状態はファイル名で管理されているため、移動後もそのまま維持されます。
- **ゴミ箱への移動（論理削除）:** ゴミ箱ボタンを押すと、誤操作防止のためPC上から完全削除はせず、`media/trash/...` 内に元のフォルダ構造を保ったまま退避されます。Jellyfin上で「trash」ライブラリを登録しておけば一覧から確認可能です。
- **復元機能:** ゴミ箱内の動画をプレイヤーで開き、右上の「復元」ボタンを押すことで、元のライブラリの正しい位置へ復帰します。
- **Jellyfinとの連動:** 移動・削除・復元を行うと、バックグラウンドで自動的にJellyfinのAPIを叩いてライブラリスキャンを要求し、最新の状態がUIに反映されます。

---

## 注意事項
- **クッキーファイルに関する注意:** 動画をダウンロードするための `config/x.com_cookies.txt`（X用、`auth_token` 必須）および `config/tiktok.com_cookies.txt`（TikTok用、`sessionid` 必須）は、必ずブラウザで**ログイン状態**のままエクスポートしてください。存在しない場合や有効期限が切れている場合はショートカット実行時に即座にエラーが返されるため、再度クッキーを出力してファイルを上書きしてください。
- Taggerスクリプトは初回実行時に Hugging Face からAIモデルを自動ダウンロードします。
- セキュリティのため、`.env`, `config/`, `bin/`, `data/` などの機密情報やDB・巨大バイナリはGitの管理から除外（`.gitignore`）されています。
