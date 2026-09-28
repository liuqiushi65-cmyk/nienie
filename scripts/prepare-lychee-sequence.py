from __future__ import annotations

"""从已验收样片提取透明序列；全部产物落在被忽略的 artifacts 中。"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import PchipInterpolator

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/lychee-sequence'
SIZE = 448


def cutout(rgb, index):
    # 固定机位的单物体：颜色种子覆盖红壳，凸包内部保留白色内芯。
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[:h, :w]
    red = (rgb[:, :, 0].astype(float) - rgb[:, :, 1] > 25)
    red &= (xx > 200) & (xx < 1010) & (yy > 90) & (yy < 652)
    _, labels, stats, _ = cv2.connectedComponentsWithStats(red.astype(np.uint8))
    red = np.isin(labels, np.where(stats[:, cv2.CC_STAT_AREA] > 100)[0][1:])
    points = np.column_stack(np.where(red)[::-1])
    hull = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(hull, cv2.convexHull(points), 1)
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    mask[hull > 0] = cv2.GC_PR_FGD
    mask[cv2.erode(hull, np.ones((31, 31), np.uint8)) > 0] = cv2.GC_FGD
    mask[red] = cv2.GC_FGD
    mask[cv2.dilate(hull, np.ones((5, 5), np.uint8)) == 0] = cv2.GC_BGD
    if index < 87:
        boundary = cv2.erode(hull, np.ones((41, 41), np.uint8)) == 0
        mask[boundary & (yy > 400) & (rgb[:, :, 0].astype(float) - rgb[:, :, 1] < 22)] = cv2.GC_BGD
    if index >= 87:
        # 样片底部与灰色台面同色，手工关键帧限定接触边界，避免留下灰底裙边。
        boundaries = {
            88: [(230,480),(269,509),(290,542),(328,567),(381,596),(445,606),(516,619),(590,628),(675,632),(737,636),(797,624),(851,606),(895,582),(927,555),(953,510),(989,450)],
            89: [(213,495),(267,524),(286,552),(329,584),(382,608),(444,612),(516,627),(590,636),(675,640),(737,641),(797,630),(851,615),(895,603),(933,564),(967,512),(997,450)],
            91: [(248,486),(283,511),(300,551),(338,573),(386,607),(450,617),(520,630),(600,634),(675,640),(740,640),(795,630),(846,616),(897,600),(928,566),(947,514),(975,450)],
            100: [(273,486),(295,526),(312,555),(350,574),(390,607),(455,620),(525,630),(606,634),(680,640),(738,639),(793,628),(839,617),(889,602),(916,574),(934,524),(953,458)],
            121: [(302,493),(316,540),(332,567),(364,594),(401,613),(465,622),(535,630),(610,634),(680,640),(735,639),(787,628),(832,618),(878,605),(903,583),(920,547),(934,487)],
        }
        keys = sorted(boundaries)
        lo = max([k for k in keys if k <= index] or [keys[0]])
        hi = min([k for k in keys if k >= index] or [keys[-1]])
        mix = 0 if lo == hi else (index - lo) / (hi - lo)
        points = np.array(boundaries[lo]) * (1 - mix) + np.array(boundaries[hi]) * mix
        floor = PchipInterpolator(points[:, 0], points[:, 1], extrapolate=False)(xx[0])
        mask[yy > np.nan_to_num(floor, nan=470)[None, :]] = cv2.GC_BGD
    cv2.setRNGSeed(41)
    cv2.grabCut(rgb, mask, None, np.zeros((1, 65)), np.zeros((1, 65)), 4, cv2.GC_INIT_WITH_MASK)
    binary = np.isin(mask, [cv2.GC_FGD, cv2.GC_PR_FGD]).astype(np.uint8)
    # 只保留主体，桌面碎屑和投影不成为悬浮窗口的点击区。
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary)
    binary = (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    alpha = cv2.GaussianBlur(binary.astype(float), (5, 5), .7)
    alpha = np.clip((alpha - .08) / .84, 0, 1)
    rgba = np.dstack([rgb, np.uint8(alpha * 255)])
    return Image.fromarray(rgba).crop((200, -70, 1060, 790)).resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def review(frames):
    sheet = Image.new('RGB', (SIZE * len(frames), SIZE * 3))
    for row, color in enumerate(['#181e29', '#fff9f3', '#aebcbb']):
        for col, (label, frame) in enumerate(frames):
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
    sheet.save(OUT / 'alpha-review.jpg', quality=94)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    # 略过片头静止展示，保留初始完整壳；终点取稳定软泥帧。
    indices = [1, 53, 80, 120] if args.preview else [1] + list(range(43, 122))
    images = []
    for index in indices:
        rgb = np.array(Image.open(ROOT / f'artifacts/lychee-video/frame-{index:03d}.png').convert('RGB'))
        frame = cutout(rgb, index)
        images.append(frame)
        prefix = 'preview' if args.preview else 'frame'
        frame.save(OUT / f'{prefix}-{len(images)-1:03d}.png')
        print(f'{len(images)}/{len(indices)}', flush=True)
    review([(str(indices[i]), images[i]) for i in ([0, 1, 2, 3] if args.preview else [0, 15, 38, 79])])
    if args.preview:
        return
    pages = []
    for start in range(0, len(images), 16):
        atlas = Image.new('RGBA', (SIZE * 4, SIZE * 4))
        for slot, frame in enumerate(images[start:start + 16]):
            atlas.paste(frame, ((slot % 4) * SIZE, (slot // 4) * SIZE))
        name = f'atlas-{len(pages)}.png'
        atlas.save(OUT / name, optimize=True)
        pages.append(name)
    (OUT / 'manifest.json').write_text(json.dumps({'size': SIZE, 'columns': 4, 'perPage': 16,
        'count': len(images), 'pages': pages, 'sourceFrames': indices}, indent=2) + '\n')


if __name__ == '__main__':
    main()
