from __future__ import annotations
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location('configure_hooks',Path(__file__).resolve().parents[1]/'scripts/configure_hooks.py')
MODULE=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class ConfigurationTests(unittest.TestCase):
    def test_install_is_idempotent_and_remove_preserves_other_hooks(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);target=root/'.codex/hooks.json';target.parent.mkdir()
            original={'hooks':{'Stop':[{'hooks':[{'type':'command','command':'echo existing'}]}]}}
            target.write_text(json.dumps(original))
            with patch.object(MODULE,'ROOT',root),contextlib.redirect_stdout(io.StringIO()):
                for _ in range(2):
                    with patch('sys.argv',['configure_hooks.py','--install']):MODULE.main()
                data=json.loads(target.read_text())
                self.assertEqual(len(data['hooks']['Stop']),2)
                self.assertEqual(len(data['hooks']['UserPromptSubmit']),1)
                with patch('sys.argv',['configure_hooks.py','--remove']):MODULE.main()
            self.assertEqual(json.loads(target.read_text()),original)

    def test_preview_does_not_install(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            with patch.object(MODULE,'ROOT',root),patch('sys.argv',['configure_hooks.py']),contextlib.redirect_stdout(io.StringIO()) as stream:
                MODULE.main()
            self.assertEqual(len(json.loads(stream.getvalue())['hooks']),6)
            self.assertFalse((root/'.codex').exists())

if __name__=='__main__':unittest.main()
