from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('runtime_assets', Path(__file__).resolve().parents[1] / 'scripts/runtime_assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class RuntimeAssetsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'source'
        self.target = Path(self.temp.name) / 'target'
        for root in (self.root, self.target):
            (root / 'app/web').mkdir(parents=True)
            (root / 'app/web/model.mjs').write_text("export const MATERIALS={lychee:{sequenceFrames:80}};")
        for name in ('LICENSE', 'THIRD_PARTY_NOTICES.md'):
            (self.root / name).write_text('测试许可说明')
        directory = self.root / 'artifacts/lychee-sequence'
        directory.mkdir(parents=True)
        manifest = {'count': 80, 'size': 448, 'columns': 4, 'perPage': 16,
                    'pages': [f'atlas-{i}.png' for i in range(5)]}
        (directory / 'manifest.json').write_text(json.dumps(manifest))
        for name in manifest['pages']:
            (directory / name).write_bytes(b'fixture-png')
        (directory / 'private-log.txt').write_text('不能打包的无关文件')
        (self.root / 'artifacts/anger-burst').mkdir()
        (self.root / 'artifacts/anger-burst/lychee-core.png').write_bytes(b'fixture-core')
        (self.root / 'artifacts/slime-audio').mkdir()
        (self.root / 'artifacts/slime-audio/samples.json').write_text('{}')
        self.archive = Path(self.temp.name) / 'assets.zip'

    def test_pack_install_and_idempotence(self):
        assets.pack(self.root, self.archive)
        with zipfile.ZipFile(self.archive) as archive:
            self.assertNotIn('artifacts/lychee-sequence/private-log.txt', archive.namelist())
            self.assertIn('LICENSE', archive.namelist())
        assets.install(self.target, self.archive)
        assets.install(self.target, self.archive)
        self.assertEqual((self.target / 'artifacts/anger-burst/lychee-core.png').read_bytes(), b'fixture-core')

    def test_missing_source_fails_without_archive(self):
        (self.root / 'artifacts/lychee-sequence/atlas-4.png').unlink()
        with self.assertRaises((FileNotFoundError, ValueError)):
            assets.pack(self.root, self.archive)
        self.assertFalse(self.archive.exists())

    def test_tampered_data_and_unexpected_path_are_rejected(self):
        assets.pack(self.root, self.archive)
        with zipfile.ZipFile(self.archive) as archive:
            original = {name: archive.read(name) for name in archive.namelist()}
        for name, value in [('artifacts/anger-burst/lychee-core.png', b'changed'), ('../outside.txt', b'escape')]:
            with self.subTest(name=name):
                edited = dict(original)
                edited[name] = value
                with zipfile.ZipFile(self.archive, 'w') as archive:
                    for path, content in edited.items():
                        archive.writestr(path, content)
                with self.assertRaises(ValueError):
                    assets.install(self.target, self.archive)
                self.assertFalse((self.target / 'artifacts').exists())

    def test_conflict_and_symlink_do_not_overwrite_local_files(self):
        assets.pack(self.root, self.archive)
        conflict = self.target / 'artifacts/slime-audio/samples.json'
        conflict.parent.mkdir(parents=True)
        conflict.write_text('本机已修改的声音')
        with self.assertRaises(ValueError):
            assets.install(self.target, self.archive)
        self.assertEqual(conflict.read_text(), '本机已修改的声音')
        self.assertFalse((self.target / 'artifacts/lychee-sequence').exists())
        conflict.unlink()
        conflict.parent.rmdir()
        outside = Path(self.temp.name) / 'outside'
        outside.mkdir()
        (self.target / 'artifacts/slime-audio').symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            assets.install(self.target, self.archive)
        self.assertFalse((outside / 'samples.json').exists())

    def test_material_mismatch_fails(self):
        assets.pack(self.root, self.archive)
        (self.target / 'app/web/model.mjs').write_text("export const MATERIALS={peach:{sequenceFrames:80}};")
        with self.assertRaises(ValueError):
            assets.install(self.target, self.archive)
        self.assertFalse((self.target / 'artifacts').exists())

    def test_duplicate_archive_members_fail(self):
        assets.pack(self.root, self.archive)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(self.archive, 'a') as archive:
                archive.writestr('LICENSE', '重复文件')
        with self.assertRaises(ValueError):
            assets.install(self.target, self.archive)
        self.assertFalse((self.target / 'artifacts').exists())


if __name__ == '__main__':
    unittest.main()
