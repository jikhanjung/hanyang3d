"""Local GIS review service; no database or authentication is needed yet."""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
RUNTIME_DATA_ROOT = Path(os.environ.get('HANYANG_DATA_ROOT', str(BASE_DIR)))
REQUIRE_DATA_BUNDLE = os.environ.get('HANYANG_REQUIRE_BUNDLE', '0') == '1'
APP_VERSION = os.environ.get('HANYANG_VERSION', (BASE_DIR / 'deploy/DOCKER_VERSION').read_text().strip())
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY') or secrets.token_urlsafe(48)
DEBUG = False
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')
if os.environ.get('DJANGO_TRUST_PROXY', '0') == '1':
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
ROOT_URLCONF = 'webapp.urls'
WSGI_APPLICATION = 'webapp.wsgi.application'
INSTALLED_APPS = ['webapp']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware',
              'django.middleware.common.CommonMiddleware',
              'django.middleware.csrf.CsrfViewMiddleware',
              'django.middleware.clickjacking.XFrameOptionsMiddleware']
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates',
              'DIRS': [BASE_DIR / 'webapp/templates'], 'APP_DIRS': False,
              'OPTIONS': {'loaders': ['django.template.loaders.filesystem.Loader']}}]
LANGUAGE_CODE = 'ko-kr'
TIME_ZONE = 'Asia/Seoul'
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
