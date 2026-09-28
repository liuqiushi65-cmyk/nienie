from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = ROOT / 'artifacts/xiaohongshu/recording-edit'
OUT = ROOT / 'artifacts/xiaohongshu/landscape-edit'
FONT = '/System/Library/Fonts/PingFang.ttc'
CAPTIONS = [
    '给自己做了个 vibe coding 搭子，住在 Codex 右边',
    '模型在思考，我在旁边捏捏。听它一点点碎开',
    '等着等着，还可以换个口味',
    '兜了一圈，还是想捏奶酪',
    '有回复了！它会发光，轻轻 biu 一声叫我',
    '嗯……还不是我想要的',
    '长按两秒，替我炸一下',
    '捏一会儿，再继续改。我的 Codex 搭子',
]


def run(args: list[str], log: str) -> None:
    with (OUT / log).open('w') as stream:
        subprocess.run(args, check=True, stdout=stream, stderr=subprocess.STDOUT)


def subtitle(label: str, name: str) -> Path:
    # 字幕位于原片留白中，不遮挡输入框、回复气泡或捏捏。
    im = Image.new('RGBA', (1920, 1080))
    draw = ImageDraw.Draw(im)
    font = ImageFont.truetype(FONT, 34)
    width = draw.textlength(label, font=font)
    left = (1920 - width) / 2
    draw.rounded_rectangle((left-26, 842, left+width+26, 908), 23,
                           fill=(249, 246, 239, 246), outline=(225, 216, 204, 255), width=1)
    draw.text((960, 874), label, anchor='mm', font=font, fill='#594B40')
    path = OUT / f'{name}-subtitle.png'
    im.save(path)
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((PREVIOUS / 'edit-decision-list.json').read_text())
    audio = PREVIOUS / 'Codex搭子-真实录屏版-v2.mp4'
    if not audio.exists():
        raise FileNotFoundError('请先运行 edit-recorded-social-video.py，生成已校准的原声音轨')
    for shot, caption in zip(manifest['shots'], CAPTIONS):
        overlay = subtitle(caption, shot['id'])
        # 完整屏幕等比缩放，四周最多补两像素，不改变真实空间关系。
        filters = (
            f"[0:v]setpts=(PTS-STARTPTS)/{shot['speed']},fps=30,"
            'scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,'
            'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1[screen];'
            '[screen][1:v]overlay=0:0,format=yuv420p[v]'
        )
        run(['ffmpeg', '-hide_banner', '-y', '-ss', str(shot['start']),
             '-t', str(shot['end']-shot['start']), '-i', manifest['source'],
             '-loop', '1', '-framerate', '30', '-i', str(overlay),
             '-filter_complex_threads', '2', '-filter_complex', filters,
             '-map', '[v]', '-an', '-t', str(shot['duration']), '-c:v', 'libx264',
             '-preset', 'fast', '-crf', '18', '-video_track_timescale', '30000',
             str(OUT / f"{shot['id']}.mp4")], shot['id']+'.log')
        shot['landscape_caption'] = caption
        print(shot['id'], '完成', flush=True)
    (OUT / 'concat.txt').write_text(''.join(f"file '{s['id']}.mp4'\n" for s in manifest['shots']))
    run(['ffmpeg', '-hide_banner', '-y', '-f', 'concat', '-safe', '0', '-i', str(OUT/'concat.txt'),
         '-i', str(audio), '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy',
         '-t', str(manifest['duration']), '-movflags', '+faststart',
         str(OUT/'Codex搭子-横屏实录版.mp4')], 'final-mux.log')
    manifest.update(size=[1920, 1080], audio_source=str(audio),
                    evidence='单一完整录屏等比缩放，保留 Codex 与捏捏原有位置；音轨无损沿用竖屏版已校准原声。')
    (OUT/'edit-decision-list.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print('横屏成片完成', manifest['duration'], '秒', flush=True)


if __name__ == '__main__':
    main()
