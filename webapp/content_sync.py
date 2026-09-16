"""Carry later Git changes of the landmark and story JSON into the content database.

The database is the published source after the one-time import, but corrections still arrive through the
reviewed JSON in Git. Each building and story gets a fingerprint of its public fields. The fingerprint recorded
at the last sync tells who changed a row since then:

- JSON changed, database untouched → update the database from the JSON.
- database changed (back-office edit), JSON untouched → keep the edit.
- both changed → report a conflict and change nothing.
- new in JSON → create; deleted in the back office after a sync → leave deleted; only in the database → report.

Before the first sync there is no fingerprint; a row counts as untouched when it has not been saved since the
import (`updated_at` not later than the import time). Existing guide sections are only compared, not changed; new buildings may seed their missing sections.

Goods and shops (from gis/characters/npcs.json) follow the same rules; their untouched time is the goods seed of
migration 0004 (`economy-import-v1`).
"""
import hashlib
import json
from dataclasses import dataclass, field

from django.db import transaction

from .content import IMPORT_KEY, other_places
from .model_resources import MODEL_RESOURCES
from .models import Building, Citation, ContentImport, GuideSection, Item, Resource, Shop, Story

SYNC_KEY = 'content-sync-v1'
ECONOMY_IMPORT_KEY = 'economy-import-v1'
ITEM_FIELDS = ('name', 'unit', 'price', 'description', 'icon_shape', 'icon_color', 'use', 'max_owned')


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def model_key_for(feature):
    """Same renderer choice as the one-time import."""
    if feature.get('category') == '성문':
        return 'city_gate'
    if feature.get('id') == 'jongmyo':
        return 'jongmyo'
    renderer = feature.get('display_model', '')
    return next((k for k, row in MODEL_RESOURCES.items() if row[2] == renderer), 'box')


def json_building(feature):
    config = {k: v for k, v in feature.items() if k not in ('id', 'name', 'category', 'info', 'display_model')}
    info = feature['info']
    return {'name': feature['name'], 'category': feature['category'], 'summary': info['summary'], 'period': info['period'],
            'in_1750': info['in_1750'], 'map_config': config, 'model': model_key_for(feature),
            'sources': [{'title': s['title'], 'url': s['url']} for s in info['sources']]}


def db_building(b):
    return {'name': b.name, 'category': b.category, 'summary': b.summary, 'period': b.period, 'in_1750': b.in_1750,
            'map_config': b.map_config, 'model': b.model_resource.renderer,
            'sources': [{'title': c.title, 'url': c.url} for c in b.citations.all()]}


def json_story(row):
    return {'target': {'type': row['target']['type'], 'key': row['target']['key']}, 'title': row['title'],
            'year': row['year'] or '', 'legend': row['legend'], 'text': row['text'],
            'sources': [{'title': s['title'], 'url': s['url']} for s in row['sources']]}


def db_story(s):
    key = s.building.key if s.building_id else s.target_key
    return {'target': {'type': s.target_type, 'key': key}, 'title': s.title, 'year': s.year, 'legend': s.legend,
            'text': s.text, 'sources': [{'title': c.title, 'url': c.url} for c in s.citations.all()]}


def json_item(row):
    return {'name': row['name'], 'unit': row['unit'], 'price': row['price'], 'description': row.get('desc', ''),
            'icon_shape': row['icon']['shape'], 'icon_color': row['icon']['color'], 'use': row.get('use', ''), 'max_owned': row.get('max_owned')}


def db_item(i):
    return {f: getattr(i, f) for f in ITEM_FIELDS}


def json_shop(row):
    return {'about': row.get('about', ''), 'items': sorted(row['items'])}


def db_shop(s):
    return {'about': s.about, 'items': sorted(i.key for i in s.items.all())}


def _apply_item(item, data):
    for f in ITEM_FIELDS:
        setattr(item, f, data[f])
    item.full_clean(); item.save()


def _apply_shop(shop, data):
    shop.about = data['about']
    shop.full_clean(); shop.save()
    shop.items.set(Item.objects.filter(key__in=data['items']))


@dataclass
class SyncReport:
    created: list = field(default_factory=list)
    updated: list = field(default_factory=list)
    conflicts: list = field(default_factory=list)
    kept_deleted: list = field(default_factory=list)
    only_in_db: list = field(default_factory=list)
    guide_differences: int = 0
    applied: bool = False

    def lines(self):
        out = [f"{'적용' if self.applied else '미리보기'}: 추가 {len(self.created)}, 갱신 {len(self.updated)}, 충돌 {len(self.conflicts)}, "
               f"운영에서 삭제되어 유지 {len(self.kept_deleted)}, DB에만 있음 {len(self.only_in_db)}, 안내 문단 차이 {self.guide_differences}"]
        for label, items in (('추가', self.created), ('갱신', self.updated), ('충돌', self.conflicts),
                             ('삭제 유지', self.kept_deleted), ('DB에만', self.only_in_db)):
            out.extend(f'  {label}: {item}' for item in items)
        return out


def _replace_citations(owner_field, owner, sources):
    Citation.objects.filter(**{owner_field: owner}).delete()
    for i, src in enumerate(sources):
        citation = Citation(**{owner_field: owner}, position=i, **src)
        citation.full_clean(); citation.save()


def _apply_building(b, data, position):
    b.name, b.category, b.summary, b.period, b.in_1750 = data['name'], data['category'], data['summary'], data['period'], data['in_1750']
    b.map_config = data['map_config']
    b.model_resource = Resource.objects.get(kind='model', renderer=data['model'])
    if b.position is None:
        b.position = position
    b.full_clean(); b.save()
    _replace_citations('building', b, data['sources'])


def _apply_story(s, data):
    target = data['target']
    s.target_type = target['type']
    s.building = Building.objects.get(key=target['key']) if target['type'] == 'landmark' else None
    s.target_key = '' if target['type'] == 'landmark' else target['key']
    s.title, s.year, s.legend, s.text = data['title'], data['year'], data['legend'], data['text']
    s.full_clean(); s.save()
    _replace_citations('story', s, data['sources'])


def _section_for(label, key=None, markdown=None):
    from .guide import anchor
    section = next((g for g in GuideSection.objects.all() if anchor(g.title) == label), None)
    if section is not None or not key or markdown is None:
        return section
    # Seed the description of a newly added building only. Existing editorial sections
    # are never overwritten, including when a later sync changes the source Markdown.
    import re
    headings = list(re.finditer(r'^(#{1,3})\s+(.+)$', markdown, re.M))
    for i, heading in enumerate(headings):
        if len(heading[1]) == 3 and anchor(heading[2]) == label:
            end = headings[i + 1].start() if i + 1 < len(headings) else len(markdown)
            section, _ = GuideSection.objects.get_or_create(
                key=f'landmark-{key}', defaults={'title': heading[2], 'level': 3,
                'body': markdown[heading.end():end].strip(),
                'position': max((g.position for g in GuideSection.objects.all()), default=0) + 1,
                'published': True})
            return section
    return None


def _sync_kind(kind, items, rows, to_data, db_data, create, update, baseline, imported_at, report):
    seen = set()
    for position, (key, data) in enumerate(items):
        seen.add(key)
        new = fingerprint(data)
        base = baseline.get(key)
        row = rows.get(key)
        if row is None:
            if base is not None:
                report.kept_deleted.append(f'{kind} {key}')
            else:
                create(key, data, position)
                baseline[key] = new
                report.created.append(f'{kind} {key}')
            continue
        current = fingerprint(db_data(row))
        if base is None and row.updated_at <= imported_at:
            base = current  # untouched since the one-time import
        if current == new:
            baseline[key] = new
        elif base is None:
            report.conflicts.append(f'{kind} {key}: 운영에서 편집됨, Git 자료와 다름')
        elif new == base:
            pass  # only the database changed: keep the back-office edit
        elif current == base:
            update(row, data, position)
            baseline[key] = new
            report.updated.append(f'{kind} {key}')
        else:
            report.conflicts.append(f'{kind} {key}: Git과 운영 모두 바뀜')
    report.only_in_db.extend(f'{kind} {key}' for key in rows if key not in seen)


def sync_content(buildings_data, stories_data, guide_markdown=None, apply=False, economy_data=None):
    report = SyncReport(applied=apply)
    imported = ContentImport.objects.get(key=IMPORT_KEY)
    with transaction.atomic():
        # Created inside the transaction so a preview (rolled back) leaves no sync state behind.
        state, _ = ContentImport.objects.get_or_create(key=SYNC_KEY, defaults={'metadata': {'buildings': {}, 'stories': {}}})
        baseline = {kind: dict(state.metadata.get(kind, {})) for kind in ('buildings', 'stories', 'items', 'shops')}
        def create_building(key, data, position):
            b = Building(key=key, published=True, position=position, guide_section=_section_for(data['name'].split(' · ')[0], key, guide_markdown))
            _apply_building(b, data, position)
        _sync_kind('building', [(f['id'], json_building(f)) for f in buildings_data['features']],
                   {b.key: b for b in Building.objects.select_related('model_resource').prefetch_related('citations')},
                   None, db_building, create_building, lambda b, d, p: _apply_building(b, d, p),
                   baseline['buildings'], imported.imported_at, report)

        def create_story(key, data, position):
            if data['target']['type'] != 'landmark' and data['target']['key'] not in other_places().get(data['target']['type'], {}):
                report.conflicts.append(f'story {key}: 대상 {data["target"]}가 지도에 없음'); return
            _apply_story(Story(key=key, published=True, position=position), data)
        _sync_kind('story', [(r['id'], json_story(r)) for r in stories_data['stories']],
                   {s.key: s for s in Story.objects.select_related('building').prefetch_related('citations')},
                   None, db_story, create_story, lambda s, d, p: _apply_story(s, d),
                   baseline['stories'], imported.imported_at, report)

        economy = ContentImport.objects.filter(key=ECONOMY_IMPORT_KEY).first()
        if economy_data is not None and economy is not None:
            def create_item(key, data, position):
                _apply_item(Item(key=key, position=position, published=True), data)
            _sync_kind('item', [(k, json_item(row)) for k, row in economy_data['items'].items()],
                       {i.key: i for i in Item.objects.all()}, None, db_item, create_item, lambda i, d, p: _apply_item(i, d),
                       baseline['items'], economy.imported_at, report)
            def create_shop(key, data, position):
                _apply_shop(Shop(key=key, position=position, published=True), data)
            _sync_kind('shop', [(k, json_shop(row)) for k, row in economy_data['shops'].items()],
                       {s.key: s for s in Shop.objects.prefetch_related('items')}, None, db_shop, create_shop, lambda s, d, p: _apply_shop(s, d),
                       baseline['shops'], economy.imported_at, report)

        if guide_markdown is not None:
            from .content import guide_markdown as db_guide
            import re
            parts = lambda text: re.split(r'^#{1,3} ', text, flags=re.M)
            report.guide_differences = len(set(p.strip() for p in parts(guide_markdown)) ^ set(p.strip() for p in parts(db_guide())))
        state.metadata = baseline
        state.save()
        if not apply:
            transaction.set_rollback(True)
    return report
