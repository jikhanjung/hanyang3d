# 건물 연대 데이터

`gis/buildings/1750_landmarks.json`의 `temporal_schema_version: 1` 및 각 feature의 `temporal`에 연대를 저장한다. 표시 필터 UI는 아직 추가하지 않았다. 모델의 하위 전각·담장·문은 부모 feature의 기간을 상속한다.

- `existence.start_year`, `existence.end_year`: 건물 또는 시설의 건립·철거/소멸 시기. 미확인 값은 null이다.
- `depiction.start_year`, `depiction.end_year`: 지금 그린 형태·배치가 나타내는 기간. 서기 정수, 양끝 포함.
- `depiction.reference_year`, `reference_precision`: 참고 자료가 가리키는 연도와 정확도. 이것을 건립 연도로 사용하면 안 된다.
- `status`, `note`, `sources`: 연대 근거의 종류·한계·출처.

null은 무한대나 기원년이 아니라 미확인이다. 연대 필터를 만들 때 미확인 자료의 표시 정책을 별도로 정해야 한다. 정확히 검증된 모형과 비교자료를 바탕으로 한 개략 모형도 구분한다.

## 현재 입력

육조거리 관청 11곳은 S-MAP 자료의 1863년경 배치를 참조한다. `depiction.reference_year=1863`, 정확도 `circa`, `depiction.end_year=1864`, 시작 연도는 미상이다. 1865년 개편 이전 배치 단계의 모형으로 분류하기 위한 종료 경계이며, 1864년에 관청이 철거됐다는 뜻이 아니다. 18세기 지도의 위치에 개략 적용한 모델이므로 1750년의 개별 건물 형상까지 입증하지 않는다.

종묘의 현재 15칸 모형은 1726–1835년 칸수에 대응한다. 정전의 창건·소멸 기간과 구분한다. 다른 기존 위치 표시 및 성문 개념 모형의 연대는 확인 전까지 null로 둔다.
