import math
from pathlib import PurePosixPath

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import models
from django.db.models import Q

from .model_resources import MODEL_RESOURCES


def validate_public_url(value):
    URLValidator(schemes=['http', 'https'])(value)


def validate_map_config(value):
    if not isinstance(value, dict):
        raise ValidationError('배치 설정은 JSON 객체여야 합니다.')
    def finite(v):
        if isinstance(v, float) and not math.isfinite(v):
            raise ValidationError('배치 설정에 유한하지 않은 수를 사용할 수 없습니다.')
        if isinstance(v, dict):
            for child in v.values(): finite(child)
        elif isinstance(v, list):
            for child in v: finite(child)
    finite(value)
    def numbers(v, length):
        return isinstance(v, list) and len(v) == length and all(type(n) in (int, float) for n in v)
    size = value.get('symbol_size_m')
    if not numbers(size, 3) or not all(0 < n <= 5000 for n in size):
        raise ValidationError('symbol_size_m에는 0보다 크고 5000 이하인 너비·높이·깊이가 필요합니다.')
    if any(k in value for k in ('id', 'name', 'category', 'info', 'display_model', 'model_resource')):
        raise ValidationError('이름·분류·설명·모형은 별도 필드에서 관리합니다.')
    if ('lat' in value or 'source_position' not in value) and (type(value.get('lat')) not in (int, float) or not -90 <= value['lat'] <= 90):
        raise ValidationError('올바른 lat 값이 필요합니다.')
    if ('lon' in value or 'source_position' not in value) and (type(value.get('lon')) not in (int, float) or not -180 <= value['lon'] <= 180):
        raise ValidationError('올바른 lon 값이 필요합니다.')
    if 'display_yaw_deg' in value and type(value['display_yaw_deg']) not in (int, float):
        raise ValidationError('모형 방향은 숫자여야 합니다.')
    if 'source_plot' in value:
        plot = value['source_plot']
        if not isinstance(plot, dict) or not all(numbers(plot.get(k), 2) for k in ('near_start', 'near_end', 'back')):
            raise ValidationError('원도 대지는 near_start·near_end·back 좌표가 필요합니다.')
    if 'road_axis' in value:
        axis = value['road_axis']
        if not isinstance(axis, dict) or not isinstance(axis.get('pixel_points'), list) or len(axis['pixel_points']) != 2 or not all(numbers(v, 2) for v in axis['pixel_points']):
            raise ValidationError('도로 축에는 두 점의 좌표가 필요합니다.')
    if 'source_position' in value:
        position = value['source_position']
        if not isinstance(position, dict) or not numbers(position.get('pixel'), 2):
            raise ValidationError('원도 위치에는 두 개의 pixel 좌표가 필요합니다.')
        from django.conf import settings
        import json
        expected = json.loads((settings.BASE_DIR / 'gis/control_points/doseong_modern_preview.json').read_text())['input_sha256']
        if position.get('source_sha256') != expected:
            raise ValidationError('원도 위치의 해시가 현재 지도와 다릅니다.')


class EditedModel(models.Model):
    updated_at = models.DateTimeField('수정 시각', auto_now=True)
    class Meta:
        abstract = True


class Resource(EditedModel):
    key = models.SlugField('리소스 ID', max_length=160, unique=True)
    name = models.CharField('이름', max_length=240)
    kind = models.CharField('종류', max_length=20, choices=[('model', '건물 모형'), ('file', '공개 파일')])
    path = models.CharField('리소스 경로', max_length=500, help_text='배포된 공개 리소스의 상대 경로입니다. 파일은 DB에 저장하지 않습니다.')
    renderer = models.CharField('모형 생성기', max_length=60, blank=True, choices=[(key, row[0]) for key, row in MODEL_RESOURCES.items()])
    description = models.TextField('설명', blank=True)
    source_url = models.URLField('출처 URL', max_length=1000, blank=True, validators=[validate_public_url])
    license = models.CharField('이용 조건', max_length=300, blank=True)
    class Meta:
        ordering = ['kind', 'name']
        verbose_name = '리소스'
        verbose_name_plural = '리소스 목록'
    def __str__(self): return self.name
    def clean(self):
        from .resources import public_resource_paths
        if self.path not in public_resource_paths() or '..' in PurePosixPath(self.path).parts:
            raise ValidationError({'path': '배포된 공개 리소스 목록에 있는 경로만 등록할 수 있습니다.'})
        if self.kind == 'model':
            if self.renderer not in MODEL_RESOURCES or self.path != MODEL_RESOURCES[self.renderer][1]:
                raise ValidationError({'renderer': '모형 생성기와 등록된 파일 경로가 일치해야 합니다.'})
        elif self.renderer:
            raise ValidationError({'renderer': '일반 파일은 모형 생성기를 지정하지 않습니다.'})


class GuideSection(EditedModel):
    key = models.SlugField('설명 ID', max_length=100, unique=True)
    title = models.CharField('제목', max_length=240)
    level = models.PositiveSmallIntegerField('제목 단계', choices=[(1, '문서 제목'), (2, '분류'), (3, '건물 설명')], default=3)
    body = models.TextField('상세 설명', blank=True, help_text='문단·목록·표·링크를 Markdown으로 작성합니다. HTML은 표시하지 않습니다.')
    position = models.PositiveIntegerField('표시 순서', default=0)
    published = models.BooleanField('공개', default=False)
    class Meta:
        ordering = ['position', 'id']
        verbose_name = '상세 설명'
        verbose_name_plural = '건물 상세 설명·안내'
    def __str__(self): return self.title


class Building(EditedModel):
    key = models.SlugField('건물 ID', max_length=100, unique=True, help_text='지도·이야기 연결에 쓰이는 고정 ID입니다.')
    name = models.CharField('이름', max_length=240)
    category = models.CharField('분류', max_length=80)
    summary = models.TextField('짧은 소개', blank=True)
    period = models.TextField('존재 시기', blank=True)
    in_1750 = models.TextField('1750년 무렵', blank=True)
    guide_section = models.ForeignKey(GuideSection, verbose_name='상세 설명', null=True, blank=True, on_delete=models.PROTECT, related_name='buildings')
    model_resource = models.ForeignKey(Resource, verbose_name='건물 모형', on_delete=models.PROTECT, limit_choices_to={'kind': 'model'}, related_name='buildings')
    map_config = models.JSONField('배치·모형 매개변수', validators=[validate_map_config], help_text='원도 좌표·크기 등 지도 배치 설정입니다. 고급 편집 항목입니다.')
    position = models.PositiveIntegerField('표시 순서', default=0)
    published = models.BooleanField('공개', default=False)
    class Meta:
        ordering = ['position', 'id']
        verbose_name = '건물'
        verbose_name_plural = '건물 목록'
    def __str__(self): return self.name
    @property
    def label(self): return self.name.split(' · ')[0]
    def clean(self):
        if self.model_resource_id and self.model_resource.kind != 'model':
            raise ValidationError({'model_resource': '건물 모형 리소스를 선택해야 합니다.'})


class Story(EditedModel):
    key = models.SlugField('이야기 ID', max_length=120, unique=True)
    building = models.ForeignKey(Building, verbose_name='건물', null=True, blank=True, on_delete=models.PROTECT, related_name='stories')
    target_type = models.CharField('장소 종류', max_length=20, choices=[('landmark', '건물'), ('bridge', '다리'), ('place', '동네')], default='landmark')
    target_key = models.CharField('다리·동네 ID', max_length=160, blank=True, help_text='건물 이야기에서는 비워 둡니다.')
    title = models.CharField('제목', max_length=240)
    year = models.CharField('연도', max_length=80, blank=True)
    legend = models.BooleanField('전해지는 이야기', default=False)
    text = models.TextField('본문')
    position = models.PositiveIntegerField('표시 순서', default=0)
    published = models.BooleanField('공개', default=False)
    class Meta:
        ordering = ['position', 'id']
        verbose_name = '이야기'
        verbose_name_plural = '장소 이야기'
        constraints = [models.CheckConstraint(condition=(Q(target_type='landmark', building__isnull=False, target_key='') | (Q(target_type__in=['bridge', 'place'], building__isnull=True) & ~Q(target_key=''))), name='story_has_one_target')]
    def __str__(self): return self.title
    def clean(self):
        if self.target_type == 'landmark':
            if not self.building_id or self.target_key:
                raise ValidationError('건물 이야기에는 건물만 선택하고 다리·동네 ID는 비워 두세요.')
        else:
            from .content import other_places
            if self.building_id or self.target_key not in other_places().get(self.target_type, {}):
                raise ValidationError('실제 다리·동네 ID를 선택하고 건물은 비워 두세요.')


class Citation(models.Model):
    building = models.ForeignKey(Building, null=True, blank=True, on_delete=models.CASCADE, related_name='citations')
    story = models.ForeignKey(Story, null=True, blank=True, on_delete=models.CASCADE, related_name='citations')
    title = models.CharField('출처 이름', max_length=300)
    url = models.URLField('URL', max_length=1500, validators=[validate_public_url])
    position = models.PositiveIntegerField('표시 순서', default=0)
    class Meta:
        ordering = ['position', 'id']
        verbose_name = '출처'
        verbose_name_plural = '출처'
        constraints = [models.CheckConstraint(condition=(Q(building__isnull=False, story__isnull=True) | Q(building__isnull=True, story__isnull=False)), name='citation_has_one_owner')]
    def __str__(self): return self.title


class ContentImport(models.Model):
    key = models.CharField(max_length=100, unique=True)
    imported_at = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict)
