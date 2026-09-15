"""Database-backed public representations; keep browser schemas stable."""
import copy
import json
from functools import lru_cache

from django.conf import settings
from django.db.models import Q

from .models import Building, ContentImport, GuideSection, Story

IMPORT_KEY = 'legacy-content-v1'


@lru_cache(maxsize=1)
def other_places():
    return {
        'bridge': {b['id']: b['name'] for b in json.loads((settings.BASE_DIR / 'gis/waterways/doseong_cheonggyecheon.json').read_text())['bridges']},
        'place': {p['name']: p['name'] for p in json.loads((settings.BASE_DIR / 'gis/placenames/doseong_placenames.json').read_text())['features']},
    }


def sources(obj):
    return [{'title': c.title, 'url': c.url} for c in obj.citations.all()]


def load_buildings():
    metadata = ContentImport.objects.get(key=IMPORT_KEY).metadata
    result = copy.deepcopy(metadata['buildings'])
    result['features'] = []
    for b in Building.objects.filter(published=True).select_related('model_resource', 'guide_section').prefetch_related('citations'):
        feature = copy.deepcopy(b.map_config)
        feature.update(id=b.key, name=b.name, category=b.category)
        from .model_resources import MODEL_RESOURCES
        renderer = MODEL_RESOURCES[b.model_resource.renderer][2]
        if renderer:
            feature['display_model'] = renderer
        feature['model_resource'] = b.model_resource.key
        feature['info'] = {'summary': b.summary, 'period': b.period, 'in_1750': b.in_1750, 'sources': sources(b)}
        if b.guide_section and b.guide_section.published:
            from .guide import anchor
            feature['guide_key'] = anchor(b.guide_section.title)
        result['features'].append(feature)
    return result


def load_stories():
    result = copy.deepcopy(ContentImport.objects.get(key=IMPORT_KEY).metadata['stories'])
    result['stories'] = []
    rows = Story.objects.filter(published=True).filter(Q(building__isnull=True) | Q(building__published=True)).select_related('building').prefetch_related('citations')
    for s in rows:
        if s.building:
            target = {'type': 'landmark', 'key': s.building.key, 'label': s.building.label}
        else:
            target = {'type': s.target_type, 'key': s.target_key, 'label': other_places()[s.target_type][s.target_key]}
        result['stories'].append({'id': s.key, 'target': target, 'title': s.title, 'year': s.year or None, 'legend': s.legend, 'text': s.text, 'sources': sources(s)})
    return result


def guide_markdown():
    return '\n\n'.join('#' * s.level + ' ' + s.title + '\n\n' + s.body for s in GuideSection.objects.filter(published=True))
