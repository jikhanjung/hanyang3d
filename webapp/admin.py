from django.contrib import admin
from django import forms
from django.core.exceptions import ValidationError
from django.forms.models import BaseInlineFormSet

from .models import Building, Citation, GuideSection, Resource, Story

admin.site.site_header = '한양3D 백오피스'
admin.site.site_title = '한양3D 관리'
admin.site.index_title = '콘텐츠와 리소스 관리'


class CitationFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        if isinstance(self.instance, Story) and self.instance.published:
            present = any(f.cleaned_data and not f.cleaned_data.get('DELETE') and f.cleaned_data.get('title') for f in self.forms)
            if not present:
                raise ValidationError('이야기를 공개하려면 출처를 하나 이상 입력하세요.')


class CitationInline(admin.TabularInline):
    model = Citation
    extra = 1
    fields = ['title', 'url', 'position']
    formset = CitationFormSet


class BuildingCitationInline(CitationInline):
    fk_name = 'building'
    exclude = ['story']


class StoryCitationInline(CitationInline):
    fk_name = 'story'
    exclude = ['building']


class StableKeyAdmin(admin.ModelAdmin):
    readonly_fields = ['updated_at']
    def get_readonly_fields(self, request, obj=None):
        return [*self.readonly_fields, *(['key'] if obj else [])]


@admin.register(Building)
class BuildingAdmin(StableKeyAdmin):
    list_display = ['name', 'category', 'model_resource', 'published', 'updated_at']
    list_filter = ['published', 'category', 'model_resource']
    search_fields = ['key', 'name', 'summary']
    autocomplete_fields = ['model_resource', 'guide_section']
    inlines = [BuildingCitationInline]
    fieldsets = [
        ('건물', {'fields': ['key', 'name', 'category', 'published', 'position']}),
        ('설명', {'fields': ['summary', 'period', 'in_1750', 'guide_section']}),
        ('모형', {'fields': ['model_resource']}),
        ('고급 배치 설정', {'fields': ['map_config'], 'classes': ['collapse']}),
        ('기록', {'fields': ['updated_at']}),
    ]


class StoryForm(forms.ModelForm):
    class Meta:
        model = Story
        fields = '__all__'
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from .content import other_places
        places = other_places()
        self.fields['target_key'] = forms.ChoiceField(label='다리·동네', required=False, choices=[('', '건물 이야기에서는 선택하지 않음'), ('다리', list(places['bridge'].items())), ('동네', list(places['place'].items()))])


@admin.register(Story)
class StoryAdmin(StableKeyAdmin):
    form = StoryForm
    list_display = ['title', 'target_type', 'building', 'year', 'published', 'updated_at']
    list_filter = ['published', 'target_type', 'legend']
    search_fields = ['key', 'title', 'text', 'building__name', 'target_key']
    autocomplete_fields = ['building']
    inlines = [StoryCitationInline]
    fieldsets = [
        ('이야기', {'fields': ['key', 'title', 'year', 'legend', 'text', 'published', 'position']}),
        ('연결할 장소', {'fields': ['target_type', 'building', 'target_key']}),
        ('기록', {'fields': ['updated_at']}),
    ]


@admin.register(GuideSection)
class GuideSectionAdmin(StableKeyAdmin):
    list_display = ['title', 'level', 'published', 'position', 'updated_at']
    list_filter = ['published', 'level']
    search_fields = ['title', 'body', 'buildings__name']
    fields = ['key', 'title', 'level', 'body', 'published', 'position', 'updated_at']


@admin.register(Resource)
class ResourceAdmin(StableKeyAdmin):
    list_display = ['name', 'kind', 'renderer', 'path', 'updated_at']
    list_filter = ['kind', 'renderer']
    search_fields = ['key', 'name', 'path', 'description']
    fields = ['key', 'name', 'kind', 'path', 'renderer', 'description', 'source_url', 'license', 'updated_at']
