from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'artifacts/xiaohongshu/codex-corner'
SOURCE = OUT/'Codex搭子-碎裂声柔化版.mp4'
TARGET = OUT/'Codex搭子-可爱新消息提醒版.mp4'


def main() -> None:
    # 只替换 17.7–22.5 秒提醒段的文案，保留原录屏气泡、浮动和光效。
    im = Image.new('RGBA',(1080,1920));d = ImageDraw.Draw(im)
    def text(x: int,y: int,s: str,size: int,color: str,anchor: str='lt') -> None:
        font=ImageFont.truetype('/System/Library/Fonts/PingFang.ttc',size,index=8)
        assert d.textlength(s,font=font)<960,s
        d.text((x,y),s,font=font,fill=color,anchor=anchor)
    d.rectangle((0,75,1080,275),fill='#131D2B')
    text(60,90,'最棒的是——',70,'#F7F9FC')
    text(56,171,'Codex 有了新消息',86,'#8EF0BE')
    d.rounded_rectangle((60,650,1020,712),18,fill='#8EF0BE')
    text(540,681,'它会发出可爱声音叫我！',36,'#15202E','mm')
    d.rectangle((0,1808,1080,1873),fill='#131D2B')
    text(540,1839,'biu～像在说：快回来看看呀',40,'#F7F9FC','mm')
    im.save(OUT/'cute-notification-overlay.png')
    with (OUT/'cute-notification-render.log').open('w') as log:
        subprocess.run(['ffmpeg','-hide_banner','-y','-i',str(SOURCE),'-loop','1','-framerate','30',
                        '-i',str(OUT/'cute-notification-overlay.png'),'-filter_complex_threads','2',
                        '-filter_complex',"[0:v][1:v]overlay=0:0:enable='gte(t,17.7)*lt(t,22.5)',format=yuv420p[v]",
                        '-map','[v]','-map','0:a:0','-map_metadata','0','-c:v','libx264','-preset','fast',
                        '-crf','18','-r','30','-c:a','copy','-t','39','-movflags','+faststart',str(TARGET)],
                       check=True,stdout=log,stderr=subprocess.STDOUT)
    (OUT/'cute-notification-manifest.json').write_text(json.dumps(dict(source=str(SOURCE),output=str(TARGET),
        range=[17.7,22.5],copy=['最棒的是——','Codex 有了新消息','它会发出可爱声音叫我！','biu～像在说：快回来看看呀'],
        duration=39,audio='直接复制碎裂音色柔化版'),ensure_ascii=False,indent=2))
    print(TARGET)


if __name__=='__main__':
    main()
