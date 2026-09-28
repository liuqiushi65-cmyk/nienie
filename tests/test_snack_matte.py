from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest
import cv2
import numpy as np

spec = importlib.util.spec_from_file_location('snack_matte', Path(__file__).resolve().parents[1] / 'scripts/prepare-snack-sequence.py')
matte = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matte)


class SnackMatteTest(unittest.TestCase):
    def test_daifuku_real_first_frame_has_complete_skin_and_beans(self):
        source = Path(__file__).resolve().parents[1] / 'artifacts/daifuku/revision-2/source.mp4'
        if not source.exists():
            self.skipTest('本机未准备大福源片')
        cap = cv2.VideoCapture(str(source))
        ok, frame = cap.read()
        cap.release()
        self.assertTrue(ok)
        crop = (160, -90, 1120, 870)
        alpha = np.array(matte.cutout(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), crop,
                                     material='daifuku', index=0))[:, :, 3]
        for x, y in [(650, 470), (740, 470), (645, 412), (460, 330)]:
            self.assertGreater(alpha[round((y+90)*448/960), round((x-160)*448/960)], 250)
        self.assertEqual(alpha[round(700*448/960), round(470*448/960)], 0)

    def test_daifuku_keeps_neutral_white_skin_dark_edge_bean_and_paste(self):
        rgb = np.full((720, 1280, 3), (181, 179, 182), np.uint8)
        cv2.ellipse(rgb, (640, 550), (290, 30), 0, 0, 360, (135, 133, 132), -1)
        cv2.ellipse(rgb, (640, 365), (245, 165), 0, 0, 360, (239, 237, 235), -1)
        cv2.ellipse(rgb, (640, 375), (150, 100), 0, 0, 360, (105, 53, 62), -1)
        cv2.circle(rgb, (413, 355), 30, (42, 40, 43), -1)
        alpha = np.array(matte.cutout(rgb, (280, 0, 1000, 720), material='daifuku'))[:, :, 3]
        self.assertGreater(alpha[150, 224], 250, '中性白糯皮不可被当成背景')
        self.assertGreater(alpha[221, 80], 250, '外缘深色豆粒必须保留')
        self.assertGreater(alpha[233, 224], 250, '深红豆沙必须保留')
        self.assertEqual(alpha[348, 224], 0, '灰色台面投影必须透明')

    def test_mochi_keeps_white_outer_core_and_excludes_gray_shadow(self):
        rgb = np.full((720, 1280, 3), (181, 179, 182), np.uint8)
        cv2.ellipse(rgb, (640, 540), (310, 35), 0, 0, 360, (115, 113, 113), -1)
        cv2.ellipse(rgb, (640, 370), (250, 160), 0, 0, 360, (242, 239, 232), -1)
        cv2.ellipse(rgb, (640, 330), (160, 70), 0, 0, 360, (220, 162, 78), -1)
        alpha = np.array(matte.cutout(rgb, (280, 0, 1000, 720), material='mochi'))[:, :, 3]
        self.assertGreater(alpha[224, 90], 250, '白糯芯外缘不能按焦皮颜色删掉')
        self.assertGreater(alpha[317, 224], 250, '底部白糯芯必须保留')
        self.assertEqual(alpha[348, 224], 0, '台面投影必须透明')

    def test_warm_body_preserves_white_highlight_and_excludes_floor(self):
        rgb = np.full((720, 1280, 3), (181, 179, 182), np.uint8)
        cv2.ellipse(rgb, (640, 590), (260, 30), 0, 0, 360, (110, 107, 106), -1)
        cv2.ellipse(rgb, (640, 360), (240, 220), 0, 0, 360, (240, 207, 130), -1)
        cv2.circle(rgb, (600, 320), 32, (255, 255, 255), -1)
        alpha = np.array(matte.cutout(rgb, (280, 0, 1000, 720)))[:, :, 3]
        self.assertGreater(alpha[200, 200], 250, '白色反光仍是实体')
        self.assertGreater(alpha[320, 224], 250, '底部奶油不可被挖空')
        self.assertEqual(alpha[380, 224], 0, '灰色投影应透明')
        self.assertFalse(alpha[0].any())
        self.assertFalse(alpha[-1].any())

    def test_empty_background_is_rejected(self):
        with self.assertRaises(ValueError):
            matte.cutout(np.full((720, 1280, 3), 185, np.uint8), (280, 0, 1000, 720))

    def test_source_clipping_is_rejected(self):
        rgb = np.full((720, 1280, 3), 185, np.uint8)
        cv2.circle(rgb, (0, 350), 220, (240, 200, 110), -1)
        with self.assertRaisesRegex(ValueError, '源画面'):
            matte.cutout(rgb, (-60, -340, 1340, 1060))
