from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = Path('/Users/lexie/Desktop/Screen Recording 2026-09-26 at 2.22.45\u202fPM.mov')
OUT = ROOT / 'artifacts/xiaohongshu/recording-edit'
OUT.mkdir(parents=True, exist_ok=True)
FONT = '/System/Library/Fonts/PingFang.ttc'
# 时间均来自用户提供的实录；只有快速轮换段做 1.25 倍速。
SHOTS = [
    dict(id='01-submit', start=5.3, end=8.7, speed=1, y=825, title=['Vibe coding，', '也需要一个搭子。'], caption='给自己做了个 Codex 捏捏搭子', focus='陪你等答案'),
    dict(id='02-asmr', start=8.7, end=14.7, speed=1, y=220, title=['模型在思考，', '我在旁边捏捏。'], caption='一点点碎裂的 ASMR，陪我熬过等待', focus='打开声音，听它慢慢碎'),
    dict(id='03-switch', start=14.7, end=19.6, speed=1, y=220, title=['等着等着，', '还可以换个口味。'], caption='奶酪、年糕、大福……想捏哪个就换哪个', focus='点击顶部「换一下」'),
    dict(id='04-cycle', start=19.6, end=23.85, speed=1.25, y=220, title=['等着等着，', '还可以换个口味。'], caption='兜了一圈，还是想捏奶酪', focus='多款捏捏，随手切换'),
    dict(id='05-reply', start=38.8, end=43.6, speed=1, y=90, title=['Codex 有回复，', '它就亮起来叫我。'], caption='轻轻的 biu，提醒我回来看看', focus='回复提醒 · 绿光 · 轻浮'),
    dict(id='06-reaction', start=45.25, end=47.15, speed=1, y=90, title=['嗯……', '还不是我想要的。'], caption='没关系，先把这口气放出来', focus='给情绪找个出口'),
    dict(id='07-burst', start=47.15, end=51.55, speed=1, y=90, title=['长按两秒，', '替我炸一下。'], caption='我炸了 😡', focus='完整保留两秒长按'),
    dict(id='08-return', start=59.0, end=63.2, speed=1, y=825, title=['捏一会儿，', '再继续改。'], caption='模型继续想，我也慢慢来', focus='我的 Codex 搭子'),
]

def run(args: list[str], log: Path) -> None:
    with log.open('w') as stream:
        subprocess.run(args, check=True, stdout=stream, stderr=subprocess.STDOUT)


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], s: str, size: int, fill: str) -> None:
    draw.text(xy, s, font=ImageFont.truetype(FONT, size), fill=fill)


def card(shot: dict) -> Path:
    im = Image.new('RGB', (1080, 1920), '#F2EFE9')
    d = ImageDraw.Draw(im)
    text(d, (60, 56), '捏一会儿  /  CODEX 搭子', 26, '#907E70')
    text(d, (60, 118), shot['title'][0], 66, '#453C36')
    text(d, (60, 200), shot['title'][1], 66, '#453C36')
    text(d, (64, 295), 'CODEX  ·  真实对话', 23, '#9C8878')
    d.rounded_rectangle((54, 329, 1026, 799), 20, fill='white', outline='#E0D8CD', width=2)
    text(d, (64, 824), '捏捏  ·  ' + shot['focus'], 25, '#907E70')
    d.rounded_rectangle((143, 873, 937, 1793), 24, fill='white', outline='#E0D8CD', width=2)
    # 同步的两个裁切窗口，不重绘或替换 Codex 的真实界面。
    f = ImageFont.truetype(FONT, 31)
    label = shot['caption'].replace(' 😡', '')
    width = d.textlength(label, font=f)
    d.text(((1080-width)/2, 1822), label, font=f, fill='#796757')
    text(d, (368, 1880), '同一段录屏 · 同步局部放大', 19, '#AE9E90')
    target = OUT / (shot['id'] + '-layout.png')
    im.save(target)
    return target


def main() -> None:
    duration = 0.0
    for s in SHOTS:
        s['output_start'] = round(duration, 6)
        s['duration'] = round((s['end']-s['start'])/s['speed'], 6)
        duration += s['duration']
        s['output_end'] = round(duration, 6)
        if '--audio-only' in sys.argv:
            continue
        layout = card(s)
        target = OUT / (s['id'] + '.mp4')
        context_y = "'if(lt(t,1.15),825,220)'" if s['id'] == '01-submit' else str(s['y'])
        filters = (
            f"[0:v]setpts=(PTS-STARTPTS)/{s['speed']},fps=30,split=2[c][p];"
            f"[c]crop=1550:740:550:{context_y},scale=960:458:flags=lanczos[context];"
            '[p]crop=706:820:2100:460,scale=780:906:flags=lanczos[pet];'
            f"[1:v]trim=duration={s['duration']},setpts=PTS-STARTPTS[base];"
            '[base][context]overlay=60:335[tmp];[tmp][pet]overlay=150:880,format=yuv420p[v];'
            f"[0:a]asetpts=PTS-STARTPTS,atempo={s['speed']},afade=t=in:d=0.012,"
            f"afade=t=out:st={max(0,s['duration']-.015)}:d=0.015[a]"
        )
        run(['ffmpeg', '-hide_banner', '-y', '-ss', str(s['start']), '-t', str(s['end']-s['start']), '-i', str(SRC),
             '-loop', '1', '-framerate', '30', '-i', str(layout), '-filter_complex_threads', '2', '-filter_complex', filters,
             '-map', '[v]', '-map', '[a]', '-t', str(s['duration']), '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
             '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-video_track_timescale', '30000', str(target)], OUT/(s['id']+'.log'))
        print(s['id'], s['duration'], '秒完成', flush=True)
    manifest = dict(source=str(SRC), duration=round(duration,6), size=[1080,1920], fps=30, shots=SHOTS, audio_advance_seconds=.8,
                    evidence='所有画面均来自用户录屏；上下窗口来自同一时间点。没有合成补拍交互。',
                    omitted='原片未见明确的点击提醒跳转和末尾揉拉，不伪造。')
    (OUT/'edit-decision-list.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    (OUT/'concat.txt').write_text(''.join(f"file '{s['id']}.mp4'\n" for s in SHOTS))
    run(['ffmpeg','-hide_banner','-y','-f','concat','-safe','0','-i',str(OUT/'concat.txt'),'-c:v','copy','-c:a','pcm_s16le',str(OUT/'assembled.mkv')],OUT/'concat.log')
    # 两个独立声纹均显示约 0.8 秒滞后；从源片稍后取音，保持实际声音而非替换配音。
    for s in SHOTS:
        run(['ffmpeg','-hide_banner','-y','-ss',str(s['start']+.8),'-t',str(s['end']-s['start']),'-i',str(SRC),'-vn',
             '-af',f"atempo={s['speed']},apad=whole_dur={s['duration']},atrim=duration={s['duration']},afade=t=in:d=0.012,afade=t=out:st={s['duration']-.015}:d=0.015",
             '-ar','48000','-ac','1','-c:a','pcm_s16le',str(OUT/(s['id']+'-aligned.wav'))], OUT/(s['id']+'-audio.log'))
    (OUT/'audio-concat.txt').write_text(''.join(f"file '{s['id']}-aligned.wav'\n" for s in SHOTS))
    run(['ffmpeg','-hide_banner','-y','-f','concat','-safe','0','-i',str(OUT/'audio-concat.txt'),'-c:a','pcm_s16le',str(OUT/'aligned.wav')],OUT/'audio-concat.log')
    run(['ffmpeg','-hide_banner','-y','-i',str(OUT/'assembled.mkv'),'-i',str(OUT/'aligned.wav'),'-map','0:v','-map','1:a','-c:v','copy',
         '-af','highpass=f=95,afftdn=nr=7:nf=-47,agate=threshold=0.004:ratio=1.5:attack=5:release=140:range=0.3,loudnorm=I=-20:TP=-2:LRA=9,volume=3dB,alimiter=limit=0.794:level=false,afade=t=out:st=32.6:d=0.4',
         '-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart','-t',str(duration),str(OUT/'Codex搭子-真实录屏版-v2.mp4')],OUT/'final-mux.log')
    print('成片完成',duration,flush=True)

if __name__ == '__main__':
    main()
