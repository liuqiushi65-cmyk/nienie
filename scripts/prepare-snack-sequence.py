from __future__ import annotations

"""将已确认的第二版点心视频转成透明序列；不上传或调用生成服务。"""
import argparse
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.ndimage import binary_fill_holes

ROOT = Path(__file__).resolve().parents[1]
SIZE = 448
SPECS = {
    'egg-tart': {'start': 24, 'end': 180, 'crop': (-60, -310, 1340, 1090)},
    'cheese': {'start': 28, 'end': 200, 'crop': (160, -140, 1110, 810)},
    'mochi': {'start': 30, 'end': 216, 'crop': (100, -170, 1180, 910),
              'source': 'artifacts/smiling-mochi/revision-2/source.mp4'},
    'daifuku': {'start': 66, 'end': 305, 'crop': (160, -90, 1120, 870),
                'source': 'artifacts/daifuku/revision-2/source.mp4'},
}


def daifuku_body(index, shape):
    # 同色白皮无法只靠颜色区分：按已验收源片的主体轮廓给 GrabCut 空间先验。
    # 只约束主体，零散脱落在外的粉末不强行并入；关键帧之间连续插值。
    contours = {
        0: [(624,224),(698,232),(760,278),(800,322),(822,370),(828,422),(804,484),(750,522),(674,548),(588,550),(518,538),(458,518),(432,484),(422,442),(422,396),(436,354),(466,304),(536,256)],
        109: [(624,246),(707,254),(772,287),(817,330),(835,383),(843,436),(815,497),(760,542),(681,559),(588,558),(509,545),(450,525),(422,486),(407,442),(407,397),(430,355),(473,309),(543,268)],
        179: [(612,253),(686,258),(766,281),(822,318),(857,372),(873,432),(854,509),(802,550),(712,566),(610,576),(516,570),(432,559),(397,532),(369,487),(351,426),(368,374),(430,314),(500,276)],
        305: [(620,308),(670,280),(758,327),(847,336),(934,359),(965,415),(1028,486),(994,544),(908,578),(780,619),(676,630),(570,614),(445,613),(344,568),(274,546),(251,475),(291,408),(409,325)],
    }
    keys = sorted(contours)
    lo = max([k for k in keys if k <= index] or [keys[0]])
    hi = min([k for k in keys if k >= index] or [keys[-1]])
    mix = 0 if lo == hi else (index-lo)/(hi-lo)
    points = (np.array(contours[lo])*(1-mix) + np.array(contours[hi])*mix) / 2
    body = np.zeros(shape, np.uint8)
    cv2.fillPoly(body, [np.rint(points).astype(np.int32)], 1)
    return body


def cutout(rgb, crop, material=None, index=None):
    cv2.setNumThreads(1)
    small = cv2.resize(rgb, None, fx=.5, fy=.5, interpolation=cv2.INTER_AREA)
    values = small.astype(float)
    warmth = values[:, :, 0] - values[:, :, 2]
    seed = (warmth > 24).astype(np.uint8)
    if material in ('mochi', 'daifuku'):
        # 年糕后段白芯延伸到外缘，不能沿用只保留暖色边缘的蛋挞规则。
        background = np.median(np.concatenate([values[:, :50], values[:, -50:]], axis=1), axis=1)
        bright = values.mean(axis=2) - background.mean(axis=1)[:, None]
        seed = ((warmth > 18) | (bright > 24)).astype(np.uint8)
        if material == 'daifuku':
            # 中性深色豆粒也属于实体；与灰色台面阴影保持明显亮度差。
            seed[bright < -60] = 1
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(seed)
    if count < 2:
        raise ValueError('未找到点心主体，停止导出')
    seed = (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    if seed[[0, -1], :].any() or seed[:, [0, -1]].any():
        raise ValueError('主体触及源画面边缘，不能用透明留白掩盖截断')
    # 奶油的白色高光由封闭轮廓补全；避免把暖色碎屑和灰色台面带入主体。
    body = binary_fill_holes(seed).astype(np.uint8)
    guided = material == 'daifuku' and index is not None
    if guided:
        body = daifuku_body(index, seed.shape)
    mask = np.full(seed.shape, cv2.GC_BGD, np.uint8)
    mask[cv2.dilate(body, np.ones((9, 9), np.uint8)) > 0] = cv2.GC_PR_BGD
    mask[body > 0] = cv2.GC_PR_FGD
    mask[cv2.erode(body, np.ones((5, 5), np.uint8)) > 0] = cv2.GC_FGD
    if guided:
        mask[:] = cv2.GC_BGD
        mask[cv2.dilate(body, np.ones((17, 17), np.uint8)) > 0] = cv2.GC_PR_BGD
        mask[body > 0] = cv2.GC_PR_FGD
        mask[cv2.erode(body, np.ones((21, 21), np.uint8)) > 0] = cv2.GC_FGD
    cv2.setRNGSeed(41)
    cv2.grabCut(small, mask, None, np.zeros((1, 65)), np.zeros((1, 65)), 3, cv2.GC_INIT_WITH_MASK)
    binary = np.isin(mask, [cv2.GC_FGD, cv2.GC_PR_FGD]).astype(np.uint8)
    boundary = cv2.erode(binary, np.ones((25, 25), np.uint8)) == 0
    if guided:
        pass
    elif material == 'daifuku':
        binary[boundary & (warmth < 14) & (bright < 22) & (bright > -60)] = 0
    elif material == 'mochi':
        binary[boundary & (warmth < 14) & (bright < 22)] = 0
    else:
        binary[boundary & (warmth < 32)] = 0
    binary = binary_fill_holes(binary).astype(np.uint8)
    _, labels, stats, _ = cv2.connectedComponentsWithStats(binary)
    binary = (labels == 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])).astype(np.float32)
    alpha = cv2.resize(binary, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_LINEAR)
    alpha = cv2.GaussianBlur(alpha, (5, 5), .65)
    alpha = np.clip((alpha - .12) / .76, 0, 1)
    return Image.fromarray(np.dstack([rgb, np.uint8(alpha * 255)])).crop(crop).resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--snack', required=True, choices=SPECS)
    parser.add_argument('--preview', action='store_true')
    args = parser.parse_args()
    spec = SPECS[args.snack]
    source = ROOT / spec.get('source', f'artifacts/snack-expansion/revision-2/{args.snack}/source.mp4')
    out = ROOT / f'artifacts/{args.snack}-sequence'
    out.mkdir(parents=True, exist_ok=True)
    # 完整原点后直接进入碎裂，保持源帧严格递增，不逐帧重定位。
    indices = [0] + np.rint(np.linspace(spec['start'], spec['end'], 79)).astype(int).tolist()
    if args.preview:
        indices = [indices[i] for i in [0, 15, 38, 79]]
    cap = cv2.VideoCapture(str(source))
    images = []
    for i, index in enumerate(indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, bgr = cap.read()
        if not ok:
            raise ValueError(f'无法读取源帧 {index}')
        frame = cutout(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), spec['crop'], material=args.snack, index=index)
        alpha = np.array(frame)[:, :, 3]
        if alpha[[0, -1], :].any() or alpha[:, [0, -1]].any():
            raise ValueError(f'源帧 {index} 触及图集边缘')
        frame.save(out / f'{"preview" if args.preview else "frame"}-{i:03d}.png')
        images.append(frame)
        print(f'{args.snack} {i + 1}/{len(indices)}', flush=True)
    cap.release()
    helper_spec = importlib.util.spec_from_file_location('fruit', ROOT / 'scripts/prepare-fruit-sequence.py')
    helper = importlib.util.module_from_spec(helper_spec)
    helper_spec.loader.exec_module(helper)
    picks = list(range(4)) if args.preview else [0, 15, 38, 79]
    helper.review([(str(indices[i]), images[i]) for i in picks], out)
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
        'count': len(images), 'pages': pages, 'sourceFrames': indices, 'crop': spec['crop'],
        'source': str(source.relative_to(ROOT)), 'sourceFrameBase': 0}, indent=2) + '\n')


if __name__ == '__main__':
    main()
