"""Korean/English user-interface strings.

The Korean text in templates, scripts and API responses is the key; webapp/locale/en.json maps it to English.
The language is Korean unless the `hanyang3d_lang` cookie (set by the KO | EN switch, ?lang=…) says English;
the browser's Accept-Language is deliberately not used, so the default view is the same for everyone.
A string without an English entry stays Korean, so nothing breaks while the dictionary is incomplete. Content
(buildings, stories, dialogue) is translated in the database and data files, not here.
"""
import json
from functools import lru_cache

from django.conf import settings

LANGS = ('ko', 'en')
COOKIE = 'hanyang3d_lang'


@lru_cache(maxsize=2)
def _catalog(mtime):
    return json.loads((settings.BASE_DIR / 'webapp/locale/en.json').read_text())


def catalog():
    path = settings.BASE_DIR / 'webapp/locale/en.json'
    return _catalog(path.stat().st_mtime_ns) if path.exists() else {}


def language_of(request):
    chosen = request.GET.get('lang')
    if chosen in LANGS:
        return chosen
    cookie = request.COOKIES.get(COOKIE)
    return cookie if cookie in LANGS else 'ko'


def t(text, lang='ko', **values):
    """Translate `text` (a Korean source string) for `lang`, then fill {placeholders}."""
    out = catalog().get(text, text) if lang == 'en' else text
    return out.format(**values) if values else out


class LanguageMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.lang = language_of(request)
        response = self.get_response(request)
        response.headers.setdefault('Vary', 'Cookie')
        # ?lang=en (the KO | EN switch) is remembered for a year; a plain visit keeps the remembered choice.
        if request.GET.get('lang') in LANGS and request.COOKIES.get(COOKIE) != request.lang:
            response.set_cookie(COOKIE, request.lang, max_age=365 * 24 * 3600, samesite='Lax', secure=settings.SESSION_COOKIE_SECURE)
        return response


def context(request):
    lang = getattr(request, 'lang', 'ko')
    return {'lang': lang, 'i18n_dict': catalog() if lang == 'en' else {}}
