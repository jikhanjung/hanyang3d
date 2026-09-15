"""Player accounts: a name and a password, separate from back-office staff users.

Names follow the walking-together rules (Hangul, Han, Latin letters, digits, space, _ . -; at most 16 characters) and
are compared through a key (NFKC, lower case) so look-alike spellings cannot register twice. Passwords are stored as
Django password hashes. Failed logins are limited per name and per client IP; the IP is kept only as a keyed hash.
"""
import hashlib
import hmac
import unicodedata
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import LoginAttempt, Player

PASSWORD_MIN = 6
PASSWORD_MAX = 128
FAILURES_ALLOWED = 10
FAILURE_WINDOW = timedelta(minutes=15)


class AccountError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def _allowed(ch):
    code = ord(ch)
    return (ch.isascii() and (ch.isalnum() or ch in ' _.-')) or 0xAC00 <= code <= 0xD7A3 or 0x1100 <= code <= 0x11FF \
        or 0x3130 <= code <= 0x318F or 0x4E00 <= code <= 0x9FFF or 0x3400 <= code <= 0x4DBF or 0xF900 <= code <= 0xFAFF


def normalize_name(value):
    if not isinstance(value, str):
        return None
    name = ' '.join(unicodedata.normalize('NFKC', value).split(' ')).strip()
    while '  ' in name:
        name = name.replace('  ', ' ')
    if not name or len(name) > 16 or not all(_allowed(ch) for ch in name):
        return None
    return name


def name_key(name):
    return name.lower()


def client_ip_hash(request):
    ip = request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR', '')
    return hmac.new(settings.SECRET_KEY.encode(), ip.encode(), hashlib.sha256).hexdigest()


def _check_password_rules(password):
    if not isinstance(password, str) or not PASSWORD_MIN <= len(password) <= PASSWORD_MAX:
        raise AccountError(400, f'비밀번호는 {PASSWORD_MIN}자 이상으로 정하시오.')


def register(request, current, name, password, start_money):
    """Create an account; a nameless (anonymous) current player is upgraded and keeps its purse."""
    clean = normalize_name(name)
    if not clean:
        raise AccountError(400, '이름은 1~16자의 한글·한자·영문·숫자·공백·_ . -로 정하시오.')
    _check_password_rules(password)
    try:
        with transaction.atomic():
            if current and not current.name_key:
                player = Player.objects.select_for_update().get(pk=current.pk)
            else:
                import uuid
                player = Player(token=uuid.uuid4(), money=start_money)
            player.name, player.name_key, player.password = clean, name_key(clean), make_password(password)
            player.save()
    except IntegrityError:
        raise AccountError(409, '이미 쓰는 이름이오. 다른 이름을 고르시오.')
    return player


def login(request, name, password):
    clean = normalize_name(name)
    key = name_key(clean) if clean else ''
    ip = client_ip_hash(request)
    since = timezone.now() - FAILURE_WINDOW
    if LoginAttempt.objects.filter(created_at__gte=since, name_key=key).count() >= FAILURES_ALLOWED or \
            LoginAttempt.objects.filter(created_at__gte=since, ip_hash=ip).count() >= FAILURES_ALLOWED:
        raise AccountError(429, '로그인을 너무 여러 번 틀렸소. 잠시 뒤에 다시 하시오.')
    player = Player.objects.filter(name_key=key).first() if clean else None
    # check_password runs even for unknown names so timing does not reveal which names exist.
    valid = check_password(password if isinstance(password, str) else '', player.password if player else make_password(None))
    if not player or not valid:
        LoginAttempt.objects.create(name_key=key, ip_hash=ip)
        raise AccountError(401, '이름이나 비밀번호가 맞지 않소.')
    LoginAttempt.objects.filter(name_key=key).delete()
    return player
