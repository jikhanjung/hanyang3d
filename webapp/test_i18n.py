import json

from django.conf import settings
from django.test import Client, TestCase

from .i18n import COOKIE, catalog, t


class LanguageTests(TestCase):
    def setUp(self):
        from io import StringIO
        from django.core.management import call_command
        call_command('import_content', stdout=StringIO())

    def test_default_is_korean_regardless_of_accept_language(self):
        page = self.client.get('/', HTTP_ACCEPT_LANGUAGE='en-US,en;q=0.9')
        self.assertContains(page, '<html lang="ko">')
        self.assertContains(page, '>1인칭<')

    def test_switch_sets_cookie_and_renders_english(self):
        page = self.client.get('/?lang=en')
        self.assertEqual(page.cookies[COOKIE].value, 'en')
        self.assertContains(page, '<html lang="en">')
        self.assertContains(page, '>' + t('1인칭', 'en') + '<')
        self.assertNotEqual(t('1인칭', 'en'), '1인칭')
        # The choice is remembered without the query string, on every page.
        for path in ('/', '/guide/', '/credits/'):
            self.assertContains(self.client.get(path), '<html lang="en">', msg_prefix=path)
        self.assertContains(self.client.get('/?lang=ko'), '<html lang="ko">')

    def test_api_messages_follow_the_language(self):
        client = Client(enforce_csrf_checks=True)
        client.get('/api/player/')
        token = client.cookies['csrftoken'].value
        client.cookies[COOKIE] = 'en'
        response = client.post('/api/account/register', data=json.dumps({'name': '<bad>', 'password': 'x' * 8}),
                               content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error'], t('이름은 1~16자의 한글·한자·영문·숫자·공백·_ . -로 정하시오.', 'en'))
        self.assertFalse(any('\uac00' <= ch <= '\ud7a3' for ch in response.json()['error']))

    def test_dictionary_is_complete_and_keeps_placeholders(self):
        import re
        data = catalog()
        self.assertGreater(len(data), 300)
        for key, value in data.items():
            self.assertTrue(value.strip(), key)
            self.assertEqual(set(re.findall(r'\{\w+\}', key)), set(re.findall(r'\{\w+\}', value)), key)
        self.assertEqual(t('없는 문구', 'en'), '없는 문구')
