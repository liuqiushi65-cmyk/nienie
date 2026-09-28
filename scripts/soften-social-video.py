from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'artifacts/xiaohongshu/slime-tail'


def main() -> None:
    rate, fx = wavfile.read(OUT/'fx.wav')
    music_rate, music = wavfile.read(OUT/'music-ducked.wav')
    assert rate == music_rate == 48000 and fx.shape == music.shape
    t = np.arange(len(fx))/rate
    # 只降低碎壳与长按蓄力段；biu、哼声和新增软泥段沿用此前的音效电平。
    reduction = np.zeros(len(fx))
    for start, end in [(2.80, 8.70), (24.30, 26.36)]:
        ramp = np.minimum(np.clip((t-start)/.025, 0, 1), np.clip((end-t)/.025, 0, 1))
        reduction = np.maximum(reduction, ramp*2)
    fx *= np.power(10, -reduction/20)[:, None]
    music *= 10**(-2/20)
    wavfile.write(OUT/'gentler-mix.wav',rate,fx+music)
    source = OUT/'Codex搭子-配乐版-增加软泥揉捏.mp4'
    target = OUT/'Codex搭子-配乐版-轻柔音量.mp4'
    with (OUT/'gentler-render.log').open('w') as log:
        subprocess.run(['ffmpeg','-hide_banner','-y','-i',str(source),'-i',str(OUT/'gentler-mix.wav'),
                        '-map','0:v:0','-map','1:a:0','-map_metadata','0','-c:v','copy',
                        '-af','alimiter=limit=0.7943:level=false:attack=5:release=60:latency=true',
                        '-c:a','aac','-b:a','256k','-ar',str(rate),'-t',str(len(fx)/rate),
                        '-movflags','+faststart',str(target)],check=True,stdout=log,stderr=subprocess.STDOUT)
    (OUT/'gentler-manifest.json').write_text(json.dumps(dict(source=str(source),output=str(target),
        duration=len(fx)/rate,music_gain_db=-2,crack_gain_db=-2,
        crack_windows=[[2.80,8.70],[24.30,26.36]],video='原视频流直接复制'),ensure_ascii=False,indent=2))
    print(target)


if __name__ == '__main__':
    main()
