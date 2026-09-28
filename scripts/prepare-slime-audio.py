from __future__ import annotations

"""从用户选中的 A 试听段截取软泥采样，保持原速原调，不调用服务。"""
import base64
import hashlib
import json
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'artifacts/slime-sound-candidates/A-slow-knead.wav'
OUT = ROOT / 'artifacts/slime-audio'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(SOURCE)) as audio:
        assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
        rate = audio.getframerate()
        samples = np.frombuffer(audio.readframes(audio.getnframes()), dtype='<i2').astype(float) / 32768
    assert len(samples) >= rate * 12
    result = {'rate': rate, 'clips': {}, 'source': 'https://freesound.org/people/breiti/sounds/587848/',
              'author': 'breiti', 'license': 'CC0', 'selectedSourceSHA256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'cuts': {}}
    previews = []
    for kind, duration in [('gel', .34), ('stretch', .48), ('fold', .38)]:
        result['clips'][kind] = []
        result['cuts'][kind] = []
        for variant in range(6):
            # 每个变体来自不同的时间区间，在区间内避开静音段。
            candidates = np.arange(.15 + variant * 1.8, 1.15 + variant * 1.8, .04)
            length = round(duration * rate)
            start = max(candidates, key=lambda t: np.mean(samples[round(t*rate):round(t*rate)+length]**2))
            clip = samples[round(start*rate):round(start*rate)+length].copy()
            clip[:round(.008*rate)] *= np.linspace(0, 1, round(.008*rate))
            clip[-round(.025*rate):] *= np.linspace(1, 0, round(.025*rate))
            pcm = np.rint(np.clip(clip, -1, 1-1/32768)*32768).astype('<i2').tobytes()
            result['clips'][kind].append(base64.b64encode(pcm).decode('ascii'))
            result['cuts'][kind].append({'startInAudition': round(float(start), 3), 'duration': duration})
            with wave.open(str(OUT / f'{kind}-{variant}.wav'), 'wb') as audio:
                audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed')); audio.writeframes(pcm)
            if variant < 3:
                previews.extend([pcm, bytes(round(.2*rate)*2)])
    (OUT / 'samples.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    with wave.open(str(OUT / 'applied-preview.wav'), 'wb') as audio:
        audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed')); audio.writeframes(b''.join(previews))
    print('已输出三种动作各六个实录片段；PCM 数据和试听位于 artifacts/slime-audio/')


if __name__ == '__main__':
    main()
