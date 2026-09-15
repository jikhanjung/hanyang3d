import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
import unittest

HOST = Path(__file__).resolve().parent / 'host'
spec = importlib.util.spec_from_file_location('release_env', HOST / 'update_release_env.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReleaseEnvironmentTests(unittest.TestCase):
    def test_preserve_settings_and_toggle_multiplayer(self):
        source = '# operator settings\nTOKEN="keep $this literal"\nHOST_PORT=19013\nIMAGE_TAG=v0.1.39\nDATA_VERSION=v0.1.39\nCOMPOSE_PROFILES=extra\n'
        updated = module.update(source, 'v0.2.0', True)
        self.assertIn('TOKEN="keep $this literal"\nHOST_PORT=19013\n', updated)
        self.assertIn('COMPOSE_PROFILES=extra,multiplayer\n', updated)
        self.assertEqual(module.update(updated, 'v0.2.0', True), updated)
        self.assertEqual(module.update(updated, 'v0.1.39', False), source)

    def test_independent_multiplayer_tag_preserves_content_settings(self):
        source = 'IMAGE_TAG=v0.2.4\nDATA_VERSION=v0.2.4\nCOMPOSE_FILE=docker-compose.yml:docker-compose.content.yml\nHOST_PORT=8013\n'
        result = module.update(source, 'v0.3.0', True, 'v0.2.4')
        self.assertIn('MULTIPLAYER_IMAGE_TAG=v0.2.4\n', result)
        self.assertIn('COMPOSE_FILE=docker-compose.yml:docker-compose.content.yml\n', result)
        self.assertEqual(module.update(result, 'v0.3.0', True), result)

    def test_failed_upgrade_restores_settings_and_stops_multiplayer(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            for filename in ('deploy.sh', 'update_release_env.py'):
                shutil.copyfile(HOST / filename, root / filename)
            original = 'IMAGE_TAG=v0.1.39\nDATA_VERSION=v0.1.39\nHOST_PORT=19013\nPRIVATE=untouched\n'
            (root / '.env').write_text(original)
            (root / '.env.django').write_text('DJANGO_SECRET_KEY=unchanged\n')
            (root / 'data/v0.2.0').mkdir(parents=True)
            (root / 'data/v0.2.0/manifest.json').write_text('{}')
            mock = root / 'bin'
            mock.mkdir()
            docker = mock / 'docker'
            docker.write_text('''#!/bin/sh
echo "$*" >> docker-calls
case "$*" in
  'image inspect '*--format*) echo 1 ;;
  'compose up '*) if grep -q '^IMAGE_TAG=v0.2.0$' .env; then exit 1; fi ;;
  'compose config --services') echo hanyang3d ;;
esac
exit 0
''')
            docker.chmod(0o755)
            result = subprocess.run(['bash', 'deploy.sh', 'v0.2.0'], cwd=root,
                                    env={**os.environ, 'PATH': str(mock) + os.pathsep + os.environ['PATH']},
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            # The release keys are restored; only the generated walk ticket secret is kept, because the
            # rolled-back multiplayer service needs it too.
            restored = (root / '.env').read_text()
            self.assertTrue(restored.startswith(original), restored)
            self.assertRegex(restored[len(original):], r'\AWALK_TICKET_SECRET=[0-9a-f]{64}\n\Z')
            self.assertEqual((root / '.env.django').read_text(), 'DJANGO_SECRET_KEY=unchanged\n')
            self.assertIn('compose --profile multiplayer stop multiplayer', (root / 'docker-calls').read_text())


if __name__ == '__main__':
    unittest.main()
