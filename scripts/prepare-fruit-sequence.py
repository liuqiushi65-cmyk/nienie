from __future__ import annotations

"""将本批次已检查的固定机位水果视频帧转成透明图集，不调用生成服务。"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import binary_fill_holes

ROOT = Path(__file__).resolve().parents[1]
SIZE = 448
SPECS = {
    'peach': {'start': 38, 'end': 125, 'crop': (190, -75, 1090, 825)},
    'orange': {'start': 43, 'end': 127, 'crop': (190, -75, 1090, 825)},
    'mangosteen': {'start': 38, 'end': 125, 'crop': (230, -45, 1050, 775)},
}


def floor_curve(index, width, fruit="mangosteen"):
    # 本批山竹白泥与台面接近同色，按实际源帧标记接触线并连续插值。
    boundaries = {
        1: [(410,470),(465,520),(510,548),(570,560),(630,564),(700,558),(760,536),(815,493),(860,435),(910,410)],
        54: [(410,475),(465,522),(510,550),(570,566),(630,570),(700,565),(760,548),(815,511),(860,466),(910,425)],
        79: [(410,480),(465,531),(510,553),(570,574),(630,578),(680,606),(740,606),(790,575),(850,544),(910,478)],
        100: [(410,480),(465,541),(510,569),(570,583),(630,585),(680,609),(740,607),(790,581),(850,555),(910,481)],
        125: [(390,490),(440,557),(510,576),(570,589),(630,590),(680,605),(740,605),(800,589),(865,566),(930,505)],
    }
    if fruit == 'peach':
        boundaries = {
            75: [(310,520),(380,572),(440,600),(530,623),(620,630),(690,647),(760,644),(830,621),(905,583),(990,520)],
            100: [(290,510),(370,587),(440,616),(530,638),(620,642),(690,661),(760,659),(850,641),(920,601),(995,510)],
            125: [(250,500),(300,586),(360,618),(430,639),(540,647),(660,650),(780,655),(870,632),(970,610),(1040,530)],
        }
    keys = sorted(boundaries)
    lo = max([k for k in keys if k <= index] or [keys[0]])
    hi = min([k for k in keys if k >= index] or [keys[-1]])
    mix = 0 if lo == hi else (index - lo) / (hi - lo)
    points = np.array(boundaries[lo]) * (1 - mix) + np.array(boundaries[hi]) * mix
    return np.nan_to_num(PchipInterpolator(points[:, 0], points[:, 1], extrapolate=False)(np.arange(width)), nan=400)


def cutout(rgb, crop, fruit, index):
    cv2.setNumThreads(1)
    # 原片是固定灰底；彩色壳和高于背景亮度的白色泥共同提供前景种子。
    small = cv2.resize(rgb, None, fx=.5, fy=.5, interpolation=cv2.INTER_AREA)
    h, w = small.shape[:2]
    values = small.astype(float)
    spread = values.max(axis=2) - values.min(axis=2)
    background = np.median(np.concatenate([values[:, :55], values[:, -55:]], axis=1), axis=1)
    bright = values.mean(axis=2) - background.mean(axis=1)[:, None]
    seed = ((spread > 19) | (bright > 24)).astype(np.uint8)
    seed[:25] = 0
    seed[:, :90] = 0
    seed[:, -90:] = 0
    seed[-18:] = 0
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(seed)
    if count < 2:
        raise ValueError('未找到主体，停止，不输出空素材')
    # 山竹裂壳会被白泥分隔成多个色块，不能只取最大的色块来限定整个主体。
    seed = (np.isin(labels, np.flatnonzero(stats[:, cv2.CC_STAT_AREA] > 150)[1:]) if fruit == 'mangosteen' else labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    points = np.column_stack(np.where(seed)[::-1])
    hull = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(hull, cv2.convexHull(points), 1)
    mask = np.full((h, w), cv2.GC_BGD, np.uint8)
    mask[cv2.dilate(hull, np.ones((15, 15), np.uint8)) > 0] = cv2.GC_PR_BGD
    mask[hull > 0] = cv2.GC_PR_FGD
    mask[cv2.erode(hull, np.ones((17, 17), np.uint8)) > 0] = cv2.GC_FGD
    mask[cv2.erode(seed, np.ones((3, 3), np.uint8)) > 0] = cv2.GC_FGD
    yy, xx = np.mgrid[:h, :w]
    if fruit in ('peach', 'orange'):
        # 只限制外缘，内芯的白色反光仍属于前景。
        boundary = cv2.erode(hull, np.ones((25, 25), np.uint8)) == 0
        mask[boundary & (yy > 170) & (values[:, :, 0] - values[:, :, 1] < (20 if fruit == 'peach' else 40))] = cv2.GC_BGD
    else:
        floor = floor_curve(index, rgb.shape[1])[::2] / 2
        if index >= 65:
            mask[(xx > 300) & (xx < 398) & (yy > 210) & (yy < floor[None, :] - 2)] = cv2.GC_FGD
        mask[yy > floor[None, :]] = cv2.GC_BGD
    cv2.setRNGSeed(41)
    cv2.grabCut(small, mask, None, np.zeros((1, 65)), np.zeros((1, 65)), 4, cv2.GC_INIT_WITH_MASK)
    binary = np.isin(mask, [cv2.GC_FGD, cv2.GC_PR_FGD]).astype(np.uint8)
    if fruit in ('peach', 'orange'):
        boundary = cv2.erode(binary, np.ones((41, 41), np.uint8)) == 0
        binary[boundary & (yy > 210) & (values[:, :, 0] - values[:, :, 1] < (20 if fruit == 'peach' else 40))] = 0
    if fruit == 'peach' and index >= 75:
        binary[yy > (floor_curve(index, rgb.shape[1], fruit)[::2] / 2)[None, :]] = 0
    binary = binary_fill_holes(binary).astype(np.uint8)
    _, labels, stats, _ = cv2.connectedComponentsWithStats(binary)
    binary = (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.float32)
    alpha = cv2.resize(binary, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LINEAR)
    alpha = cv2.GaussianBlur(alpha, (5, 5), .65)
    alpha = np.clip((alpha - .12) / .76, 0, 1)
    frame = Image.fromarray(np.dstack([rgb, np.uint8(alpha * 255)]))
    return frame.crop(crop).resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def review(images, output):
    sheet = Image.new('RGB', (SIZE * len(images), SIZE * 3))
    for row, color in enumerate(['#181e29', '#fff9f3', '#aebcbb']):
        for col, (label, frame) in enumerate(images):
            tile = Image.new('RGBA', (SIZE, SIZE), color)
            if row == 2:
                draw = ImageDraw.Draw(tile)
                for y in range(0, SIZE, 24):
                    for x in range(0, SIZE, 24):
                        if (x // 24 + y // 24) % 2:
                            draw.rectangle((x, y, x + 23, y + 23), fill='#dfe6e3')
            tile.alpha_composite(frame)
            ImageDraw.Draw(tile).text((12, 12), label, fill='#7b8587')
            sheet.paste(tile.convert('RGB'), (col * SIZE, row * SIZE))
    sheet.save(output / 'alpha-review.jpg', quality=94)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fruit', required=True, choices=SPECS)
    parser.add_argument('--preview', action='store_true')
    args = parser.parse_args()
    spec = SPECS[args.fruit]
    source = ROOT / 'artifacts/fruit-expansion' / args.fruit / 'frames'
    out = ROOT / f'artifacts/{args.fruit}-sequence'
    out.mkdir(parents=True, exist_ok=True)
    indices = [1] + np.rint(np.linspace(spec['start'], spec['end'], 79)).astype(int).tolist()
    if args.preview:
        indices = [indices[i] for i in [0, 15, 38, 79]]
    images = []
    for i, source_index in enumerate(indices):
        rgb = np.array(Image.open(source / f'frame-{source_index:03d}.png').convert('RGB'))
        frame = cutout(rgb, spec['crop'], args.fruit, source_index)
        alpha = np.array(frame)[:, :, 3]
        if np.any(alpha[[0, -1], :]) or np.any(alpha[:, [0, -1]]):
            raise ValueError(f'{args.fruit} 源第 {source_index} 帧触及裁剪边界')
        frame.save(out / f'{"preview" if args.preview else "frame"}-{i:03d}.png')
        images.append(frame)
        print(f'{args.fruit} {i + 1}/{len(indices)}', flush=True)
    picks = list(range(4)) if args.preview else [0, 15, 38, 79]
    review([(str(indices[i]), images[i]) for i in picks], out)
    if args.preview:
        return
    pages = []
    for start in range(0, len(images), 16):
        atlas = Image.new('RGBA', (SIZE * 4, SIZE * 4))
        for slot, frame in enumerate(images[start:start + 16]):
            atlas.paste(frame, ((slot % 4) * SIZE, (slot // 4) * SIZE))
        name = f'atlas-{len(pages)}.png'
        atlas.save(out / name, optimize=True)
        pages.append(name)
    (out / 'manifest.json').write_text(json.dumps({'size': SIZE, 'columns': 4, 'perPage': 16,
        'count': len(images), 'pages': pages, 'sourceFrames': indices, 'crop': spec['crop']}, indent=2) + '\n')


if __name__ == '__main__':
    main()
