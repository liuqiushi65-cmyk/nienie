from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = ROOT / 'artifacts/xiaohongshu/recording-edit'
OUT = ROOT / 'artifacts/xiaohongshu/portrait-emphasis'
FONT = '/System/Library/Fonts/PingFang.ttc'
YELLOW, GREEN, CORAL = '#FFE073', '#8EF0BE', '#FF9A83'
COPY = [
    ('我的 vibe coding', '有了捏捏搭子', YELLOW, '等模型回复时，手也有事做', '打开声音，听听它有多解压'),
    ('模型在思考', '我在旁边捏捏', YELLOW, '慢慢捏 · 听它一点点碎开', '真实 ASMR，陪你度过等待'),
    ('等得无聊？', '换个捏捏', YELLOW, '点击「换一下」', '奶酪 / 年糕 / 大福，随手换'),
    ('今天想捏哪个？', '一键换口味', YELLOW, '多款捏捏 · 随手切换', '兜了一圈，还是想捏奶酪'),
    ('Codex 回复了', '它会发光叫我', GREEN, '发光 + 浮动 + 消息气泡', '轻轻 biu 一声，叫你回来'),
    ('答案不满意？', '先捏爆再说', CORAL, '给情绪找个出口', '没关系，先把这口气放出来'),
    ('长按 2 秒', '一下捏爆！', CORAL, '长按蓄力 → 外壳炸开', '「我炸了」—— 还会奶凶地哼一声'),
    ('捏一会儿', '再继续改', YELLOW, '我的 Codex 捏捏搭子', '等待有陪伴，情绪有出口'),
]
# 成片时间；只提高有交互声的区间，渐变进入以免产生突兀的音量跳变。
GAIN_WINDOWS = [(3.35, 9.48, 6), (9.48, 17.75, 3), (18.5, 20.8, 6), (26.1, 28.8, 5)]


def run(args: list[str], name: str) -> None:
    with (OUT / name).open('w') as stream:
        subprocess.run(args, check=True, stdout=stream, stderr=subprocess.STDOUT)


def label(d: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, size: int,
          color: str, anchor: str = 'lt', bold: bool = True) -> None:
    font = ImageFont.truetype(FONT, size, index=8 if bold else 2)
    assert d.textlength(text, font=font) <= 960, text
    d.text(xy, text, font=font, fill=color, anchor=anchor)


def card(shot: dict, copy: tuple) -> Path:
    first, second, accent, action, footer = copy
    im = Image.new('RGB', (1080, 1920), '#131D2B')
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((60, 40, 76, 63), 4, fill=accent)
    label(d, (88, 39), 'VIBE CODING  /  捏捏搭子', 26, '#B9C5D4')
    label(d, (60, 90), first, 70, '#F7F9FC')
    label(d, (56, 171), second, 96, accent)
    label(d, (64, 287), 'CODEX · 真实对话', 24, '#B9C5D4')
    d.rounded_rectangle((54, 318, 1026, 626), 18, fill='white', outline='#445265', width=2)
    d.rounded_rectangle((60, 650, 1020, 712), 18, fill=accent)
    label(d, (540, 681), action, 34, '#15202E', anchor='mm')
    d.rounded_rectangle((78, 726, 1002, 1796), 26, fill='white', outline=accent, width=5)
    label(d, (540, 1839), footer, 40, '#F7F9FC', anchor='mm')
    label(d, (540, 1894), '同一段录屏 · 同步放大 · 原声音效', 20, '#93A3B8', anchor='mm', bold=False)
    target = OUT / f"{shot['id']}-layout.png"
    im.save(target)
    return target


def audio() -> None:
    source = PREVIOUS / 'Codex搭子-真实录屏版-v2.mp4'
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(source), '-vn', '-ar', '48000',
                          '-ac', '2', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    samples = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()[:33*48000]
    t = np.arange(len(samples)) / 48000
    gain_db = np.zeros(len(samples))
    for start, end, gain in GAIN_WINDOWS:
        ramp = np.minimum(np.clip((t-start)/.08, 0, 1), np.clip((end-t)/.10, 0, 1))
        gain_db = np.maximum(gain_db, ramp*gain)
    samples *= np.power(10, gain_db/20)[:, None]
    wavfile.write(OUT/'boosted.wav', 48000, samples)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((PREVIOUS/'edit-decision-list.json').read_text())
    for shot, copy in zip(manifest['shots'], COPY):
        layout = card(shot, copy)
        # 上方收紧 Codex 上下文，下方放大捏捏；通知及炸开碎片保留在同一裁切里。
        y = "'if(lt(t,1.15),1096,240)'" if shot['id']=='01-submit' else ('1096' if shot['id']=='08-return' else ('240' if shot['id'] in ['02-asmr','03-switch','04-cycle'] else '90'))
        filters = (
            f"[0:v]setpts=(PTS-STARTPTS)/{shot['speed']},fps=30,split=2[c][p];"
            f'[c]crop=1550:478:550:{y},scale=960:296:flags=lanczos[codex];'
            '[p]crop=706:820:2100:460,scale=900:1046:flags=lanczos[pet];'
            '[1:v][codex]overlay=60:324[tmp];[tmp][pet]overlay=90:738,format=yuv420p[v]'
        )
        run(['ffmpeg', '-hide_banner', '-y', '-ss', str(shot['start']), '-t', str(shot['end']-shot['start']),
             '-i', manifest['source'], '-loop', '1', '-framerate', '30', '-i', str(layout),
             '-filter_complex_threads', '2', '-filter_complex', filters, '-map', '[v]', '-an',
             '-t', str(shot['duration']), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
             '-video_track_timescale', '30000', str(OUT/f"{shot['id']}.mp4")], shot['id']+'.log')
        shot['emphasis_copy'] = list(copy)
        print(shot['id'], '完成', flush=True)
    (OUT/'concat.txt').write_text(''.join(f"file '{s['id']}.mp4'\n" for s in manifest['shots']))
    audio()
    # 限幅只约束峰值，不自动补偿整体响度；补偿 lookahead 延迟，保持此前音画对齐。
    run(['ffmpeg', '-hide_banner', '-y', '-f', 'concat', '-safe', '0', '-i', str(OUT/'concat.txt'),
         '-i', str(OUT/'boosted.wav'), '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
         '-af', 'alimiter=limit=0.8414:level=false:attack=5:release=60:latency=true',
         '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', '33', '-movflags', '+faststart',
         str(OUT/'Codex搭子-竖版重点强化.mp4')], 'final-mux.log')
    manifest.update(audio_gain_windows=GAIN_WINDOWS, audio_peak_limit_db=-1.5,
                    evidence='沿用真实录屏时间线；强调色、大字和更大的捏捏窗口突出玩法；原声分段增益。')
    (OUT/'edit-decision-list.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print('强化竖版完成', flush=True)


if __name__ == '__main__':
    main()
