from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import signal, ndimage
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/xiaohongshu/carefree-mix'
VIDEO = ROOT / 'artifacts/xiaohongshu/portrait-emphasis/Codex搭子-竖版重点强化.mp4'
RATE, DURATION = 48000, 33
# 以画面操作与此前校准的音画时间为准，剔除操作以外的环境音、键鼠杂音。
FX_WINDOWS = [(2.85, 3.75), (4.25, 8.65), (18.755, 19.20), (24.32, 28.05)]
DUCK_WINDOWS = [(2.60, 8.95), (18.50, 19.6), (24.05, 28.4)]
CREDIT = ('"Carefree" by Kevin MacLeod (incompetech.com)\n'
          'Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037\n'
          'Licensed under Creative Commons: By Attribution 4.0 License\n'
          'https://creativecommons.org/licenses/by/4.0/\n'
          'Changes: excerpted, faded and mixed with recorded sound effects.\n')


def run(args: list[str], log: str) -> None:
    with (OUT/log).open('w') as f:
        subprocess.run(args, check=True, stdout=f, stderr=subprocess.STDOUT)


def decode(path: Path) -> np.ndarray:
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-t', str(DURATION),
                        '-ar', str(RATE), '-ac', '2', '-f', 'f32le', '-'], capture_output=True, check=True)
    a = np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2).copy()
    return np.pad(a, ((0, max(0, RATE*DURATION-len(a))), (0, 0)))[:RATE*DURATION]


def window(t: np.ndarray, start: float, end: float, attack: float, release: float) -> np.ndarray:
    return np.minimum(np.clip((t-start)/attack, 0, 1), np.clip((end-t)/release, 0, 1))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    original = decode(VIDEO)
    t = np.arange(len(original))/RATE
    gate = np.maximum.reduce([window(t, a, b, .015, .060) for a, b in FX_WINDOWS])
    cleaned = np.zeros_like(original)
    bandpass = signal.butter(2, [120, 10000], btype='bandpass', fs=RATE, output='sos')
    for ch in range(2):
        a = signal.sosfiltfilt(bandpass, original[:, ch])
        _, times, spectrum = signal.stft(a, fs=RATE, nperseg=1024, noverlap=768)
        inactive = np.ones(len(times), dtype=bool)
        for start, end in FX_WINDOWS:
            inactive &= ~((times>start-.1)&(times<end+.1))
        # 从非交互段估计稳态底噪；保留至少 25% 振幅，避免抹掉细小碎裂纹理。
        noise = np.percentile(np.abs(spectrum[:, inactive]), 25, axis=1)[:, None]
        gain = np.clip(1-1.8*noise/(np.abs(spectrum)+1e-10), .25, 1)
        gain = ndimage.gaussian_filter(gain, sigma=(.8, .4))
        _, a = signal.istft(spectrum*gain, fs=RATE, nperseg=1024, noverlap=768)
        cleaned[:, ch] = a[:len(original)]*gate
    wavfile.write(OUT/'clean-fx.wav', RATE, cleaned)
    # 先统一配乐底层响度，再按事件缓慢让位，避免跟随每个碎裂颗粒抽吸。
    run(['ffmpeg', '-hide_banner', '-y', '-i', str(OUT/'Carefree.mp3'), '-t', str(DURATION),
         '-af', 'loudnorm=I=-28:TP=-6:LRA=7', '-ar', str(RATE), '-ac', '2', '-c:a', 'pcm_f32le',
         str(OUT/'music-base.wav')], 'music-normalize.log')
    music = decode(OUT/'music-base.wav')
    duck = np.maximum.reduce([window(t, a, b, .20, .40) for a, b in DUCK_WINDOWS])
    music *= np.power(10, -11*duck/20)[:, None]
    music *= window(t, 0, 33, .35, 1.35)[:, None]
    wavfile.write(OUT/'music-ducked.wav', RATE, music)
    wavfile.write(OUT/'mix.wav', RATE, cleaned+music)
    # 片尾直接标明音乐来源与许可；发布时也可复制同目录署名文本。
    credit = Image.new('RGBA', (1080, 1920))
    d = ImageDraw.Draw(credit)
    d.rectangle((0, 1874, 1080, 1920), fill='#131D2B')
    font = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', 18, index=2)
    for y, line in [(1885, 'Music: Carefree · Kevin MacLeod · incompetech.com'),
                    (1907, 'CC BY 4.0 · creativecommons.org/licenses/by/4.0/ · 节选 / 混音')]:
        d.text((540, y), line, anchor='mm', fill='#B9C5D4', font=font)
    credit.save(OUT/'credit.png')
    run(['ffmpeg', '-hide_banner', '-y', '-i', str(VIDEO), '-i', str(OUT/'mix.wav'),
         '-loop', '1', '-i', str(OUT/'credit.png'), '-filter_complex_threads', '2',
         '-filter_complex', "[0:v][2:v]overlay=0:0:enable='gte(t,28.8)',format=yuv420p[v];"
         '[1:a]alimiter=limit=0.7943:level=false:attack=5:release=60:latency=true[a]',
         '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
         '-r', '30', '-c:a', 'aac', '-b:a', '256k', '-ar', str(RATE), '-t', str(DURATION),
         '-metadata', 'comment='+CREDIT, '-movflags', '+faststart',
         str(OUT/'Codex搭子-竖版-Carefree配乐.mp4')], 'render.log')
    (OUT/'音乐署名-发布时可复制.txt').write_text(CREDIT)
    report = dict(duration=DURATION, music='Carefree — Kevin MacLeod', source_url=
                  'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3',
                  music_source_range=[0,33], fx_windows=FX_WINDOWS, duck_windows=DUCK_WINDOWS,
                  duck_db=11, original_video=str(VIDEO), credit=CREDIT,
                  processing='原录屏音效，空档静音，120–10000 Hz 带通及温和频谱降噪；音乐自动让位。')
    report['fx_music_rms_margin_db'] = {}
    for name, start, end in [('crack',4.5,8.4), ('biu',18.78,19.10), ('hold_hmph',24.5,27.8)]:
        s=slice(int(start*RATE),int(end*RATE))
        report['fx_music_rms_margin_db'][name] = float(20*np.log10(np.sqrt(np.mean(cleaned[s]**2))/np.sqrt(np.mean(music[s]**2))))
    (OUT/'mix-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report['fx_music_rms_margin_db'], ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
