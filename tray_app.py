import ctypes
import os
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

import psutil
import pystray
from dotenv import load_dotenv
from PIL import Image, ImageDraw

BASE_DIR = Path(__file__).resolve().parent
CLIENT_DIR = BASE_DIR / "client"
PYTHON_EXE = BASE_DIR / ".venv" / "Scripts" / "python.exe"

load_dotenv(BASE_DIR / ".env")
API_HOST = os.getenv("API_HOST", "100.88.57.78")
API_PORT = int(os.getenv("API_PORT", 9096))
WEB_PORT = int(os.getenv("WEB_PORT", 3096))
APP_SHORT_NAME = "LocalVideoHub"
MUTEX_NAME = f"Local\\{APP_SHORT_NAME}_Tray_Manager_Mutex"

CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)


def acquire_single_instance_mutex():
    """多重起動を防止するためのWindows名前付きミューテックスを取得する"""
    if os.name != "nt":
        return None
    kernel32 = ctypes.windll.kernel32
    mutex = kernel32.CreateMutexW(None, False, MUTEX_NAME)
    if kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        return None
    return mutex


def _make_diagonal_gradient(
    size: int, color_start: tuple[int, int, int], color_end: tuple[int, int, int]
) -> Image.Image:
    """左上から右下への2色グラデーションRGBA画像を生成する"""
    base = Image.new("RGBA", (size, size))
    px = base.load()
    max_dist = max(1, (size - 1) * 2)
    for y in range(size):
        for x in range(size):
            t = (x + y) / max_dist
            r = int(color_start[0] + (color_end[0] - color_start[0]) * t)
            g = int(color_start[1] + (color_end[1] - color_start[1]) * t)
            b = int(color_start[2] + (color_end[2] - color_start[2]) * t)
            px[x, y] = (r, g, b, 255)
    return base


def create_tray_icon(is_running: bool) -> Image.Image:
    """
    Local Video Hub 専用のトレイアイコン (64x64 RGBA) を描画する
    - is_running=True : Jellyfin風の紫〜青グラデーション枠＆モチーフ＋右下に緑色の稼働バッジ
    - is_running=False: グレー枠＋グレーモチーフ＋右下にオレンジ色の一時停止(||)バッジ
    """
    # アンチエイリアスを効かせるため4倍サイズ(256x256)で描画してから64x64へ縮小する
    scale = 4
    size = 64 * scale
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    def s(val: float) -> int:
        return int(round(val * scale))

    bg_color = (20, 20, 28, 255)
    # Jellyfin風グラデーションカラー（左上: パープル #AA5CC3 → 右下: シアンブルー #00A4DC）
    grad_main = _make_diagonal_gradient(
        size,
        (170, 92, 195) if is_running else (100, 100, 110),
        (0, 164, 220) if is_running else (82, 82, 91),
    )
    grad_emblem_bg = _make_diagonal_gradient(
        size,
        (88, 28, 135) if is_running else (52, 52, 58),
        (12, 74, 110) if is_running else (45, 45, 50),
    )

    # 1. 背景の角丸四角形塗りつぶし
    draw.rounded_rectangle(
        [s(2), s(2), s(56), s(56)],
        radius=s(12),
        fill=bg_color,
    )

    # 中央サークルのグラデーション背景
    emblem_bg_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(emblem_bg_mask).ellipse([s(15), s(14), s(43), s(42)], fill=255)
    img.paste(grad_emblem_bg, (0, 0), emblem_bg_mask)

    # 2. グラデーションを適用する枠・フィルム穴・中央リングのマスク作成
    accent_mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(accent_mask)

    # 外枠
    mask_draw.rounded_rectangle(
        [s(2), s(2), s(56), s(56)],
        radius=s(12),
        outline=255,
        width=s(3.2),
    )

    # 左右のフィルムパーフォレーション
    for y_top in (11, 25, 39):
        mask_draw.rounded_rectangle(
            [s(7.5), s(y_top), s(12.5), s(y_top + 8)],
            radius=s(1.5),
            fill=220,
        )
        mask_draw.rounded_rectangle(
            [s(45.5), s(y_top), s(50.5), s(y_top + 8)],
            radius=s(1.5),
            fill=220,
        )

    # 中央サークルのリング枠
    mask_draw.ellipse(
        [s(15), s(14), s(43), s(42)],
        outline=255,
        width=s(2.4),
    )

    img.paste(grad_main, (0, 0), accent_mask)

    # 再生トライアングル (▶)
    play_fg = (244, 244, 245, 255) if is_running else (161, 161, 170, 255)
    draw.polygon(
        [
            (s(25), s(20.5)),
            (s(25), s(35.5)),
            (s(36.5), s(28)),
        ],
        fill=play_fg,
    )

    # 3. 右下のステータスバッジ
    badge_bbox = [s(38), s(38), s(62), s(62)]
    if is_running:
        draw.ellipse(
            badge_bbox,
            fill=(34, 197, 94, 255),
            outline=(9, 9, 11, 255),
            width=s(3),
        )
    else:
        draw.ellipse(
            badge_bbox,
            fill=(245, 158, 11, 255),
            outline=(9, 9, 11, 255),
            width=s(3),
        )
        draw.rectangle([s(46), s(45), s(48.5), s(55)], fill=(24, 24, 27, 255))
        draw.rectangle([s(51.5), s(45), s(54), s(55)], fill=(24, 24, 27, 255))

    return img.resize((64, 64), Image.Resampling.LANCZOS)


class ServerTrayManager:
    def __init__(self):
        self.backend_proc: subprocess.Popen | None = None
        self.frontend_proc: subprocess.Popen | None = None
        self.is_running: bool = False
        self.lock = threading.Lock()
        self.icon: pystray.Icon | None = None

    def _kill_process_tree(self, pid: int):
        try:
            parent = psutil.Process(pid)
            children = parent.children(recursive=True)
            for child in children:
                try:
                    child.terminate()
                except psutil.NoSuchProcess:
                    pass
            parent.terminate()
            _, alive = psutil.wait_procs(children + [parent], timeout=3)
            for p in alive:
                try:
                    p.kill()
                except psutil.NoSuchProcess:
                    pass
        except psutil.NoSuchProcess:
            pass
        except Exception:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                creationflags=CREATE_NO_WINDOW,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

    def _kill_processes_on_ports(self, ports: list[int]):
        target_pids = set()
        try:
            for conn in psutil.net_connections(kind="inet"):
                if (
                    conn.status == psutil.CONN_LISTEN
                    and conn.laddr
                    and conn.laddr.port in ports
                    and conn.pid
                ):
                    target_pids.add(conn.pid)
        except Exception:
            pass

        for pid in target_pids:
            if pid != os.getpid():
                self._kill_process_tree(pid)

    def start_servers(self):
        with self.lock:
            if self.is_running:
                return

            self._kill_processes_on_ports([API_PORT, WEB_PORT])

            python_cmd = str(PYTHON_EXE) if PYTHON_EXE.exists() else sys.executable
            npm_cmd = shutil.which("npm.cmd") or shutil.which("npm") or "npm.cmd"

            # バックエンド起動 (FastAPI / Uvicorn: port 9096)
            self.backend_proc = subprocess.Popen(
                [
                    python_cmd,
                    "-m",
                    "uvicorn",
                    "server.main:app",
                    "--host",
                    "0.0.0.0",
                    "--port",
                    str(API_PORT),
                ],
                cwd=str(BASE_DIR),
                creationflags=CREATE_NO_WINDOW,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            # フロントエンド起動 (Vite preview: port 3096)
            self.frontend_proc = subprocess.Popen(
                [npm_cmd, "run", "preview"],
                cwd=str(CLIENT_DIR),
                creationflags=CREATE_NO_WINDOW,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            self.is_running = True
            self._update_tray_ui()

    def stop_servers(self):
        with self.lock:
            if self.backend_proc and self.backend_proc.poll() is None:
                self._kill_process_tree(self.backend_proc.pid)
            self.backend_proc = None

            if self.frontend_proc and self.frontend_proc.poll() is None:
                self._kill_process_tree(self.frontend_proc.pid)
            self.frontend_proc = None

            self._kill_processes_on_ports([API_PORT, WEB_PORT])

            self.is_running = False
            self._update_tray_ui()

    def restart_servers(self):
        self.stop_servers()
        time.sleep(0.5)
        self.start_servers()

    def _update_tray_ui(self):
        if not self.icon:
            return
        self.icon.icon = create_tray_icon(self.is_running)
        status_str = "常駐稼働中" if self.is_running else "停止中"
        self.icon.title = f"{APP_SHORT_NAME} - {status_str} ({API_PORT} / {WEB_PORT})"
        self.icon.update_menu()

    def on_open_browser(self, icon=None, item=None):
        webbrowser.open(f"http://{API_HOST}:{WEB_PORT}")

    def on_open_vscode(self, icon=None, item=None):
        code_cmd = shutil.which("code.cmd") or shutil.which("code")
        if not code_cmd:
            local_app_data = os.environ.get("LOCALAPPDATA", "")
            candidate = Path(local_app_data) / "Programs" / "Microsoft VS Code" / "bin" / "code.cmd"
            if candidate.exists():
                code_cmd = str(candidate)

        if code_cmd:
            subprocess.Popen(
                [code_cmd, str(BASE_DIR)],
                cwd=str(BASE_DIR),
                creationflags=CREATE_NO_WINDOW,
            )
        else:
            os.startfile(str(BASE_DIR))

    def on_toggle_servers(self, icon=None, item=None):
        if self.is_running:
            threading.Thread(target=self.stop_servers, daemon=True).start()
        else:
            threading.Thread(target=self.start_servers, daemon=True).start()

    def on_restart_servers(self, icon=None, item=None):
        threading.Thread(target=self.restart_servers, daemon=True).start()

    def on_exit_tray(self, icon=None, item=None):
        self.stop_servers()
        if self.icon:
            self.icon.stop()

    def build_menu(self) -> pystray.Menu:
        return pystray.Menu(
            pystray.MenuItem(
                lambda item: (
                    f"● 状態: 常駐稼働中 ({API_PORT} / {WEB_PORT})"
                    if self.is_running
                    else f"○ 状態: 停止中 ({API_PORT} / {WEB_PORT})"
                ),
                None,
                enabled=False,
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                f"🌐 ブラウザで開く ({API_HOST}:{WEB_PORT})",
                self.on_open_browser,
                default=True,
            ),
            pystray.MenuItem(
                "📁 プロジェクトフォルダをVS Codeで開く",
                self.on_open_vscode,
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                lambda item: "⏸ 常駐を停止" if self.is_running else "▶ 常駐を再開",
                self.on_toggle_servers,
            ),
            pystray.MenuItem(
                "🔄 常駐サーバーを再起動",
                self.on_restart_servers,
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "❌ トレイから完全終了",
                self.on_exit_tray,
            ),
        )

    def run(self):
        self.icon = pystray.Icon(
            name=APP_SHORT_NAME.lower(),
            icon=create_tray_icon(False),
            title=f"{APP_SHORT_NAME} - 起動中 ({API_PORT} / {WEB_PORT})",
            menu=self.build_menu(),
        )

        def setup(icon: pystray.Icon):
            icon.visible = True
            self.start_servers()

        self.icon.run(setup=setup)


if __name__ == "__main__":
    mutex = acquire_single_instance_mutex()
    if mutex is None:
        sys.exit(0)

    manager = ServerTrayManager()
    manager.run()
