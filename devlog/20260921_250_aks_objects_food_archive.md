# 250 — AKS 물품·음식 모형 수집 완료

2026-09-19 예약한 물품·음식 다운로드가 systemd 사용자 타이머로 실행되어 완료됐다. 실행 장비는 m710q, NAS 보관까지 자동으로 마쳤다.

- 물품: 2026-09-20 09:00 KST 시작, 09:46 완료. 609개 URL 중 603개 검증(20GiB), 6개 실패.
- 음식: 2026-09-21 09:00 KST 시작, 09:13 완료. 180개 URL 중 177개 검증(3.5GiB), 3개 실패.
- NAS `/nas/JikhanJung/hanyang3d_backup/research/aks-hanyang/` 아래에 물품 603·음식 177개가 SHA-256 검증으로 복사됐다(`scheduled-jobs/*.json`의 `nas_verified`).
- 실패 9개는 원본 서버의 404 또는 손상된 GLB 헤더이며 성공에 포함하지 않았다. 목록은 `docs/aks_archive_storage.md`에 기록했다.
- 수집 중 갱신된 `docs/aks_objects_manifest.json`·`aks_objects_catalog.csv`를 완료 상태로 커밋했다. 이제 manifest의 1203개 모형 중 검증 1187·실패 16이다.
- 원본 GLB는 Git·배포 이미지에 넣지 않는다. 앱 적용은 시대·이용 조건 검토 후 결정한다. 운영 배포 없음.
