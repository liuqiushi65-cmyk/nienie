from __future__ import annotations

import argparse
import fcntl
import json
import os
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def title_for(session: str, cwd: str, index: Path) -> str:
    title = ''
    try:
        # 只读任务标题索引，不打开会话正文或模型回答。
        with index.open(encoding='utf-8') as source:
            for line in source:
                try:
                    row = json.loads(line)
                    if row.get('id') == session and isinstance(row.get('thread_name'), str):
                        title = row['thread_name']
                except (ValueError, AttributeError):
                    continue
    except OSError:
        pass
    return ' '.join((title or f'{Path(cwd).name or "Codex 任务"} · {session[:8]}').split())[:120]


def record(state: Path, payload: dict, index: Path) -> None:
    if payload.get('type') != 'agent-turn-complete' or payload.get('agent-id') or payload.get('agent_id'):
        return
    session, turn = payload.get('thread-id'), payload.get('turn-id')
    if not all(isinstance(v, str) and 0 < len(v) <= 160 for v in (session, turn)):
        return
    state.parent.mkdir(parents=True, exist_ok=True)
    with state.with_suffix('.lock').open('a') as lock:
        deadline = time.monotonic() + .25
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    return
                time.sleep(.005)
        try:
            events = json.loads(state.read_text(encoding='utf-8')).get('events', [])
            if not isinstance(events, list):
                events = []
        except (OSError, ValueError, AttributeError):
            events = []
        events = [e for e in events if isinstance(e, dict)]
        if any(e.get('session') == session and e.get('turn') == turn for e in events):
            return
        events.append({'type': 'agent-turn-complete', 'session': session, 'turn': turn,
            'title': title_for(session, str(payload.get('cwd') or ''), index), 'at': time.time()})
        name = None
        try:
            with tempfile.NamedTemporaryFile('w', dir=state.parent, prefix='.completion-', delete=False, encoding='utf-8') as out:
                name = out.name
                json.dump({'version': 1, 'events': events[-64:]}, out, ensure_ascii=False)
            os.replace(name, state)
        finally:
            if name and os.path.exists(name):
                os.unlink(name)


def main() -> None:
    parser = argparse.ArgumentParser(description='本机任务完成提醒；保留已有 Codex 通知程序')
    parser.add_argument('--state', type=Path, default=ROOT / '.runtime/completions.json')
    parser.add_argument('--index', type=Path, default=Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'session_index.jsonl')
    parser.add_argument('--forward', type=Path)
    parser.add_argument('payload')
    args = parser.parse_args()
    try:
        payload = json.loads(args.payload)
        if isinstance(payload, dict):
            record(args.state, payload, args.index)
    except Exception:
        # 捏捏的读取/写入故障不能吞掉原有 Computer Use 通知。
        pass
    if args.forward:
        config = json.loads(args.forward.read_text(encoding='utf-8'))
        command = config.get('command', [])
        if command:
            # 不经过 shell；原始参数、环境、标准输入输出和退出码交回原通知程序。
            os.execvp(command[0], [*command, args.payload])


if __name__ == '__main__':
    main()
