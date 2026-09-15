"""Production secret key requirement, kept importable without Django settings for tests."""

PLACEHOLDERS = ('replace-with', 'change-me', 'changeme', 'secret')


def require_production_secret(value):
    """Raise when the production secret key is missing, too short or an example placeholder."""
    from django.core.exceptions import ImproperlyConfigured
    lowered = value.lower()
    if len(value) < 32 or any(lowered.startswith(p) or lowered == p for p in PLACEHOLDERS):
        raise ImproperlyConfigured('DJANGO_SECRET_KEY must be a random value of at least 32 characters in production.')
