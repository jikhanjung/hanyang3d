# GIS 작업 공간

- `control_points/`: 기준점·검사점 CSV와 정합 실험 기록
- `georeferenced/`: 정합 래스터 등 대용량 결과, 기본 Git 제외
- `roads/`, `waterways/`, `parcels/`, `buildings/`, `walls/`, `archaeology/`: 주제별 벡터·메타데이터

파일럿 경계는 확정 후 `pilot_area.geojson`으로 추가합니다. 편집용 GeoPackage는 P2–P3에서 실제 스키마와 함께 생성하며 대용량이면 외부 저장합니다. 작은 교환용 GeoJSON과 생성 절차는 Git에 보관합니다. 원도 판독본과 보정본은 파일명·메타데이터로 구분합니다.

[좌표 정합](../docs/georeferencing.md)과 [데이터 모델](../docs/data_model.md)을 따릅니다. 현재 공간 데이터는 없습니다.
