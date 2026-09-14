# 094 — 운영 서버 디스크 정리와 prune.sh

사용자가 운영 서버 디스크 사용량을 확인하고 줄일 수 있는 것을 찾아 달라고 했다.

## 확인

- 작업 호스트가 곧 dolfinid다(`dolfinid-2`, 34.64.158.160). `ssh dolfinid` 별칭은 이 호스트에 없는 키를 가리켜 실패하므로 로컬에서 확인했다.
- 루트 58G 중 51G 사용(90%), 남은 공간 6.3G.
- 한양3D가 쌓은 것이 가장 컸다. 배포할 때마다 약 280M가 남고 지우는 단계가 없었다.
  - `/srv/hanyang3d/data/`: 버전별 폴더 51개, 6.5G. 서버에 남은 이미지는 v0.1.21·v0.1.22뿐이라 나머지 49개는 롤백에 쓸 수 없었다.
  - `~/hanyang3d-release/`: 업로드한 압축 파일 37벌, 4.8G.
  - `/srv/hanyang3d/releases/`: 초기 v0.0.x 방식의 데이터 압축 파일 16벌, 1.9G.
- 다른 서비스와 공용 항목(journal 1.1G, 비활성 snap, Playwright·npm·pip 캐시, 다른 서비스의 이전 이미지 태그, dolfinserver 데이터)은 영향 범위가 넓어 이번에는 건드리지 않았다.

## 정리 스크립트

`deploy/host/prune.sh`를 추가했다. earththrutime3d의 같은 이름 스크립트를 따랐다.

- 운영 중인 버전(`.env`의 `IMAGE_TAG`)과 가장 새로운 다른 버전 하나(`KEEP=2`)를 남긴다.
- 이 서비스의 이미지, `data/<version>`, `~/hanyang3d-release`·`releases/`의 압축 파일과 SHA256SUMS만 지운다. Docker 전역 정리는 하지 않는다.
- 버전 목록은 데이터 폴더, 이미지 태그, 압축 파일 이름에서 모은다. `DRY_RUN=1`이면 목록만 보여 준다.
- 호스트 묶음에 들어가므로 다음 빌드부터 `/srv/hanyang3d`에 함께 풀린다. 이번에는 직접 설치했다.

## 결과

- 50개 버전을 지워 12.8G를 확보했다. 루트 사용률 90% → 68%, 남은 공간 19G.
- 남은 것: 이미지·데이터·압축 파일 v0.1.21과 v0.1.22, `releases/`의 nginx 설정 사본 3개와 버전 없는 `SHA256SUMS-hanyang3d-runtime`.
- 서버 내부 healthz 정상(v0.1.22, resources 81), 공개 주소 HTTP 200.
- 실제 삭제는 권한 확인에 걸려 사용자가 직접 `bash /srv/hanyang3d/prune.sh`로 실행했다.
