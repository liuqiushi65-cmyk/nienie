from __future__ import annotations
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('codex_notify',ROOT/'scripts/codex_notify.py')
MODULE=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class NotifyTests(unittest.TestCase):
    def test_completion_is_deduplicated_and_keeps_only_notification_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);state=root/'completions.json';index=root/'index.jsonl'
            index.write_text(json.dumps({'id':'A','thread_name':'修复登录'})+'\n')
            payload={'type':'agent-turn-complete','thread-id':'A','turn-id':'1','cwd':'/private/项目',
                'input-messages':['不要保存输入'],'last-assistant-message':'不要保存回答'}
            for _ in range(2):MODULE.record(state,payload,index)
            raw=state.read_text();events=json.loads(raw)['events'];self.assertEqual(len(events),1)
            self.assertEqual(events[0]['title'],'修复登录')
            self.assertNotIn('不要保存',raw);self.assertNotIn('/private',raw)
            self.assertEqual(set(events[0]),{'type','session','turn','title','at'})

    def test_noncompletion_invalid_identifiers_and_subagents_ignored(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/'events.json'
            base={'type':'agent-turn-complete','thread-id':'A','turn-id':'1'}
            for change in [{'type':'approval-requested'},{'turn-id':''},{'agent-id':'child'},{'thread-id':None}]:
                MODULE.record(state,{**base,**change},Path(temp)/'missing')
            self.assertFalse(state.exists())

    def test_existing_notifier_receives_exact_argument_even_when_local_record_fails(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);capture=root/'captured.json';original=root/'original.py';forward=root/'forward.json'
            original.write_text('import pathlib,sys\npathlib.Path(sys.argv[1]).write_text(sys.argv[2])\n')
            forward.write_text(json.dumps({'command':[sys.executable,str(original),str(capture)]}))
            raw=json.dumps({'type':'agent-turn-complete','thread-id':'A','turn-id':'1','last-assistant-message':'原通知照常收到'},ensure_ascii=False)
            result=subprocess.run([sys.executable,str(ROOT/'scripts/codex_notify.py'),'--state',str(root),'--forward',str(forward),raw],capture_output=True,text=True,timeout=3)
            self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(capture.read_text(),raw)

    def test_title_fallback_and_bounded_history(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/'state.json'
            for i in range(70):MODULE.record(state,{'type':'agent-turn-complete','thread-id':'abcdefghijk','turn-id':str(i),'cwd':'/repo/小工具'},Path(temp)/'missing')
            events=json.loads(state.read_text())['events'];self.assertEqual(len(events),64)
            self.assertIn('小工具',events[-1]['title']);self.assertIn('abcdefgh',events[-1]['title'])
