"""Database-backed public representations; keep browser schemas stable."""
import copy
import json
import logging
from functools import lru_cache

from django.conf import settings
from django.db.models import Q

from .models import Building, ContentImport, GuideSection, Story

IMPORT_KEY = 'legacy-content-v1'
log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def other_places_en():
    return {
        'bridge': {b['id']: b.get('name_en', '') for b in json.loads((settings.BASE_DIR / 'gis/waterways/doseong_cheonggyecheon.json').read_text())['bridges']},
        'place': {p['name']: p.get('name_en', '') for p in json.loads((settings.BASE_DIR / 'gis/placenames/doseong_placenames.json').read_text())['features']},
    }


@lru_cache(maxsize=1)
def other_places():
    return {
        'bridge': {b['id']: b['name'] for b in json.loads((settings.BASE_DIR / 'gis/waterways/doseong_cheonggyecheon.json').read_text())['bridges']},
        'place': {p['name']: p['name'] for p in json.loads((settings.BASE_DIR / 'gis/placenames/doseong_placenames.json').read_text())['features']},
    }


def sources(obj):
    return [{'title': c.title, 'url': c.url, 'title_en': c.title_en} for c in obj.citations.all()]


# A database row may refer to a model renderer, bridge or place name that a newer image no longer has.
# Such rows are skipped (or shown without their model) so the page still renders, and each one is
# reported in `problems` so the deployment check can fail loudly instead.
def load_buildings(problems=None):
    problems = [] if problems is None else problems
    metadata = ContentImport.objects.get(key=IMPORT_KEY).metadata
    result = copy.deepcopy(metadata['buildings'])
    result['features'] = []
    for b in Building.objects.filter(published=True).select_related('model_resource', 'guide_section').prefetch_related('citations'):
        feature = copy.deepcopy(b.map_config)
        feature.update(id=b.key, name=b.name, category=b.category)
        from .model_resources import MODEL_RESOURCES
        entry = MODEL_RESOURCES.get(b.model_resource.renderer)
        if entry is None:
            problems.append(f'building {b.key}: unknown model renderer {b.model_resource.renderer!r}')
            log.warning(problems[-1])
        elif entry[2]:
            feature['display_model'] = entry[2]
        feature['model_resource'] = b.model_resource.key
        feature['name_en'] = b.name_en
        feature['info'] = {'summary': b.summary, 'period': b.period, 'in_1750': b.in_1750, 'sources': sources(b),
                           'summary_en': b.summary_en, 'period_en': b.period_en, 'in_1750_en': b.in_1750_en}
        if b.guide_section and b.guide_section.published:
            from .guide import anchor
            feature['guide_key'] = anchor(b.guide_section.title)
        result['features'].append(feature)
    return result


def load_stories(problems=None):
    problems = [] if problems is None else problems
    result = copy.deepcopy(ContentImport.objects.get(key=IMPORT_KEY).metadata['stories'])
    result['stories'] = []
    rows = Story.objects.filter(published=True).filter(Q(building__isnull=True) | Q(building__published=True)).select_related('building').prefetch_related('citations')
    for s in rows:
        if s.building:
            target = {'type': 'landmark', 'key': s.building.key, 'label': s.building.label, 'label_en': s.building.name_en.split(' · ')[0] if s.building.name_en else ''}
        else:
            label = other_places().get(s.target_type, {}).get(s.target_key)
            if label is None:
                problems.append(f'story {s.key}: unknown {s.target_type} {s.target_key!r}')
                log.warning(problems[-1])
                continue
            target = {'type': s.target_type, 'key': s.target_key, 'label': label, 'label_en': other_places_en().get(s.target_type, {}).get(s.target_key, '')}
        result['stories'].append({'id': s.key, 'target': target, 'title': s.title, 'year': s.year or None, 'legend': s.legend, 'text': s.text, 'sources': sources(s),
                                  'title_en': s.title_en, 'text_en': s.text_en})
    return result


def guide_markdown(lang='ko'):
    # English headings keep the Korean anchor ({#…}) so links from the map popups still land on the section.
    def heading(s):
        if lang == 'en' and s.title_en:
            from .guide import anchor
            return '#' * s.level + ' ' + s.title_en + ' {#' + anchor(s.title) + '}'
        return '#' * s.level + ' ' + s.title
    body = (lambda s: s.body_en if lang == 'en' and s.body_en else s.body)
    return '\n\n'.join(heading(s) + '\n\n' + body(s) for s in GuideSection.objects.filter(published=True))


def content_problems():
    """Render every public content payload once and return the references that had to be skipped."""
    problems = []
    load_buildings(problems)
    load_stories(problems)
    return problems
