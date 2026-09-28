from __future__ import annotations

import argparse
import json
import shlex
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVENTS = ('UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop', 'Interrupt')


def configuration() -> dict:
    command = ' '.join(shlex.quote(p) for p in ('/usr/bin/python3', str(ROOT / 'scripts/codex_hook.py'), '--state', str(ROOT / '.runtime/events.json')))
    return {'description': '桌面捏捏：仅记录本机任务生命周期，不保存对话，不改变任务行为', 'hooks': {event: [{'hooks': [{'type': 'command', 'command': command, 'timeout': 1}]}] for event in EVENTS}}


def main() -> None:
    parser = argparse.ArgumentParser(description='为当前项目添加桌面捏捏状态 Hooks；保留已有配置')
    parser.add_argument('--install', action='store_true', help='写入当前项目 .codex/hooks.json；之后仍需要 Codex 的信任审核')
    parser.add_argument('--remove', action='store_true', help='仅删除本项目的捏捏 Hook，保留其他 Hook')
    args = parser.parse_args()
    target = ROOT / '.codex/hooks.json'
    own = configuration()
    if not args.install and not args.remove:
        print(json.dumps(own, ensure_ascii=False, indent=2))
        return
    current = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {'hooks': {}}
    command = own['hooks']['Stop'][0]['hooks'][0]['command']
    for event, groups in list(current.get('hooks', {}).items()):
        retained = []
        for group in groups:
            group = dict(group)
            group['hooks'] = [h for h in group.get('hooks', []) if h.get('command') != command]
            if group['hooks']:
                retained.append(group)
        if retained:
            current['hooks'][event] = retained
        else:
            current['hooks'].pop(event, None)
    if args.install:
        for event in EVENTS:
            current.setdefault('hooks', {}).setdefault(event, []).extend(own['hooks'][event])
    if target.exists():
        backup = ROOT / '.runtime/hooks.before-last-change.json'
        backup.parent.mkdir(exist_ok=True)
        backup.write_text(target.read_text(encoding='utf-8'), encoding='utf-8')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(current, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('已更新当前项目 Hooks。' + ('请在 Codex 中审核并信任这些 Hook；没有绕过信任机制。' if args.install else '捏捏 Hook 已移除。'))


if __name__ == '__main__':
    main()
