from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/xiaohongshu/codex-corner'
SOURCE = OUT / 'Codex搭子-可爱新消息提醒版.mp4'
TARGET = OUT / 'Codex搭子-精简结尾版.mp4'


def main() -> None:
    # 精确保留前 37 秒，最后 0.6 秒淡出音轨，避免截断音乐。
    with (OUT / 'trim-ending-render.log').open('w') as log:
        subprocess.run([
            'ffmpeg', '-hide_banner', '-y', '-i', str(SOURCE),
            '-map', '0:v:0', '-map', '0:a:0', '-map_metadata', '0',
            '-t', '37', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
            '-pix_fmt', 'yuv420p', '-af', 'afade=t=out:st=36.4:d=0.6',
            '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(TARGET),
        ], check=True, stdout=log, stderr=subprocess.STDOUT)
    print(TARGET)


if __name__ == '__main__':
    main()
