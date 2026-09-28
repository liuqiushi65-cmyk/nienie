from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

import cv2
import numpy as np

spec = importlib.util.spec_from_file_location('fruit_matte', Path(__file__).resolve().parents[1] / 'scripts/prepare-fruit-sequence.py')
matte = importlib.util.module_from_spec(spec)
spec.loader.exec_module(matte)


class FruitMatteTest(unittest.TestCase):
    def test_colored_body_and_white_highlight_survive_without_floor(self):
        for fruit, color in [('peach', (235, 135, 150)), ('orange', (240, 130, 30))]:
            with self.subTest(fruit=fruit):
                rgb = np.full((720, 1280, 3), 185, np.uint8)
                cv2.ellipse(rgb, (640, 567), (200, 30), 0, 0, 360, (125, 124, 124), -1)
                cv2.circle(rgb, (640, 350), 220, color, -1)
                cv2.circle(rgb, (610, 300), 30, (245, 245, 245), -1)
                result = np.array(matte.cutout(rgb, (280, 0, 1000, 720), fruit, 1))
                alpha = result[:, :, 3]
                self.assertGreater(alpha[186, 205], 250, '白色反光不能抠出洞')
                self.assertGreater(alpha[310, 224], 250, '完整果身必须保留')
                self.assertEqual(alpha[365, 224], 0, '接触面外的灰色投影应透明')
                self.assertFalse(alpha[0].any())
                self.assertFalse(alpha[-1].any())

    def test_mangosteen_separated_shell_keeps_right_side(self):
        source = Path(__file__).resolve().parents[1] / 'artifacts/fruit-expansion/mangosteen/frames/frame-099.png'
        if not source.exists():
            self.skipTest('需要本批山竹源素材')
        from PIL import Image
        rgb = np.array(Image.open(source).convert('RGB'))
        alpha = np.array(matte.cutout(rgb, (230, -45, 1050, 775), 'mangosteen', 99))[:, :, 3]
        for x, y in [(860, 500), (820, 545), (720, 590)]:
            self.assertGreater(alpha[round((y + 45) * 448 / 820), round((x - 230) * 448 / 820)], 250)

    def test_empty_scene_fails_instead_of_exporting_background(self):
        with self.assertRaises(ValueError):
            matte.cutout(np.full((720, 1280, 3), 185, np.uint8), (280, 0, 1000, 720), 'peach', 1)


if __name__ == '__main__':
    unittest.main()
