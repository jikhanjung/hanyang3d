"""Editable scene payloads. Code and large source assets remain in the release image/runtime bundle."""
import hashlib
import json
import math
from django.conf import settings
from django.core.exceptions import ValidationError

DATASETS = {
    'infrastructure1907': ('1907 성곽·물길·도로', 'gis/walls/seoul1907_infrastructure.json'),
    'settlement1907': ('1907 추정 민가 배치', 'gis/buildings/seoul1907_settlement.json'),
    'walking1907': ('1907 행인 경로', 'gis/roads/seoul1907_walking_routes.json'),
    'people1907': ('1907 인물·대화', 'gis/characters/seoul1907.json'),
    'trams1907': ('1907 전차 운행', 'gis/transport/seoul1907_trams.json'),
}

def digest(value):
    return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',', ':'),allow_nan=False).encode()).hexdigest()

def seed(key):
    return json.loads((settings.BASE_DIR / DATASETS[key][1]).read_text())

def load(key):
    if settings.CONTENT_SOURCE == 'database':
        from .models import SceneDataset
        row = SceneDataset.objects.filter(key=key).first()
        if row is not None:
            return row.data
    return seed(key)

def validate(key, value):
    def fail(message): raise ValidationError(message)
    if key not in DATASETS: fail('지원하지 않는 장면 데이터입니다.')
    if not isinstance(value,dict): fail('장면 데이터는 JSON 객체여야 합니다.')
    def finite(v):
        if isinstance(v,float) and not math.isfinite(v): fail('유한한 숫자만 사용할 수 있습니다.')
        if isinstance(v,dict):
            for x in v.values(): finite(x)
        elif isinstance(v,list):
            for x in v: finite(x)
    finite(value)
    if len(json.dumps(value,ensure_ascii=False))>2_000_000: fail('장면 데이터가 너무 큽니다.')
    def num(n,lo,hi): return type(n) in (int,float) and lo<=n<=hi
    def points(p,minimum=2):
        if not isinstance(p,list) or not minimum<=len(p)<=10000 or any(not isinstance(q,list) or len(q)!=2 or not num(q[0],0,2667) or not num(q[1],0,3750) for q in p): fail('원도 범위 안의 좌표 목록이 필요합니다.')
    if key in ('infrastructure1907','settlement1907','walking1907','trams1907'):
        expected=json.loads((settings.BASE_DIR/'gis/control_points/seoul1907.json').read_text())['image_sha256']
        if value.get('source_sha256')!=expected: fail('원도 해시가 현재 지도와 다릅니다.')
    try:
        if key=='infrastructure1907':
            points(value['wall']['centerline']);points(value['river']['centerline'])
            for k in ('width_m','height_m','parapet_height_m'):
                if not num(value['wall'][k],.01,100): fail('성벽 치수가 범위를 벗어났습니다.')
            widths=value['river']['half_widths_px']
            if len(widths)!=len(value['river']['centerline']) or any(not num(n,.1,100) for n in widths): fail('물길 폭과 중심선이 맞지 않습니다.')
            for bridge in value['river']['bridges']:
                points([bridge['pixel']],1)
            roads=value['roads']['features'];ids=set()
            if not 1<=len(roads)<=200: fail('도로 수는 1–200개여야 합니다.')
            for r in roads:
                if not isinstance(r['id'],str) or r['id'] in ids: fail('도로 ID는 고유해야 합니다.')
                ids.add(r['id']);points(r['centerline'])
                if not num(r['width_m'],1,100): fail('도로 폭은 1–100m여야 합니다.')
        elif key=='settlement1907':
            if type(value['seed']) is not int or not 0<=value['seed']<=4294967295: fail('시드가 잘못되었습니다.')
            if type(value['max_houses']) is not int or not 0<=value['max_houses']<=5000: fail('가옥 수는 0–5000이어야 합니다.')
            if not num(value['road_spacing_m'],8,200): fail('가옥 간격은 8–200m여야 합니다.')
            points(value['mapped_centers'],0)
            if len(value['excluded_polygons'])>200: fail('제외 영역이 너무 많습니다.')
            for p in value['excluded_polygons']: points(p,3)
        elif key=='walking1907':
            ids=set();count=0
            for r in value['routes']:
                points(r['pixel_points'])
                if r['id'] in ids: fail('보행 경로 ID가 중복되었습니다.')
                ids.add(r['id'])
                if type(r['count']) is not int or not 0<=r['count']<=300: fail('행인 수가 잘못되었습니다.')
                count+=r['count']
            if not ids or len(ids)>100 or count>500: fail('보행 경로/행인 수가 너무 많습니다.')
        elif key=='trams1907':
            points(value['route']['pixels'])
            if any(a==b for a,b in zip(value['route']['pixels'],value['route']['pixels'][1:])): fail('전차 경로에 중복된 연속 점이 있습니다.')
            if not num(value['simulation']['speed_mps'],.1,20) or not num(value['simulation']['end_pause_seconds'],0,300): fail('전차 속도·대기가 범위를 벗어났습니다.')
            if not num(value['model']['gauge_m'],.5,2): fail('전차 궤간이 범위를 벗어났습니다.')
        else:
            # These schemas are consumed by the existing character/tram controllers.
            original=seed(key)
            if not set(original).issubset(value): fail('필수 인물/전차 항목이 빠졌습니다.')
            for k,v in original.items():
                if not isinstance(value[k],type(v)): fail('인물/전차 항목의 형식이 다릅니다: '+k)
            for role in ('guards','merchants','storytellers'):
                if len(value[role])>200: fail('인물 수가 너무 많습니다.')
                for row in value[role]:
                    if not isinstance(row.get('building'),str): fail('인물의 건물 ID가 필요합니다.')
                    if role=='guards' and (type(row['count']) is not int or not 1<=row['count']<=10): fail('경비병 수가 잘못되었습니다.')
            points([value['horse_dealer']['placement']['pixel']],1)
    except (KeyError,TypeError,ValueError) as error:
        fail('장면 데이터 구조가 올바르지 않습니다: '+str(error))
