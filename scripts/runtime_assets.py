from __future__ import annotations

"""只分发构建必需素材；导入前验证清单与哈希，不覆盖不同的本机文件。"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = 'runtime-assets.json'
MAX_BYTES = 512 * 1024 * 1024


def layout(root: Path) -> tuple:
    command = "import {MATERIALS} from './app/web/model.mjs'; console.log(JSON.stringify(Object.fromEntries(Object.entries(MATERIALS).filter(([,s])=>s.sequenceFrames).map(([id,s])=>[id,s.sequenceFrames]))));"
    specs = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', command], cwd=root, text=True))
    paths = ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'artifacts/slime-audio/samples.json']
    for name, count in specs.items():
        if not re.fullmatch(r'[a-z][a-z0-9-]*', name) or not isinstance(count, int) or not 0 < count <= 1024:
            raise ValueError('物体素材合同无效')
        directory = f'artifacts/{name}-sequence'
        paths += [f'{directory}/manifest.json', f'artifacts/anger-burst/{name}-core.png']
        paths += [f'{directory}/atlas-{i}.png' for i in range((count + 15) // 16)]
    return specs, sorted(paths)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check_path(root: Path, relative: str) -> Path:
    target = root / relative
    # 所有相对路径来自固定白名单；同时阻止已有软链接将写入导向项目外。
    for part in [target, *target.parents]:
        if part == root:
            break
        if part.is_symlink():
            raise ValueError(f'素材路径含软链接，未写入：{relative}')
    return target


def check_manifests(data: dict, specs: dict) -> None:
    for name, count in specs.items():
        manifest = json.loads(data[f'artifacts/{name}-sequence/manifest.json'])
        expected = {'size': 448, 'columns': 4, 'perPage': 16, 'count': count,
                    'pages': [f'atlas-{i}.png' for i in range((count + 15) // 16)]}
        if any(manifest.get(key) != value for key, value in expected.items()):
            raise ValueError(f'{name} 图集 manifest 不符合当前代码合同')


def pack(root: Path, output: Path) -> None:
    root = root.resolve()
    if output.exists():
        raise ValueError('输出包已存在，请使用新文件名')
    specs, paths = layout(root)
    data = {name: check_path(root, name).read_bytes() for name in paths}
    if sum(map(len, data.values())) > MAX_BYTES:
        raise ValueError('素材总大小超出 512 MiB 上限')
    check_manifests(data, specs)
    index = {'version': 1, 'materials': specs,
             'files': {name: {'size': len(content), 'sha256': digest(content)} for name, content in data.items()}}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, delete=False) as handle:
            temporary = Path(handle.name)
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
            archive.writestr(INDEX, json.dumps(index, ensure_ascii=False, indent=2))
            for name, content in data.items():
                archive.writestr(name, content)
        # 不覆盖另一进程刚创建的同名包。
        os.link(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def verified(root: Path, source: Path) -> dict:
    specs, paths = layout(root)
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(names) != len(set(names)) or set(names) != set(paths) | {INDEX}:
            raise ValueError('素材包缺少必要文件，或含重复/白名单外路径')
        if sum(entry.file_size for entry in entries) > MAX_BYTES:
            raise ValueError('解压大小超出 512 MiB 上限')
        index = json.loads(archive.read(INDEX))
        if index.get('version') != 1 or index.get('materials') != specs or set(index.get('files', {})) != set(paths):
            raise ValueError('素材包版本或物体清单与代码不匹配')
        data = {}
        for name in paths:
            content = archive.read(name)
            if index['files'][name] != {'size': len(content), 'sha256': digest(content)}:
                raise ValueError(f'素材校验失败：{name}')
            data[name] = content
    check_manifests(data, specs)
    return data


def install(root: Path, source: Path) -> None:
    root = root.resolve()
    data = verified(root, source)
    pending = []
    for name, content in data.items():
        # 许可说明在压缩包内供独立阅读，仓库中的文档不被素材包覆盖。
        if not name.startswith('artifacts/'):
            continue
        target = check_path(root, name)
        if target.exists():
            if not target.is_file() or digest(target.read_bytes()) != digest(content):
                raise ValueError(f'本机文件不同，未覆盖任何素材：{name}')
        else:
            pending.append((name, content))
    with tempfile.TemporaryDirectory(prefix='.nienie-assets-', dir=root) as directory:
        stage = Path(directory)
        for number, (_, content) in enumerate(pending):
            (stage / str(number)).write_bytes(content)
        for number, (name, _) in enumerate(pending):
            target = check_path(root, name)
            target.parent.mkdir(parents=True, exist_ok=True)
            os.link(stage / str(number), target)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT, help='项目根目录，默认当前脚本所在项目')
    parser.add_argument('action', choices=['pack', 'verify', 'install'])
    parser.add_argument('archive', type=Path, help='素材 ZIP 文件路径')
    args = parser.parse_args()
    if args.action == 'pack':
        pack(args.root, args.archive)
        print(f'已生成运行素材包：{args.archive}')
    elif args.action == 'verify':
        print(f'校验通过：{len(verified(args.root, args.archive))} 个文件')
    else:
        install(args.root, args.archive)
        print('运行素材已导入，相同文件已跳过；本机不同文件不会被覆盖。')


if __name__ == '__main__':
    main()
