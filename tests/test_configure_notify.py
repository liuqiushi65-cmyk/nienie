from __future__ import annotations
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('configure_notify',Path(__file__).resolve().parents[1]/'scripts/configure_notify.py')
MODULE=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

class NotifyConfigurationTests(unittest.TestCase):
    def test_install_preserves_original_callback_other_config_and_remove_is_exact(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);config=root/'config.toml'
            original='model = "existing"\nnotify = ["/old/helper", "turn-ended"]\n\n[features]\nmemories = true\n'
            config.write_text(original)
            MODULE.install(config,root);installed=config.read_text();MODULE.install(config,root)
            self.assertEqual(config.read_text(),installed)
            forwarding=json.loads((root/'.runtime/notify-forward.json').read_text())
            self.assertEqual(forwarding['command'],['/old/helper','turn-ended'])
            self.assertIn('[features]\nmemories = true',installed)
            MODULE.remove(config,root);self.assertEqual(config.read_text(),original)

    def test_no_prior_notifier_can_be_restored_without_touching_table_values(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);config=root/'config.toml';original='model = "x"\n[other]\nnotify = ["not-global"]\n';config.write_text(original)
            MODULE.install(config,root);self.assertIn('notify = ["not-global"]',config.read_text())
            MODULE.remove(config,root);self.assertEqual(config.read_text(),original)

    def test_unknown_syntax_and_later_user_change_are_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);config=root/'config.toml';original="notify = [\n '/old/helper'\n]\n";config.write_text(original)
            with self.assertRaises(ValueError):MODULE.install(config,root)
            self.assertEqual(config.read_text(),original)
            config.write_text('notify = ["/old/helper"]\n');MODULE.install(config,root)
            config.write_text('notify = ["/new/helper"]\n')
            with self.assertRaises(ValueError):MODULE.remove(config,root)
            self.assertEqual(config.read_text(),'notify = ["/new/helper"]\n')
