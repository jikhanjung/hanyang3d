# 콘텐츠 DB 백업과 복원

## fsis2026에서 참고한 것

로컬 형제 프로젝트의 `scripts/backup_db.py`, `scripts/test_backup_db.py`, `docs/operation_manual/backup.md`, 개발 기록 220·222를 직접 확인했다. 운영 DB의 단순 파일 복사 대신 SQLite online backup API를 쓰고, 검증된 스냅샷만 채택하는 구조를 따른다.

| 규칙 | 한양3D 구현 |
|---|---|
| 실행 중 DB의 일관된 사본 | online backup API, 원본은 읽기 전용 URI로 연다 |
| 채택 전 검증 | 사본의 integrity_check·foreign_key_check, 실패 시 정상 백업 이름으로 채택하지 않음 |
| 반출 위생 | 사본의 django_session 제거 후 항상 VACUUM; 운영 세션·계정에는 쓰지 않음 |
| 단일 파일 보관 | 사본을 DELETE journal mode로 바꾸고 연결을 닫은 뒤 채택; WAL/SHM 고아 방지 |
| 이전 백업 보존 | 새 백업 실패·원본 부재·디스크 부족이면 prune 하지 않음 |
| 보존 범위 | 서로 다른 시간대의 최신 24개, 같은 시간 재실행은 새 검증본만 유지 |
| 실패 표시 | DB 옆 CONTENT_BACKUP_FAILED; healthz는 서빙 가능 시 degraded(200), 배포 smoke는 실패 |
| 증거 | 손상 사본 하나를 .corrupt로 보존, 로테이션·오프사이트 대상에서 제외 |
| 겹친 실행 | 백업 디렉터리의 파일 잠금; 새 이름으로 원자적 채택 |

백업에는 비밀번호 해시와 관리자 변경 이력이 남으므로 접근 제한한다. 원본 DB·비밀 설정을 저장소에 넣지 않는다. 실패 플래그는 DB 손상 확정이 아니라 백업 실패 알림이며, 다음 정상 스냅샷이 검증된 뒤 해제된다.

## 제공하는 도구

- `deploy/host/backup_content.py`: 호스트 Python 표준 라이브러리만 사용. 시간별 백업·검증·24개 보존·5 GiB 여유 공간 검사. 백업 폴더는 700, 스냅샷은 600이다.
- `manage.py backup_content <새 파일>`: 로컬 개발 또는 일회용 컨테이너에서 같은 구현으로 수동 백업한다. 출력 경로가 있어도 덮어쓰지 않는다.
- `manage.py export_content <새 JSON>`: 계정·세션을 제외한 콘텐츠 교환용. 전체 복원용 DB 스냅샷과 구별한다.

운영 명령(`/etc/cron.d/hanyang3d-content`에 매시 정각 root 실행으로 등록):

```bash
sudo python3 /srv/hanyang3d/backup_content.py \
  --database /srv/hanyang3d/content/content.sqlite3 \
  --directory /srv/hanyang3d/backups/content/hourly
```

라이브 DB를 읽을 수 있는 전용 백업 계정이나 root로 실행한다. 웹 컨테이너는 백업 경로를 마운트하지 않는다. 시간별 작업은 위 명령을 매시 실행하고 stdout/stderr를 접근 제한된 로그에 기록하도록 등록한다. 백업 실패는 기존 모니터링의 health/smoke에 연결한다. 시간별 로그는 `/srv/hanyang3d/backups/content/hourly.log`(600)에 기록한다. 외부 메시지 알림은 연결하지 않았다.

## 보관 레인

1. **배포 전**: 새 migration 전에 즉시 검증된 스냅샷을 별도 `pre-deploy` 경로에 둔다. `content/`는 컨테이너 사용자 소유라 `deploy.sh`는 DB 확인과 백업을 모두 `sudo -n`으로 하며, sudo를 쓸 수 없으면 배포를 거부한다(v0.3.4까지는 확인이 로그인 사용자 권한이라 늘 건너뛰었다). 시간별 prune은 이 경로를 건드리지 않는다. 코드·데이터 버전과 함께 기록한다. 새 스냅샷을 검증·채택한 뒤 같은 폴더의 배포 전 스냅샷을 최신 10개만 남긴다(`--keep-snapshots`).
2. **운영 시간별**: 검증된 DB 단일 파일을 최소 24개 보존한다. 24 × 1시간 ≥ 일간 오프사이트 24시간. 스케줄을 바꾸면 이 관계를 다시 확인한다.
3. **개발 호스트·NAS**: 운영의 검증된 시간별 `.sqlite3` 산출물만 개발 호스트가 SSH로 pull한다. 라이브 DB, `.corrupt`, `.lock`, 임시 파일은 가져오지 않는다. 내려받은 파일을 다시 integrity_check·foreign_key_check·세션 0행으로 검증한 후 current/history로 채택한다. 새 사본 검증 실패나 최신 백업 부재 시 과거본을 정리하지 않는다. NAS는 개발 호스트의 검증된 사본을 받는다.

fsis2026과 같이 오프사이트 실행본은 `system-operation/m710q/backup-hanyang3d.py`가 정본이다. m710q 사용자 크론에 매일 05:15(KST) 실행으로 등록했다. 개발 호스트 `/home/jikhanjung/backups/hanyang3d`는 일간 30일, NAS `/nas/JikhanJung/hanyang3d_backup`는 90일 이후 월초 사본을 보존한다. 각 경로에 `current`, `db_history`, `configuration_history`를 두며, 운영 `.env`·`.env.django`·Compose 설정도 접근 제한 묶음으로 보관한다. `export_content_snapshot.py`는 3시간 이내의 검증된 사본만 반출한다. 2026-09-15 첫 SSH pull과 NAS 채택을 완료했다. 실행 결과는 개발 호스트의 `status.json`, 출력은 `backup.log`에 남는다.

모형 코드·공개 지도 리소스는 현재 버전 이미지·지도 묶음에서 복원 가능하다. DB에는 그 목록과 연결이 들어간다. 향후 백오피스에서 파일 업로드를 허용하면 업로드 디렉터리의 별도 스냅샷 레인이 반드시 추가되어야 한다. fsis의 uploads link-dest 방식이 그때의 참고 대상이다.

## 복원 순서

1. 목표 스냅샷을 사본으로 열어 무결성·외래 키를 확인하고, 당시 이미지 버전·migration과 맞는지 확인한다. 원본 백업을 직접 수정하지 않는다.
2. 현재 DB가 정상이라면 교체 직전 검증 백업을 별도 경로에 남긴다. 손상 상태이면 정상 백업을 덮어쓰거나 정리하지 않는다.
3. **DB를 쓰는 모든 컨테이너·관리 명령을 중지하고 중지가 성공했는지 확인한다.** 지금 DB writer는 웹 서비스다. 멀티플레이는 이 DB를 사용하지 않는다.
4. 중지 상태에서 현재 DB 디렉터리를 보존하고 스냅샷 사본을 새 DB 경로에 설치한다. 이전 DB의 `-wal`·`-shm`을 새 DB와 섞지 않는다. UID/GID 10001과 접근 권한을 맞춘다.
5. 스냅샷과 호환되는 이미지를 시작해 health, 백오피스 로그인, 건물·이야기 수, 한 건의 편집·조회까지 확인한다. 복원한 DB는 세션이 비어 있어 다시 로그인해야 한다.

자동으로 운영 DB를 교체하는 restore 명령은 제공하지 않는다. 테스트는 WAL 상태의 운영 편집 사본을 복원해 읽기·쓰기까지 확인하며, 2026-09-15 운영 스냅샷의 별도 사본을 네트워크 없는 일회용 v0.3.0 컨테이너에 복원해 건물 103·이야기 33·설명 102·리소스 108, 관리자 존재, 세션 0행과 읽기·쓰기를 확인했다.
