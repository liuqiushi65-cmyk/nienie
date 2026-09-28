from __future__ import annotations

import argparse
import fcntl
import json
import os
import sys
import tempfile
import time
from pathlib import Path

EVENTS = {'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop', 'Interrupt'}


def record(state: Path, payload: dict) -> None:
    event = payload.get('hook_event_name')
    session = payload.get('session_id')
    if event not in EVENTS or not isinstance(session, str) or not session or payload.get('agent_id'):
        return
    state.parent.mkdir(parents=True, exist_ok=True)
    with state.with_suffix('.lock').open('a') as lock:
        # 不等待争用锁：桌宠故障不能拖住 Codex。
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
            data = json.loads(state.read_text(encoding='utf-8'))
            if not isinstance(data.get('sessions'), list):
                data = {'sessions': []}
        except (OSError, ValueError, AttributeError):
            data = {'sessions': []}
        rows = data['sessions']
        row = next((s for s in rows if s.get('session') == session), None)
        turn = payload.get('turn_id')
        if not turn and event in {'PreToolUse', 'PostToolUse', 'PermissionRequest'} and row:
            turn = row.get('turn')
        if not isinstance(turn, str) or not turn:
            return
        now = time.time()
        if row is None:
            row = {'session': session[:160], 'label': Path(str(payload.get('cwd', 'Codex'))).name[:80] or 'Codex', 'events': []}
            rows.append(row)
        if event == 'UserPromptSubmit':
            row['turn'] = turn
            # 保留一个完整轮次的生命周期，长工具链不会截掉起始事件。
            row['events'] = []
        row['updated'] = now
        seq = max(int(data.get('seq', 0)) + 1, time.time_ns() // 1000)
        row['events'].append({'session': session[:160], 'turn': turn[:160], 'event': event, 'seq': seq})
        if len(row['events']) > 160:
            row['events'] = row['events'][:1] + row['events'][-159:]
        data['seq'] = seq
        data['sessions'] = sorted(rows, key=lambda s: s.get('updated', 0), reverse=True)[:20]
        name = None
        try:
            with tempfile.NamedTemporaryFile('w', dir=state.parent, prefix='.events-', delete=False, encoding='utf-8') as temporary:
                name = temporary.name
                json.dump(data, temporary, ensure_ascii=False)
            os.replace(name, state)
        finally:
            if name and os.path.exists(name):
                os.unlink(name)


def main() -> None:
    parser = argparse.ArgumentParser(description='只保存 Codex 生命周期状态，不保存对话或响应')
    parser.add_argument('--state', type=Path, required=True)
    args = parser.parse_args()
    try:
        payload = json.loads(sys.stdin.read(2_000_000))
        if isinstance(payload, dict):
            record(args.state, payload)
    except (OSError, ValueError, TypeError, KeyError):
        pass
    # Stop 要求合法 JSON；不附加上下文，不改变任何运行决定。
    print('{}')


if __name__ == '__main__':
    main()
