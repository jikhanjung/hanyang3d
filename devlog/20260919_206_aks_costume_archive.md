# 206 — AKS 복식 원본 수집과 NAS 보관

2026-09-19 추가 수집: 복식 414개 URL 중 **407개(10.56GiB)** 검증 완료, 7개 실패. 한 파일씩 완료 후 최소 3초 간격으로 요청했다. 물품 609개·음식 180개는 목록만 유지한다.

기존 복식 목록을 그대로 사용하고 추가 URL을 추측하지 않았다. GLB 헤더·전체 길이·청크·JSON을 검증하고 SHA-256, 외부 참조, 필수 확장을 기록했다. 잘못된 응답은 최대 두 번 시도 후 실패로 남겼다.

`fetch_aks_costumes.py`는 검증 완료 파일을 재사용하고 중복 실행을 잠그며 여유 공간 10GiB 아래에서는 중단한다. `catalog_aks_objects.py`도 같은 잠금을 사용하고, 이후 목록 갱신 시 기존 다운로드 기록과 사라진 원본 링크의 이력을 보존한다. 실행 중 목록 재수집이 네트워크 요청 전에 차단되는 것을 확인했다. CSV 다운로드 상태도 갱신했다.

NAS 복사 도구에 복식 manifest를 추가했다. 검증된 GLB만 복사하고 복사본 해시를 확인한 후 정식 파일명으로 채택한다. 개발 PC 원본과 NAS 상태 기록의 파일 수·크기·SHA-256이 모두 일치하는지 완료 시 대조한다. 기존 건축·PDF와 운영 DB 백업을 삭제하거나 교체하지 않았다.

실패 목록:

- `대수.glb`: ValueError: Truncated GLB header
- `대봉잠.glb`: HTTPError: HTTP Error 404: Not Found
- `용잠.glb`: HTTPError: HTTP Error 404: Not Found
- `투구.glb`: HTTPError: HTTP Error 404: Not Found
- `호액.glb`: HTTPError: HTTP Error 404: Not Found
- `어여미.glb`: ValueError: Truncated GLB header
- `쪽머리.glb`: HTTPError: HTTP Error 404: Not Found

[보관 경로·재개 안내](../docs/aks_archive_storage.md), [항목별 JSON](../docs/aks_objects_manifest.json). 모델의 역사적 적합성·개별 이용 조건은 아직 검토 전이며 사이트에 적용하지 않았다.
