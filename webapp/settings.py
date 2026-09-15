"""GIS service and editorial back office."""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RUNTIME_DATA_ROOT = Path(os.environ.get('HANYANG_DATA_ROOT', str(BASE_DIR)))
REQUIRE_DATA_BUNDLE = os.environ.get('HANYANG_REQUIRE_BUNDLE', '0') == '1'
APP_VERSION = os.environ.get('HANYANG_VERSION', (BASE_DIR / 'deploy/DOCKER_VERSION').read_text().strip())
WALK_WORLD_VERSION = os.environ.get('HANYANG_WALK_WORLD_VERSION', 'v0.2.4')
MULTIPLAYER_URL = os.environ.get('HANYANG_MULTIPLAYER_URL', '/multiplayer')
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY') or secrets.token_urlsafe(48)
if os.environ.get('DJANGO_COOKIE_SECURE', '0') == '1':
    # Behind HTTPS every worker must share one real key: a random fallback differs per worker and
    # silently breaks sessions and CSRF, and the example placeholder is public.
    from .secret_check import require_production_secret
    require_production_secret(os.environ.get('DJANGO_SECRET_KEY', ''))
DEBUG = False
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')
if os.environ.get('DJANGO_TRUST_PROXY', '0') == '1':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
ROOT_URLCONF = 'webapp.urls'
WSGI_APPLICATION = 'webapp.wsgi.application'
CONTENT_SOURCE = os.environ.get('HANYANG_CONTENT_SOURCE', 'database')
if CONTENT_SOURCE not in {'database', 'files'}:
    raise ValueError('HANYANG_CONTENT_SOURCE must be database or files')
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3',
                        'NAME': os.environ.get('HANYANG_DB_PATH', str(BASE_DIR / 'data/content.sqlite3')),
                        'OPTIONS': {'timeout': 20}}}
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = os.environ.get('DJANGO_COOKIE_SECURE', '0') == '1'
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
INSTALLED_APPS = ['django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
                  'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'webapp']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware',
              'django.contrib.sessions.middleware.SessionMiddleware',
              'django.middleware.common.CommonMiddleware',
              'django.middleware.csrf.CsrfViewMiddleware',
              'django.contrib.auth.middleware.AuthenticationMiddleware',
              'django.contrib.messages.middleware.MessageMiddleware',
              'django.middleware.clickjacking.XFrameOptionsMiddleware']
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates',
              'DIRS': [BASE_DIR / 'webapp/templates'], 'APP_DIRS': True,
              'OPTIONS': {'context_processors': [
                  'django.template.context_processors.request',
                  'django.contrib.auth.context_processors.auth',
                  'django.contrib.messages.context_processors.messages']}}]
LANGUAGE_CODE = 'ko-kr'
TIME_ZONE = 'Asia/Seoul'
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
