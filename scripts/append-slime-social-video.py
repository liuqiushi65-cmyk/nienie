from __future__ import annotations

import importlib.util
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'artifacts/xiaohongshu/slime-tail'
PRIOR = ROOT/'artifacts/xiaohongshu/carefree-mix'
VIDEO = ROOT/'artifacts/xiaohongshu/portrait-emphasis/Codex搭子-竖版重点强化.mp4'
spec = importlib.util.spec_from_file_location('mix', ROOT/'scripts/mix-carefree-social-video.py')
mix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mix)
mix.DURATION = 39
mix.OUT = OUT


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # 补充段复用原片 Codex 与工具栏定格，主体由应用原渲染器绘制。
    mix.run(['ffmpeg','-hide_banner','-y','-ss','29.1','-i',str(VIDEO),'-frames:v','1',str(OUT/'base.png')], 'base.log')
    # 用与主片相同的字体栅格器生成字幕，避免 Canvas 大号中文字缓存缺失。
    actions=['按一下，软软塌下去','拖一拖，黏糊糊地拉开','换个方向，再揉一揉','松开，慢慢回弹']
    for index,action in enumerate(actions):
        im=Image.open(OUT/'base.png').convert('RGB');d=ImageDraw.Draw(im)
        def text(x,y,s,size,color,anchor='lt'):
            d.text((x,y),s,font=ImageFont.truetype('/System/Library/Fonts/PingFang.ttc',size,index=8),fill=color,anchor=anchor)
        d.rectangle((0,75,1080,317),fill='#131D2B')
        text(60,90,'捏碎以后',70,'#F7F9FC');text(56,171,'还能继续揉！',96,'#FFE073')
        text(64,287,'CODEX · 原录屏定格',24,'#B9C5D4')
        d.rounded_rectangle((60,650,1020,712),18,fill='#FFE073')
        text(540,681,action,34,'#15202E','mm')
        d.rectangle((90,1085,989,1779),fill='#FCFCFC')
        d.rectangle((0,1808,1080,1920),fill='#131D2B')
        text(540,1839,'软泥 ASMR，碎完接着捏',40,'#F7F9FC','mm')
        text(540,1894,'应用实际交互演示 · 使用已选软泥原声音效',20,'#93A3B8','mm')
        im.save(OUT/f'background-{index}.png')
    mix.run(['node',str(ROOT/'scripts/render-cheese-slime-tail.mjs')], 'renderer.log')
    mix.run(['ffmpeg','-hide_banner','-y','-f','f32le','-ar','48000','-ac','1','-i',str(OUT/'slime.f32le'),
             '-af','loudnorm=I=-20:TP=-3:LRA=7,volume=4dB,alimiter=limit=0.7943:level=false:latency=true','-ar','48000','-ac','2','-c:a','pcm_f32le',str(OUT/'slime-fx.wav')], 'slime-normalize.log')
    rate, old = wavfile.read(PRIOR/'clean-fx.wav')
    _, slime = wavfile.read(OUT/'slime-fx.wav')
    assert rate == 48000 and len(slime) == 6*rate
    point = int(28.8*rate)
    fx = np.concatenate([old[:point], slime, old[point:]])
    assert len(fx) == 39*rate
    mix.run(['ffmpeg','-hide_banner','-y','-i',str(PRIOR/'Carefree.mp3'),'-t','39',
             '-af','loudnorm=I=-28:TP=-6:LRA=7','-ar','48000','-ac','2','-c:a','pcm_f32le',str(OUT/'music-base.wav')], 'music-normalize.log')
    music=mix.decode(OUT/'music-base.wav'); t=np.arange(len(music))/rate
    windows=mix.DUCK_WINDOWS+[(29.15,34.55)]
    duck=np.maximum.reduce([mix.window(t,a,b,.2,.4) for a,b in windows])
    music*=np.power(10,-11*duck/20)[:,None]
    music*=mix.window(t,0,39,.35,1.35)[:,None]
    wavfile.write(OUT/'fx.wav',rate,fx)
    wavfile.write(OUT/'music-ducked.wav',rate,music)
    wavfile.write(OUT/'mix.wav',rate,fx+music)
    filters=("[0:v]split[a][b];[a]trim=end=28.8,setpts=PTS-STARTPTS[head];"
             "[b]trim=start=28.8:end=33,setpts=PTS-STARTPTS[end];"
             "[1:v]setpts=PTS-STARTPTS[slime];[head][slime][end]concat=n=3:v=1:a=0[all];"
             "[all][3:v]overlay=0:0:enable='gte(t,34.8)',format=yuv420p[v];"
             '[2:a]alimiter=limit=0.7943:level=false:attack=5:release=60:latency=true[aout]')
    mix.run(['ffmpeg','-hide_banner','-y','-i',str(VIDEO),'-i',str(OUT/'slime-silent.mp4'),
             '-i',str(OUT/'mix.wav'),'-loop','1','-i',str(PRIOR/'credit.png'),
             '-filter_complex_threads','2','-filter_complex',filters,'-map','[v]','-map','[aout]',
             '-c:v','libx264','-preset','fast','-crf','18','-r','30','-c:a','aac','-b:a','256k',
             '-ar','48000','-t','39','-metadata','comment='+mix.CREDIT,'-movflags','+faststart',
             str(OUT/'Codex搭子-配乐版-增加软泥揉捏.mp4')], 'final-render.log')
    (OUT/'音乐署名-发布时可复制.txt').write_text(mix.CREDIT)
    report={'duration':39,'insert_at':28.8,'insert_duration':6,
            'source':'前后沿用原录屏；中间 6 秒为应用状态机、奶酪内芯及软泥实录音效的离线交互演示。',
            'music':'Carefree，连续使用前 39 秒，软泥音效出现时压低 11 dB',
            'slime_sfx_music_rms_margin_db':float(20*np.log10(np.sqrt(np.mean(fx[point:point+6*rate]**2))/np.sqrt(np.mean(music[point:point+6*rate]**2))))}
    (OUT/'edit-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False),flush=True)


if __name__ == '__main__':
    main()
