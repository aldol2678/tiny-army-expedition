"""Asset-free assembly tests; the synthetic registry is not a playable art fixture."""
from pathlib import Path
import importlib.util
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("assembly", ROOT / "assemble.py")
assembly = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assembly)


class AssemblyTests(unittest.TestCase):
    def test_missing_registry_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            registry = Path(directory) / "missing.js"
            with self.assertRaisesRegex(ValueError, "separately supplied"):
                assembly.assemble(registry)

    def test_empty_registry_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            registry = Path(directory) / "empty.js"
            registry.write_text("", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Empty assembly module"):
                assembly.assemble(registry)

    def test_synthetic_registry_is_escaped_and_check_writes_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            registry = Path(directory) / "synthetic.js"
            registry.write_text("/* Synthetic test only: </script> */\n", encoding="utf-8")
            result = assembly.assemble(registry)
            self.assertNotRegex(result, r"@@[a-z-]+@@")
            self.assertIn("Synthetic test only: <\\/script>", result)
            before = {str(p.relative_to(ROOT)): p.read_bytes() for p in ROOT.rglob("*") if p.is_file()}
            process = subprocess.run([sys.executable, str(ROOT / "assemble.py"), "--check",
                                      "--portrait-registry", str(registry)],
                                     capture_output=True, text=True, check=False)
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertIn("no output written", process.stdout)
            after = {str(p.relative_to(ROOT)): p.read_bytes() for p in ROOT.rglob("*") if p.is_file()}
            self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
