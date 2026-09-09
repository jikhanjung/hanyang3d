# GIS 작업 공간

- `control_points/`: 기준점·검사점 CSV와 정합 실험 기록
- `georeferenced/`: 정합 래스터 등 대용량 결과, 기본 Git 제외
- `roads/`, `waterways/`, `parcels/`, `buildings/`, `walls/`, `archaeology/`: 주제별 벡터·메타데이터

파일럿 경계는 확정 후 `pilot_area.geojson`으로 추가합니다. 편집용 GeoPackage는 P2–P3에서 실제 스키마와 함께 생성하며 대용량이면 외부 저장합니다. 작은 교환용 GeoJSON과 생성 절차는 Git에 보관합니다. 원도 판독본과 보정본은 파일명·메타데이터로 구분합니다.

[좌표 정합](../docs/georeferencing.md)과 [데이터 모델](../docs/data_model.md)을 따릅니다. 검증된 지리 좌표를 가진 공간 데이터는 없습니다. 1908 도엽의 상대 픽셀 정합, 원본 픽셀 좌표의 도로 3개·하수구 2개 판독선, 도성 전도와 현대 지형의 검토용 TPS 배치를 작성했습니다. TPS의 현대 좌표 후보점은 정밀 지리 정합 결과로 사용하지 않습니다.

1908–1912 비교 후보는 `control_points/1908_1912_comparison_cases.json`, 두 분기점 가설의 미채택 근거는 `control_points/1908_1912_branch_hypothesis.json`에 있습니다. 시대 간 확정 대응점은 0개입니다. 판독선 JSON은 이미지 좌표를 담은 사용자 정의 형식이며 지리 GeoJSON이 아닙니다.

[Django GIS 서비스](../webapp/README.md)를 실행하면 첫 화면에서 도엽 연결·원본 지도 비교·대응점 기록을 볼 수 있습니다.
