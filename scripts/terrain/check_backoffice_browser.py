"""Exercise editorial changes against an isolated database, never the developer DB."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from deploy.host.backup_content import backup_database


def main():
    from playwright.sync_api import sync_playwright
    with tempfile.TemporaryDirectory(prefix='hanyang-backoffice-') as temporary:
        db = Path(temporary) / 'content.sqlite3'
        backup_database(ROOT / 'data/content.sqlite3', db)
        env = {**os.environ, 'HANYANG_CONTENT_SOURCE': 'database', 'HANYANG_DB_PATH': str(db),
               'DJANGO_SECRET_KEY': secrets.token_urlsafe(48), 'DJANGO_COOKIE_SECURE': '0'}
        password = secrets.token_urlsafe(24)
        setup = "from django.contrib.auth import get_user_model; get_user_model().objects.create_superuser('browser_editor', password=" + repr(password) + ')'
        subprocess.run([sys.executable, 'manage.py', 'shell', '-c', setup], cwd=ROOT, env=env, check=True, stdout=subprocess.DEVNULL)
        server = subprocess.Popen([sys.executable, 'manage.py', 'runserver', '127.0.0.1:18015', '--noreload'], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        base = 'http://127.0.0.1:18015'
        try:
            for attempt in range(100):
                if server.poll() is not None: raise RuntimeError('Isolated server did not start')
                try:
                    with urlopen(base + '/healthz', timeout=1) as response:
                        assert json.load(response)['content']['buildings'] == 103
                    break
                except OSError: time.sleep(.1)
            else: raise RuntimeError('Server did not become ready')
            with sync_playwright() as p:
                browser = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
                page = browser.new_page(viewport={'width': 1200, 'height': 850})
                errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
                page.goto(base + '/backoffice/')
                page.locator('#id_username').fill('browser_editor'); page.locator('#id_password').fill(password)
                page.locator('input[type=submit]').click()
                page.wait_for_url(base + '/backoffice/')
                page.goto(base + '/backoffice/webapp/building/?q=honghwamun')
                page.locator('#result_list tbody th a').first.click()
                page.locator('#id_summary').fill('백오피스에서 수정한 홍화문 소개')
                page.locator('input[name=_save]').click()
                page.locator('.messagelist .success').wait_for()
                page.goto(base + '/backoffice/webapp/story/?q=honghwamun-military-tax')
                page.locator('#result_list tbody th a').first.click()
                page.locator('#id_title').fill('백오피스에서 수정한 이야기')
                page.locator('input[name=_save]').click(); page.locator('.messagelist .success').wait_for()
                page.goto(base + '/backoffice/webapp/guidesection/?q=홍화문')
                page.locator('#result_list tbody th a').first.click()
                page.locator('#id_body').fill('백오피스에서 수정한 상세 설명')
                page.locator('input[name=_save]').click(); page.locator('.messagelist .success').wait_for()
                page.goto(base + '/guide/')
                assert '백오피스에서 수정한 상세 설명' in page.inner_text('body')
                assert '백오피스에서 수정한 이야기' in page.inner_text('body')
                page.goto(base + '/')
                page.wait_for_function('window.terrain3d?.ready', timeout=450000)
                info = page.evaluate("()=>terrain3d.buildings.children.find(b=>b.userData.feature.id==='honghwamun').userData.feature.info")
                assert info['summary'] == '백오피스에서 수정한 홍화문 소개'
                assert any(s['title'] == '백오피스에서 수정한 이야기' for s in info['stories'])
                assert len(page.evaluate("()=>JSON.parse(document.getElementById('buildings').textContent).features")) == 103
                assert not errors, errors
                browser.close()
            print('PASS: isolated backoffice login, building/story/guide edits, 103 map buildings and immediate content refresh')
        finally:
            server.terminate()
            try: server.wait(timeout=10)
            except subprocess.TimeoutExpired: server.kill(); server.wait()


if __name__ == '__main__': main()
