# 데이터 보관

`catalog/`의 CSV는 Git에서 관리하는 메타데이터 원본입니다. `maps/`, `cadastral/`, `archaeology/`, `photos/`, `plans/`, `texts/`, `terrain/`은 로컬 원본 파일 보관 위치이며 내용은 기본적으로 Git에서 제외합니다.

파일은 가능하면 `<분류>/<source_id>/<asset_id>.<확장자>`로 저장합니다. 원본은 덮어쓰지 않습니다. 외부 보관 시에도 assets 카탈로그에 취득 URL, 저장 위치, checksum을 남깁니다. 아직 LFS나 외부 저장소는 설정하지 않았습니다.

등록 절차는 [자료 수집](../docs/sources.md), 열 정의는 [데이터 모델](../docs/data_model.md)을 따릅니다.
