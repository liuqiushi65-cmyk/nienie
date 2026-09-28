from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'artifacts/xiaohongshu/codex-corner'
PREVIOUS = ROOT/'artifacts/xiaohongshu/slime-tail/Codex搭子-配乐版-轻柔音量.mp4'
SOURCE = Path(json.loads((ROOT/'artifacts/xiaohongshu/recording-edit/edit-decision-list.json').read_text())['source'])


def text(d: ImageDraw.ImageDraw, xy: tuple, label: str, size: int, color: str, anchor: str = 'lt') -> None:
    font = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', size, index=8)
    assert d.textlength(label, font=font) < 960
    d.text(xy, label, font=font, fill=color, anchor=anchor)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.new('RGB', (1080,1920), '#131D2B'); d=ImageDraw.Draw(im)
    d.rounded_rectangle((60,40,76,63),4,fill='#FFE073')
    text(d,(88,39),'VIBE CODING / 捏捏搭子',26,'#B9C5D4')
    text(d,(60,90),'捏捏就住在',70,'#F7F9FC')
    text(d,(56,171),'Codex 窗口角落',86,'#FFE073')
    text(d,(64,287),'完整 Codex 窗口 · 真实录屏',24,'#B9C5D4')
    d.rounded_rectangle((54,324,1026,874),18,fill='white',outline='#445265',width=2)
    text(d,(540,908),'同一位置，放大看 ↓',30,'#FFE073','mm')
    d.rounded_rectangle((78,938,1002,1790),26,fill='white',outline='#FFE073',width=5)
    text(d,(540,1839),'不用切走，等回复时顺手捏',40,'#F7F9FC','mm')
    text(d,(540,1894),'同一段录屏 · 完整窗口 + 同步局部放大',20,'#93A3B8','mm')
    im.save(OUT/'intro-layout.png')
    marker=Image.new('RGBA',(1080,1920));d=ImageDraw.Draw(marker)
    # 高亮原录屏中的位置，不把捏捏移到另一处或重绘 Codex 界面。
    d.rounded_rectangle((793,541,1010,765),18,outline='#FFE073',width=6)
    d.rounded_rectangle((545,567,782,617),14,fill='#131D2B')
    text(d,(663,592),'就在右下角',30,'#FFE073','mm')
    d.line([(686,626),(731,663),(794,663)],fill='#172433',width=10)
    d.line([(686,626),(731,663),(794,663)],fill='#FFE073',width=6)
    d.polygon([(807,663),(790,653),(790,673)],fill='#FFE073')
    marker.save(OUT/'corner-marker.png')
    ending=Image.new('RGBA',(1080,1920));d=ImageDraw.Draw(ending)
    d.rectangle((0,75,1080,275),fill='#131D2B')
    text(d,(60,90),'Codex 角落里',70,'#F7F9FC')
    text(d,(56,171),'有个捏捏搭子',96,'#FFE073')
    ending.save(OUT/'ending-title.png')
    filters=(
        '[1:v]setpts=PTS-STARTPTS,fps=30,split=2[f][p];'
        '[f]scale=960:538:flags=lanczos,setsar=1[full];'
        '[p]crop=706:650:2100:630,scale=900:828:flags=lanczos,setsar=1[pet];'
        '[2:v][full]overlay=60:330[tmp];[tmp][pet]overlay=90:950[zoom];'
        '[zoom][3:v]overlay=0:0,trim=duration=3.4,setpts=PTS-STARTPTS[intro];'
        '[0:v]trim=start=3.4,setpts=PTS-STARTPTS[rest];'
        '[intro][rest]concat=n=2:v=1:a=0[all];'
        "[all][4:v]overlay=0:0:enable='gte(t,34.8)',format=yuv420p[v]"
    )
    cmd=['ffmpeg','-hide_banner','-y','-i',str(PREVIOUS),'-ss','5.3','-t','3.4','-i',str(SOURCE)]
    for file in ['intro-layout.png','corner-marker.png','ending-title.png']:
        cmd+=['-loop','1','-framerate','30','-i',str(OUT/file)]
    cmd+=['-filter_complex_threads','2','-filter_complex',filters,'-map','[v]','-map','0:a:0',
          '-map_metadata','0','-c:v','libx264','-preset','fast','-crf','18','-r','30','-c:a','copy',
          '-t','39','-movflags','+faststart',str(OUT/'Codex搭子-窗口角落强调版.mp4')]
    with (OUT/'render.log').open('w') as log:
        subprocess.run(cmd,check=True,stdout=log,stderr=subprocess.STDOUT)
    (OUT/'edit-manifest.json').write_text(json.dumps(dict(duration=39,intro_duration=3.4,
        intro_source_range=[5.3,8.7],source=str(SOURCE),previous=str(PREVIOUS),
        changes='开头完整窗口高亮右下角并同步放大；结尾重申窗口角落；复制轻柔版音轨'),ensure_ascii=False,indent=2))
    print(OUT/'Codex搭子-窗口角落强调版.mp4')


if __name__ == '__main__':
    main()
