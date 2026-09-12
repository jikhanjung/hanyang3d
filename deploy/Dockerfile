FROM python:3.12-slim

ARG APP_VERSION=v0.0.6
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="Hanyang 3D" \
      org.opencontainers.image.version=$APP_VERSION \
      org.opencontainers.image.revision=$VCS_REF

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    HANYANG_VERSION=$APP_VERSION HANYANG_DATA_ROOT=/runtime \
    HANYANG_REQUIRE_BUNDLE=1 DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
WORKDIR /app
COPY requirements.txt ./
COPY deploy/requirements.txt deploy/requirements.txt
RUN pip install --no-cache-dir -r deploy/requirements.txt \
    && groupadd --gid 10001 hanyang \
    && useradd --uid 10001 --gid 10001 --no-create-home hanyang
COPY webapp/ webapp/
COPY gis/ gis/
COPY data/catalog/assets.csv data/catalog/sources.csv data/catalog/
COPY deploy/ deploy/
COPY manage.py ./
RUN python manage.py check
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "/app/deploy/healthcheck.py"]
ENTRYPOINT ["sh", "/app/deploy/entrypoint.sh"]
