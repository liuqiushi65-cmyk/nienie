from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import ndimage, signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
STEMS = ROOT/'artifacts/xiaohongshu/slime-tail'
OUT = ROOT/'artifacts/xiaohongshu/codex-corner'
SOURCE = OUT/'Codex搭子-窗口角落强调版.mp4'


def main() -> None:
    rate, fx = wavfile.read(STEMS/'fx.wav')
    music_rate, music = wavfile.read(STEMS/'music-ducked.wav')
    assert rate == music_rate == 48000 and fx.shape == music.shape
    t = np.arange(len(fx))/rate
    mask = np.zeros(len(fx))
    for start, end in [(2.80,8.70),(24.30,26.36)]:
        ramp = np.minimum(np.clip((t-start)/.025,0,1),np.clip((end-t)/.025,0,1))
        mask = np.maximum(mask,ramp)
    # 重建上一版轻柔分轨，避免从已混音音乐中切除高频。
    fx *= np.power(10,-2*mask/20)[:,None]
    music *= 10**(-2/20)
    low = signal.sosfiltfilt(signal.butter(2,2600,fs=rate,output='sos'),fx,axis=0)
    # 渐进高频搁架：低频主体保留，尖锐高频最多约衰减 8.4 dB。
    warm = .38*fx+.62*low
    warm = signal.sosfiltfilt(signal.butter(2,8000,fs=rate,output='sos'),warm,axis=0)
    # 双声道联动，提前约 15 ms 让开爆点，平滑增益而不削平波形。
    envelope = ndimage.maximum_filter1d(np.max(np.abs(warm),axis=1),size=97)
    over = np.maximum(0,20*np.log10(envelope+1e-12)+14)
    reduction = over*(1-1/2.5)
    reduction = ndimage.gaussian_filter1d(ndimage.maximum_filter1d(reduction,size=1441),sigma=240)
    warm *= np.power(10,-reduction/20)[:,None]
    final_fx = fx*(1-mask[:,None])+warm*mask[:,None]
    wavfile.write(OUT/'rounded-crack-fx.wav',rate,final_fx.astype(np.float32))
    wavfile.write(OUT/'rounded-crack-mix.wav',rate,(final_fx+music).astype(np.float32))
    target = OUT/'Codex搭子-碎裂声柔化版.mp4'
    with (OUT/'rounded-crack-render.log').open('w') as log:
        subprocess.run(['ffmpeg','-hide_banner','-y','-i',str(SOURCE),'-i',str(OUT/'rounded-crack-mix.wav'),
                        '-map','0:v:0','-map','1:a:0','-map_metadata','0','-c:v','copy',
                        '-af','alimiter=limit=0.7943:level=false:attack=5:release=60:latency=true',
                        '-c:a','aac','-b:a','256k','-ar',str(rate),'-t','39','-movflags','+faststart',str(target)],
                       check=True,stdout=log,stderr=subprocess.STDOUT)
    # 验证处理对象：提示、人声、软泥分轨逐样本保持不变。
    for start,end in [(18.5,19.3),(26.37,28.1),(28.8,34.8)]:
        sl=slice(int(start*rate),int(end*rate));assert np.array_equal(final_fx[sl],fx[sl])
    report=dict(source=str(SOURCE),output=str(target),duration=39,
                processing='仅碎裂段：2.6 kHz 渐进高频衰减、8 kHz 低通、-14 dBFS/2.5:1 爆点压缩；音乐沿用轻柔版',
                other_fx_unchanged=True)
    bands={}
    sl=slice(int(4.5*rate),int(8.4*rate))
    for name,band in [('body',[200,2000]),('sharp',[3000,10000])]:
        sos=signal.butter(3,band,btype='bandpass',fs=rate,output='sos')
        before=signal.sosfiltfilt(sos,fx[sl],axis=0);after=signal.sosfiltfilt(sos,final_fx[sl],axis=0)
        bands[name]=float(20*np.log10(np.sqrt(np.mean(after**2))/np.sqrt(np.mean(before**2))))
    report['crack_band_change_db']=bands
    (OUT/'rounded-crack-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False),flush=True)


if __name__ == '__main__':
    main()
