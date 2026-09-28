from __future__ import annotations
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/codex_hook.py'

class BridgeTests(unittest.TestCase):
    def run_hook(self, state, data):
        return subprocess.run([sys.executable, str(SCRIPT), '--state', str(state)], input=json.dumps(data), text=True, capture_output=True, timeout=3)

    def test_minimum_fields_and_real_status_sequence(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/'events.json'
            for kind in ['UserPromptSubmit','PermissionRequest','PostToolUse','Stop']:
                result=self.run_hook(state, {'session_id':'A','turn_id':'1','hook_event_name':kind,'cwd':'/project/桌面捏捏','prompt':'不能保存的提示词','last_assistant_message':'不能保存的响应'})
                self.assertEqual(result.returncode,0)
                self.assertEqual(json.loads(result.stdout),{})
            raw=state.read_text();data=json.loads(raw)
            self.assertNotIn('不能保存',raw)
            self.assertNotIn('/project',raw)
            self.assertEqual([e['event'] for e in data['sessions'][0]['events']],['UserPromptSubmit','PermissionRequest','PostToolUse','Stop'])
            self.assertEqual(data['sessions'][0]['label'],'桌面捏捏')

    def test_missing_turn_tool_event_uses_active_turn(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/'events.json'
            self.run_hook(state,{'session_id':'A','turn_id':'1','hook_event_name':'UserPromptSubmit'})
            self.run_hook(state,{'session_id':'A','hook_event_name':'PermissionRequest'})
            self.assertEqual(json.loads(state.read_text())['sessions'][0]['events'][-1]['turn'],'1')

    def test_subagents_and_unknown_events_ignored(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/'events.json'
            for extra in [{'agent_id':'child','hook_event_name':'Stop'},{'hook_event_name':'FakeComplete'}]:
                self.run_hook(state,dict(session_id='A',turn_id='1',**extra))
            self.assertFalse(state.exists())

    def test_corrupt_state_recovers_and_unwritable_never_blocks_codex(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/'events.json';state.write_text('bad json')
            payload={'session_id':'A','turn_id':'1','hook_event_name':'UserPromptSubmit'}
            self.assertEqual(self.run_hook(state,payload).returncode,0)
            self.assertEqual(json.loads(state.read_text())['sessions'][0]['session'],'A')
            self.assertEqual(self.run_hook(Path(temp),payload).returncode,0)

    def test_concurrent_writes_keep_both_sessions(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/'events.json';processes=[]
            for i in range(10):
                p=subprocess.Popen([sys.executable,str(SCRIPT),'--state',str(state)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                p.stdin.write(json.dumps({'session_id':str(i),'turn_id':'1','hook_event_name':'UserPromptSubmit'}));p.stdin.close();processes.append(p)
            results = [p.wait(timeout=3) for p in processes]
            for p in processes:
                p.stdout.close(); p.stderr.close()
            self.assertEqual(results, [0] * 10)
            self.assertEqual(len(json.loads(state.read_text())['sessions']),10)

if __name__=='__main__':unittest.main()
