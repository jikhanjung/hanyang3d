# 이미지 교체 없는 장면 데이터 갱신

첫 적용에는 SceneDataset 마이그레이션(0007), 웹·멀티플레이 코드 및 compose 설정을 배포해야 한다. 그 뒤에는 동일 이미지에서 DB 값만 수정할 수 있다. DB 모드에서 사용한다.

대상은 1907년 도로·성벽·청계천(infrastructure1907), 민가(settlement1907), 보행 경로(walking1907), 인물(people1907), 전차(trams1907)의 5개 데이터셋과 기존 Building.map_config이다. 건물·이야기·물품은 기존 백오피스도 계속 사용한다. 1750년의 정적 지형·경로 파일이나 모델 생성 코드는 이 갱신 범위가 아니며 이미지/리소스 배포가 필요하다.

## 갱신 절차

운영 서버 `/srv/hanyang3d`에서 현재 값을 내보낸다. 이 파일에는 계정이나 운영 비밀값이 들어가지 않는다.

```sh
docker compose exec -T hanyang3d python manage.py export_scene_data --dataset settlement1907 > before.json
cp before.json update.json
```

`update.json`의 data 내용만 편집한다. expected_sha256은 현재 운영 값의 비교 해시이므로 그대로 둔다. 건물은 `--building 건물키`를 사용하고 map_config를 편집한다. 여러 대상을 한 파일에 담을 수 있다.

```sh
bash update_data.sh /srv/hanyang3d/update.json
```

스크립트는 사전 검증 → 검증된 SQLite 온라인 백업 → 단일 트랜잭션 적용 → 상태 확인 순서로 실행한다. 현재 값과 해시가 다르면 운영 편집 충돌로 중단한다. walking1907 변경 시 같은 이미지의 멀티플레이 컨테이너를 재시작하므로 접속자가 재접속해야 한다. 다른 변경은 지도 새로고침으로 읽는다. 이미지 태그와 운영 설정은 변경하지 않는다.

직접 검사할 때는 `python manage.py apply_scene_data 파일.json`을 사용한다. `--apply` 없이는 저장하지 않는다. 백오피스의 SceneDataset 편집도 가능하지만 검증 백업을 포함하는 위 스크립트를 권장한다. 보행 경로를 백오피스에서 수정했다면 멀티플레이를 별도로 재시작해야 한다.

## 복구와 배포 간 보존

일부 데이터를 되돌리려면 현재 값을 다시 export하고 그 파일의 비교 해시는 유지한 채 data/map_config만 before.json의 내용으로 돌려 갱신한다. 이전 번들을 그대로 재실행하면 충돌 검사가 차단한다. 전체 DB 복원은 계정·인벤토리 등 다른 최신 데이터도 되돌리므로 일반적인 데이터 수정 취소에 사용하지 않는다.

seed_scene_data는 없는 데이터셋만 초기화하며 운영 편집을 덮어쓰지 않는다. 최초 초기화 이후 Git의 해당 JSON을 바꾸는 것만으로 DB가 갱신되지는 않는다. 이후 변경은 명시적인 데이터 번들로 적용한다. 건물 map_config 편집도 콘텐츠 동기화 기준을 임의로 바꾸지 않아 후속 배포에서 운영 변경으로 보호된다.

읽기 API `/api/scene-data/<key>/`는 ETag와 재검증 정책을 제공한다. 쓰기는 공개 API에서 허용하지 않는다. 멀티플레이는 시작할 때 내부 API에서 보행 경로를 읽고 잘못된 데이터라면 시작을 실패시켜 서로 다른 경로로 운영되는 것을 방지한다.
