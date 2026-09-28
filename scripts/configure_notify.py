from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def own_command(root: Path) -> list:
    return ['/usr/bin/python3', str(root / 'scripts/codex_notify.py'), '--forward', str(root / '.runtime/notify-forward.json')]


def read_notify(text: str):
    # 只改顶层 notify；遇到不能完整解释的语法就退出，不重写整个 TOML。
    table = re.search(r'(?m)^\s*\[', text)
    header = text[:table.start()] if table else text
    matches = list(re.finditer(r'(?m)^[ \t]*notify\s*=([^\n]*)(?:\n|$)', header))
    if len(matches) > 1:
        raise ValueError('顶层 notify 重复，未改动配置')
    match = matches[0] if matches else None
    if not match:
        return [], None
    try:
        command = json.loads(match.group(1).strip())
    except ValueError as error:
        raise ValueError('现有 notify 不是可安全替换的单行字符串数组，未改动配置') from error
    if not isinstance(command, list) or not all(isinstance(v, str) and v for v in command):
        raise ValueError('现有 notify 格式不支持，未改动配置')
    return command, match


def replace_file(path: Path, text: str, expected: str | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile('w', dir=path.parent, prefix='.nienie-', delete=False, encoding='utf-8') as target:
            name = target.name;target.write(text)
        if expected is not None and path.read_text(encoding='utf-8') != expected:
            raise ValueError('配置在操作期间发生变化，请重试；未覆盖新内容')
        if path.exists():
            os.chmod(name, path.stat().st_mode & 0o777)
        os.replace(name, path)
    finally:
        if name and os.path.exists(name):
            os.unlink(name)


def install(config: Path, root: Path = ROOT) -> None:
    source = config.read_text(encoding='utf-8')
    command, match = read_notify(source)
    forward = root / '.runtime/notify-forward.json'
    if command == own_command(root):
        if not forward.exists():
            raise ValueError('转发配置缺失，停止以免吞掉原有通知')
        return
    if forward.exists():
        prior = json.loads(forward.read_text(encoding='utf-8'))
        if prior.get('command') != command:
            raise ValueError('原通知程序已变化，需要核对后再安装；未覆盖已有转发记录')
    metadata = {'command': command, 'original_line': match.group(0) if match else None}
    replace_file(forward, json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    replacement = 'notify = ' + json.dumps(own_command(root), ensure_ascii=False) + '\n'
    changed = source[:match.start()] + replacement + source[match.end():] if match else replacement + source
    replace_file(config, changed, expected=source)


def remove(config: Path, root: Path = ROOT) -> None:
    source = config.read_text(encoding='utf-8');command, match = read_notify(source)
    if command != own_command(root) or not match:
        raise ValueError('notify 已不是捏捏入口，未覆盖当前配置')
    metadata = json.loads((root / '.runtime/notify-forward.json').read_text(encoding='utf-8'))
    restored = source[:match.start()] + (metadata['original_line'] or '') + source[match.end():]
    replace_file(config, restored, expected=source)


def main() -> None:
    parser = argparse.ArgumentParser(description='连接捏捏完成通知，原样转发已有通知程序')
    parser.add_argument('--config', type=Path, default=Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'config.toml')
    action = parser.add_mutually_exclusive_group()
    action.add_argument('--install', action='store_true');action.add_argument('--remove', action='store_true')
    args = parser.parse_args()
    if args.install:
        install(args.config);print('已接入完成通知，并保留原通知程序。真实联动以收到事件为准。')
    elif args.remove:
        remove(args.config);print('已还原原通知入口。')
    else:
        command, _ = read_notify(args.config.read_text(encoding='utf-8'))
        print(json.dumps({'notify': own_command(ROOT), 'preserved_command': command}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
