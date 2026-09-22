"""Office pages. Reads are plain ORM queries; every write goes through a small form, checks a permission,
and leaves an admin LogEntry so the change history stays in one place with the Django admin's."""
import json
from datetime import timedelta
from django.conf import settings
from django.contrib import messages
from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Count, F, Q, Sum
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST
from django.contrib.auth.views import LoginView
from ..models import Building, ContentImport, EventProgress, Item, Player, PlayerItem, SceneDataset, Shop, Story, Trade
from .access import office_required

MODULES = [
    ('office:dashboard', '대시보드'), ('office:players', '사용자'), ('office:buildings', '건물'),
    ('office:items', '물건·가격'), ('office:events', '이벤트'),
]


def item_names():
    """Item key → Korean name from the goods catalog (DB in database mode), for trade and progress tables."""
    from ..economy import catalog
    return {k: v['name'] for k, v in catalog()['items'].items()}


def named_trades(rows, names):
    for t in rows:
        t.item_name = names.get(t.item, t.item)
        yield t


REMEMBER_SECONDS = 30 * 24 * 3600


class OfficeLoginView(LoginView):
    """Staff login with a 'remember me' box: checked keeps the session 30 days, unchecked ends it with the browser."""
    template_name = 'office/login.html'
    redirect_authenticated_user = True

    def form_valid(self, form):
        response = super().form_valid(form)
        self.request.session.set_expiry(REMEMBER_SECONDS if self.request.POST.get('remember') else 0)
        return response


def page(request, template, active, **context):
    context.update(modules=MODULES, active=active, app_version=settings.APP_VERSION)
    return render(request, f'office/{template}.html', context)


@office_required()
def dashboard(request):
    now = timezone.now()
    day, week = now - timedelta(days=1), now - timedelta(days=7)
    players = Player.objects
    trades = Trade.objects
    event_rows = list(EventProgress.objects.values('event_id', 'status').annotate(n=Count('id')).order_by('event_id', 'status'))
    events = {}
    for row in event_rows:
        events.setdefault(row['event_id'], {})[row['status']] = row['n']
    last_import = ContentImport.objects.order_by('-id').first()
    return page(request, 'dashboard', 'office:dashboard',
        counts={
            'players': players.count(), 'accounts': players.exclude(name_key=None).count(),
            'active_day': players.filter(last_seen__gte=day).count(), 'active_week': players.filter(last_seen__gte=week).count(),
            'money': players.aggregate(total=Sum('money'))['total'] or 0,
            'trades_day': trades.filter(created_at__gte=day).count(), 'trades_week': trades.filter(created_at__gte=week).count(),
            'buildings': Building.objects.filter(published=True).count(), 'buildings_draft': Building.objects.filter(published=False).count(),
            'stories': Story.objects.filter(published=True).count(), 'items': Item.objects.filter(published=True).count(), 'shops': Shop.objects.count(),
            'datasets': SceneDataset.objects.count(),
        },
        events=events, last_import=last_import,
        recent_trades=list(named_trades(trades.select_related('player').order_by('-created_at')[:10], item_names())),
        recent_players=players.exclude(name_key=None).order_by('-last_seen')[:10],
        content_source=settings.CONTENT_SOURCE)


@office_required()
def players(request):
    q = request.GET.get('q', '').strip()
    rows = Player.objects.exclude(name_key=None).annotate(item_kinds=Count('items', distinct=True), trade_count=Count('trades', distinct=True)).order_by('-last_seen')
    if q:
        rows = rows.filter(name__icontains=q)
    return page(request, 'players', 'office:players', players=rows[:200], q=q, total=rows.count())


@office_required()
def player_detail(request, pk):
    player = get_object_or_404(Player, pk=pk)
    names = item_names()
    items = [(names.get(i.item, i.item), i.quantity) for i in player.items.order_by('item')]
    content_type = ContentType.objects.get_for_model(Player)
    history = LogEntry.objects.filter(content_type=content_type, object_id=str(player.pk)).select_related('user').order_by('-action_time')[:20]
    return page(request, 'player', 'office:players', player=player, items=items,
                trades=list(named_trades(player.trades.order_by('-created_at')[:50], names)), progress=player.historical_events.order_by('event_id'),
                history=history, can_adjust=request.user.has_perm('webapp.change_player'), can_reset=request.user.has_perm('webapp.change_eventprogress'))


def _reason(request):
    reason = request.POST.get('reason', '').strip()
    if len(reason) < 2:
        messages.error(request, '사유를 적어야 합니다.')
        return None
    return reason


def _log_player(request, player, note):
    LogEntry.objects.log_actions(request.user.pk, [player], CHANGE, note, single_object=True)


@require_POST
@office_required('webapp.change_player')
def player_money(request, pk):
    """Add or take coins with a reason. The delta is applied atomically and can never push the purse below zero."""
    player = get_object_or_404(Player, pk=pk)
    reason = _reason(request)
    try:
        delta = int(request.POST.get('delta', ''))
        if delta == 0 or abs(delta) > 1_000_000:
            raise ValueError
    except ValueError:
        messages.error(request, '변화량은 0이 아닌 정수(±1,000,000문 이내)여야 합니다.')
        return redirect('office:player', pk)
    if reason is None:
        return redirect('office:player', pk)
    with transaction.atomic():
        locked = Player.objects.select_for_update().get(pk=pk)
        if locked.money + delta < 0:
            messages.error(request, f'엽전이 {locked.money}문뿐이라 {-delta}문을 뺄 수 없습니다.')
            return redirect('office:player', pk)
        before = locked.money
        Player.objects.filter(pk=pk).update(money=F('money') + delta)
        after = before + delta
        _log_player(request, locked, f'엽전 {before} → {after} ({delta:+}) · {reason}')
    messages.success(request, f'{player.name}: 엽전 {before}문 → {after}문')
    return redirect('office:player', pk)


@require_POST
@office_required('webapp.change_eventprogress')
def player_event_reset(request, pk, progress_pk):
    """Put one visit back to 'not started' so the account plays it from the beginning; completion time is kept in the log."""
    player = get_object_or_404(Player, pk=pk)
    row = get_object_or_404(EventProgress, pk=progress_pk, player=player)
    reason = _reason(request)
    if reason is None:
        return redirect('office:player', pk)
    note = f'회상 {row.event_id} 초기화 (이전: {row.status}, 확인 지점 {row.checkpoint}, 완료 {row.completed_at.isoformat() if row.completed_at else "없음"}) · {reason}'
    row.status, row.checkpoint, row.completed_at = 'new', 0, None
    row.save()
    _log_player(request, player, note)
    messages.success(request, f'{player.name}: {row.event_id} 진행을 처음으로 되돌렸습니다.')
    return redirect('office:player', pk)


@office_required()
def buildings(request):
    year = request.GET.get('year', '')
    q = request.GET.get('q', '').strip()
    rows = Building.objects.select_related('model_resource', 'guide_section').order_by('position', 'id')
    if q:
        rows = rows.filter(Q(name__icontains=q) | Q(key__icontains=q))
    listed = [b for b in rows if not year or str(b.map_config.get('scene_year', 1750)) == year]
    story_counts = dict(Story.objects.values_list('building_id').annotate(n=Count('id')).values_list('building_id', 'n'))
    return page(request, 'buildings', 'office:buildings', buildings=listed, year=year, q=q, story_counts=story_counts, total=len(listed))


@office_required()
def items(request):
    shops = {s.key: s for s in Shop.objects.prefetch_related('items')}
    sold_in = {}
    for shop in shops.values():
        for item in shop.items.all():
            sold_in.setdefault(item.key, []).append(shop.key)
    owned = dict(PlayerItem.objects.values_list('item').annotate(n=Sum('quantity')).values_list('item', 'n'))
    rows = [(i, sold_in.get(i.key, []), owned.get(i.key, 0)) for i in Item.objects.order_by('position', 'id')]
    return page(request, 'items', 'office:items', items=rows, can_edit=request.user.has_perm('webapp.change_item'))


@require_POST
@office_required('webapp.change_item')
def item_price(request, key):
    item = get_object_or_404(Item, key=key)
    try:
        price = int(request.POST.get('price', ''))
        if price < 1:
            raise ValueError
    except ValueError:
        messages.error(request, '값은 1문 이상의 정수여야 합니다.')
        return redirect('office:items')
    before = item.price
    if price != before:
        item.price = price
        item.full_clean(); item.save()
        LogEntry.objects.log_actions(request.user.pk, [item], CHANGE, f'값 {before}문 → {price}문 (도성도감)', single_object=True)
        messages.success(request, f'{item.name}: {before}문 → {price}문')
    return redirect('office:items')


def _events():
    from ..events import definitions, last_checkpoint, validate
    result = []
    for slug, data in definitions().items():
        try:
            validate(data); problem = ''
        except ValueError as error:
            problem = str(error)
        stats = {r['status']: r['n'] for r in EventProgress.objects.filter(event_id=data['id']).values('status').annotate(n=Count('id'))}
        result.append({'slug': slug, 'data': data, 'problem': problem, 'last': last_checkpoint(data), 'stats': stats,
                       'keepsake_name': item_names().get(data['keepsake']['item'], data['keepsake']['item'])})
    return result


@office_required()
def events(request):
    return page(request, 'events', 'office:events', events=_events(), event_dir='gis/events')


@office_required()
def event_detail(request, slug):
    entry = next((e for e in _events() if e['slug'] == slug), None)
    if entry is None:
        raise Http404
    from ..events import stage_checkpoints
    stages, first = [], 1
    for s in entry['data']['stages']:
        n = stage_checkpoints(s)
        stages.append({'stage': s, 'first': first, 'last': first + n - 1, 'json': json.dumps(s, ensure_ascii=False, indent=1)})
        first += n
    progress = EventProgress.objects.filter(event_id=entry['data']['id']).select_related('player').order_by('-updated_at')[:50]
    return page(request, 'event', 'office:events', event=entry, stages=stages, progress=progress)
