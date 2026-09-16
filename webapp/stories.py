"""Place stories: short sourced anecdotes and events attached to landmarks, bridges and neighbourhood names."""
import json
from functools import lru_cache

from django.conf import settings

STORIES = 'gis/stories/doseong_stories.json'


@lru_cache(maxsize=4)
def _load(mtime):
    return json.loads((settings.BASE_DIR / STORIES).read_text())


def load_stories():
    if settings.CONTENT_SOURCE == 'database':
        from .content import load_stories as from_database
        return from_database()
    file = settings.BASE_DIR / STORIES
    return _load(file.stat().st_mtime_ns)


def stories_by_place(lang='ko'):
    # The guide lists stories under the place they belong to, in file order.
    from .i18n import localize
    groups = {}
    for story in localize(load_stories(), lang)['stories']:
        groups.setdefault(story['target']['label'], []).append(story)
    return list(groups.items())
