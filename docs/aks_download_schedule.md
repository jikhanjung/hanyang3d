# AKS 물품·음식 다운로드 예약

등록일: 2026-09-19. 실행 장비: **m710q 개발 PC**, 사용자 `jikhanjung`. 시간대: **Asia/Seoul**.

| 자료 | 고유 URL 수 | 실행 시각 | 타이머 |
|---|---:|---|---|
| 물품 | 609 | 2026-09-20 09:00 KST | `hanyang3d-aks-objects.timer` |
| 음식 | 180 | 2026-09-21 09:00 KST | `hanyang3d-aks-food.timer` |

실제 systemd 사용자 타이머의 다음 실행 시각과 active/enabled 상태를 확인했다. `Linger=yes`라 로그아웃 상태에서도 실행된다. `Persistent=true`와 부팅 시 점검을 함께 사용하므로 꺼져 있던 동안 지난 일정과 중단된 작업은 다음 부팅 때 처리한다. 실행 시각이 아직 안 됐거나 이미 완료한 작업은 즉시 종료한다. 두 일정이 함께 밀려도 파일 요청·NAS 복사는 작업 잠금으로 직렬 실행한다.

한 파일 완료 후 최소 3초 간격으로 요청한다. 실패 시 최대 두 번 시도하고, 429/503은 더 길게 대기한다. GLB 구조·길이·SHA-256을 검증한 파일만 완료로 기록한다. 원본 오류가 있는 항목은 `failed`로 보존하고 성공 항목은 NAS에도 복사·해시 검증한다. 여유 공간 10GiB 아래에서는 다운로드를 중단한다.

프로세스 오류나 NAS 미연결 등으로 중단되면 15분 뒤 재시도한다. 개별 404 등까지 기록하고 순회를 마친 경우는 `complete_with_failures`로 종료하므로 같은 잘못된 링크를 무한 재요청하지 않는다. 다운로드 종료 후 NAS만 실패했다면 다음 재시도는 NAS 복사부터 한다.

## 저장 위치와 결과

- 물품: `data/models/aks-hanyang/objects/`
- 음식: `data/models/aks-hanyang/food/`
- 항목별 결과: [전체 manifest](aks_objects_manifest.json), [CSV](aks_objects_catalog.csv)
- 작업 요약: `data/models/aks-hanyang/scheduled-jobs/objects.json`, `food.json`
- 상세 로그: 같은 폴더의 `objects.log`, `food.log`
- NAS: `/nas/JikhanJung/hanyang3d_backup/research/aks-hanyang/` 아래에 동일 상대 경로로 보관

JSON 요약의 `completed_at`과 `nas_verified`는 다운로드 순회와 NAS 검증을 마쳐야 기록한다. 수집 중에는 manifest/CSV가 Git 커밋 당시 상태보다 최신일 수 있다.

## 확인·중지·재개

```sh
systemctl --user list-timers 'hanyang3d-aks-*' --all
journalctl --user -u hanyang3d-aks@objects.service -u hanyang3d-aks@food.service
python3 scripts/download/run_scheduled_aks.py objects --check
python3 scripts/download/run_scheduled_aks.py food --check
```

예약 중지:

```sh
systemctl --user disable --now hanyang3d-aks-objects.timer hanyang3d-aks-food.timer
systemctl --user stop hanyang3d-aks@objects.service hanyang3d-aks@food.service
```

중단된 작업은 예정일 이후 `systemctl --user start hanyang3d-aks@objects.service` 또는 food로 재개한다. 개별 실패 링크를 나중에 재검사하려면 원본 서버 상태를 확인한 뒤 `python3 scripts/download/fetch_aks_costumes.py --category objects --download --pause 3`을 사용한다(`food`도 동일). 수동 다운로드 후 `python3 scripts/download/backup_aks_archive.py`로 NAS를 갱신한다.

등록 원본은 `scripts/download/systemd/`, 실제 설치본은 `/home/jikhanjung/.config/systemd/user/`다. 서비스 경로와 ConditionHost는 m710q에 맞춰 고정했다.

2026-09-20 운영 확인: 물품 서비스가 09:00:04 KST에 실제 시작했다. 음식 타이머의 다음 실행은 2026-09-21 09:00 KST다.

2026-09-21 완료 확인: 물품은 09:46 KST에 603개 검증·6개 실패, 음식은 09:13 KST에 177개 검증·3개 실패로 `complete_with_failures`·`nas_verified` 상태다. 두 타이머는 다음 실행 예정이 없다. 실패 목록은 [보관 문서](aks_archive_storage.md)에 있다.
