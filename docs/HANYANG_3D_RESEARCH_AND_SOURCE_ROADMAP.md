---
title: "Hanyang 3D Reconstruction — Research & Source Roadmap"
description: "조선시대 한양의 거리·필지·수계·건축물·지형을 GIS 및 3D로 재구성하기 위한 자료 조사와 향후 개발 계획"
status: "initial research / living document"
last_updated: "2026-09-08"
language: "ko"
---

# Hanyang 3D Reconstruction
## 조선시대 한양의 증거기반 시공간 GIS / 3D 재구성 프로젝트

> **목표:** 조선시대 한양의 거리, 골목, 수계, 필지, 궁궐, 관아, 시전, 성곽, 주거지와 지형을 가능한 한 사료에 근거하여 GIS로 복원하고, 이를 바탕으로 시기별 3D 도시 모델을 구축한다.

이 문서는 프로젝트 시작 단계에서 확인한 자료원, 핵심 사료, 활용 방법, 데이터 구조, 기술적 방향과 향후 조사 과제를 한곳에 정리한 **초기 프로젝트 문서**이다.  
GitHub repository에 넣고 이후 조사·수집·GIS 작업·3D 모델링을 진행하면서 지속적으로 갱신하는 것을 전제로 한다.

---

# 1. 프로젝트의 기본 방향

이 프로젝트를 단순한 "옛 서울 3D 모델"로 만들기보다 다음과 같이 정의하는 것이 바람직하다.

> **Evidence-based spatiotemporal reconstruction of Hanyang**

즉, 하나의 특정 연도에 대한 완성된 상상 복원이 아니라,

- 어떤 위치가 어느 사료에서 확인되는지
- 그 위치가 어느 시기까지 존재했는지
- 도로·필지·건물의 정확도가 어느 정도인지
- 건물의 외형이 실측인지, 사진 추정인지, 유형학적 추정인지
- 서로 다른 시대의 자료가 어떻게 연결되는지

를 데이터에 명시하는 **증거기반 시공간 도시 모델**로 구축한다.

---

# 2. 왜 시간축이 필요한가

현존 자료들은 같은 시기의 한양을 보여주지 않는다.

예를 들어:

- 도성대지도: 18세기 중엽
- 수선총도: 19세기
- 수선전도: 19세기 중엽
- 대한제국기 관아 실측도: 1907–1909
- 한성부지적도: 1908
- 지적원도: 1912
- 초기 사진: 19세기 말–20세기 초

따라서 모든 자료를 하나의 "조선시대 한양"으로 합쳐 버리면 실제로는 존재 시기가 다른 요소들이 동시에 존재하는 오류가 발생한다.

초기에는 다음과 같은 시간 레이어를 고려할 수 있다.

```text
1750s
1780s
1820s–1840s
1860s
1868–1895
1895–1910
1912
```

향후에는 개별 객체에 다음과 같은 속성을 줄 수 있다.

```text
valid_from
valid_to
location_confidence
shape_confidence
height_confidence
evidence_type
source_id
```

---

# 3. 재구성의 핵심 전략

현재 자료 상황을 고려하면 다음 조합이 가장 강력하다.

## 3.1 18세기 도시 구조

**도성대지도**

→ 도로  
→ 골목  
→ 하천  
→ 교량  
→ 궁궐  
→ 관아  
→ 행정구역  
→ 군영  
→ 지명  

의 기본 구조를 얻는다.

## 3.2 절대 위치와 필지 좌표

**1908 한성부지적도 + 1912 지적원도**

→ 필지  
→ 도로 경계  
→ 하천  
→ 대지 형태  
→ 근대 초기 도시 좌표  

를 얻는다.

## 3.3 건물 footprint

**궁궐 도형 / 관아 실측도 / 발굴조사 도면**

→ 건물 배치  
→ 실제 기단 위치  
→ 건물 크기  
→ 행랑  
→ 담장  
→ 마당  

을 얻는다.

## 3.4 건물 높이와 외형

**사진 + 실측도 + 현존 건축물 + 건축 유형학**

→ 처마 높이  
→ 지붕 형태  
→ 지붕 경사  
→ 건물 층수  
→ 문·담장  
→ 거리 스케일  

을 추정한다.

---

# 4. 자료 신뢰도 계층

재구성에 사용할 증거는 모두 동일한 정확도를 갖지 않는다.

초기 기준으로 다음과 같은 hierarchy를 권장한다.

| 등급 | 자료 | 주 용도 |
|---|---|---|
| A | 발굴 실측도 | 위치·기단·도로·수로 |
| A | 근대 초기 실측도 | 건물 footprint·필지 |
| A | 지적원도 | 필지·도로 경계 |
| A | 궁궐 도형 | 궁궐 건물 배치 |
| B | 정밀 고지도 | 도로망·지명·관아 위치 |
| B | 초기 사진 | 외형·높이·거리 경관 |
| B | 현존 전통건축 실측 | 건축 유형 |
| C | 일반 고지도 | 상대 위치 |
| C | 문헌 기록 | 존재·기능·명칭 |
| D | 유형학적 추정 | 자료가 없는 일반 주거·부속건물 |

**중요:**  
최종 3D 모델에는 가능한 경우 "확실한 복원"과 "추정 복원"을 시각적으로 또는 메타데이터로 구분한다.

---

# 5. 현재 확인된 핵심 자료원

---

## 5.1 서울역사아카이브 — 서울 고지도

URL:

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveList.do?ctgryId=CTGRY780&type=C

현재 서울지도 > 고지도 > 서울지도 항목에 **35건**이 정리되어 있다.

주요 항목:

- 도성대지도
- 도성대지도 부분도 1–12
- 대동여지도 도성도
- 대동여지도 경조오부도
- 수선총도
- 한양전도 계열
- 근대 전환기의 경성 관련 지도

서울역사박물관 자체 설명에 따르면 박물관은 약 **1,400여 건의 지도 유물**을 소장하고 있으며 그 일부를 온라인 공개하고 있다.

자료 이용 안내:

https://museum.seoul.go.kr/archive/archiveGuide/arcvGuide.jsp

서울역사아카이브 자료는 일반적으로 상세 페이지에서 다운로드 가능하며, 아카이브 이용안내에서는 공공누리 조건을 안내한다.  
단, 개별 유물 상세페이지의 이용 조건이 다를 수 있으므로 **각 파일별 license 필드를 별도로 기록**해야 한다.

---

# 6. 최우선 고지도

---

## 6.1 도성대지도 都城大地圖

서울역사아카이브:

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do?ctgryId=CTGRY780&fileId=026d2d85-e2f5-4673-bf8d-5a9ed6163bee&fileSn=1098&type=C&upperNodeId=CTGRY780

서울역사박물관 유물정보:

https://museum.seoul.go.kr/scwm/relic/RelicView.do?cdLanguage=KOR&mcseqno1=014165&mcseqno2=00000&mcsjgbnc=PS01003026001

크기:

```text
213 × 180 cm
```

제작연대는 출처에 따라 다소 차이가 있다.

- 서울역사박물관 유물정보: 약 **1753–1760**
- 국가유산포털: **1753–1764**

따라서 database에는 다음처럼 기록하는 것이 안전하다.

```text
date_start = 1753
date_end = 1764
preferred_interpretation = 1753–1760
date_note = "institution-dependent dating"
```

### 중요성

현재 확인되는 도성도 가운데 가장 큰 규모이며 다음 정보가 매우 상세하다.

- 대로
- 골목길
- 청계천과 지류
- 교량
- 궁궐
- 관서
- 군영
- 오부
- 방·계 지명
- 북한산과 내사산
- 성곽

도로는 붉은 선으로 표시되어 있으며 **대로뿐 아니라 골목까지 표현**되어 있다.

따라서 18세기 한양 도로망 reconstruction의 핵심 자료이다.

### GIS 활용

1. 고해상도 원본 확보
2. 현대 지형과 성문·궁궐 위치를 이용한 control point 선정
3. non-linear georeferencing
4. road centerline vectorization
5. stream vectorization
6. bridges / gates / government offices point layer 생성
7. 지명 OCR 또는 수동 전사

---

## 6.2 도성대지도 부분도

도성대지도는 여러 부분도로 제공된다.

예:

### 부분도 4 — 경복궁·사직단

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do?ctgryId=CTGRY780&fileId=8e68c916-1acb-46ad-8458-2322b7f76c87&fileSn=1100&type=C&upperNodeId=CTGRY780

### 부분도 8 — 운종가·청계천

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do?ctgryId=CTGRY780&fileId=fe073a1b-2a35-41c6-98da-3c21d7a4ba20&fileSn=1100&type=C&upperNodeId=CTGRY780

부분도 8에는 다음과 같은 정보가 특히 유용하다.

- 운종가
- 육의전
- 시전
- 광통교
- 수표교
- 장통교
- 종루
- 평시서
- 의금부
- 좌포청
- 혜민서
- 장악원

상업 중심지의 3D 복원에 매우 중요한 자료이다.

---

## 6.3 수선총도 首善總圖

서울역사아카이브:

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do?ctgryId=CTGRY780&fileId=92baf8ae-c659-48d7-968a-d7ff672a371f&fileSn=1098&type=C&upperNodeId=CTGRY780

추정 제작연대:

```text
1824–1870
```

특징:

- 사대문 내부에 집중
- 궁궐 정보가 상세
- 하천과 도로 구분
- 종로의 시전 종류를 구체적으로 표시

확인되는 시전 예:

- 우산전
- 생선전
- 어물전
- 지전
- 저포전
- 면포전
- 사기전

### 활용

종로 상업가 복원 및 시전의 공간적 분포를 복원하는 데 특히 중요하다.

---

## 6.4 사산금표도 四山禁標圖

서울역사아카이브:

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do?ctgryId=CTGRY344&fileId=H-TRNS-2280-349&fileSn=300&type=A&upperNodeId=CTGRY349

연대:

```text
1765
```

주 용도:

- 성저십리
- 도성 외곽
- 산지
- 금표 경계
- 묘지 분포
- 도성 외부 토지 이용

도성 안뿐 아니라 **한양의 외곽 landscape**를 복원하는 데 중요하다.

---

# 7. 규장각 자료

## 7.1 도성도 都城圖

규장각 원문검색:

https://kyudb.snu.ac.kr/book/view.do?book_cd=GR33429_00

정보:

```text
청구기호: 古軸4709-3
제작: 작자 미상
연대: 18세기 후반, 정조 연간(1776–1800)
형식: 채색 필사본
크기: 67 × 92 cm
```

### 활용

도성대지도와 다른 계통의 지도로 활용하여 다음을 교차 검증할 수 있다.

- 주요 도로
- 하천
- 궁궐
- 관아
- 지명
- 도성 내부 구조

규장각에서는 향후 다음 키워드도 추가 검색한다.

```text
都城圖
漢陽圖
漢城圖
京城圖
京兆五部圖
首善全圖
首善總圖
```

---

# 8. 근대 초기 지적자료 — 절대 좌표 reconstruction의 핵심

---

## 8.1 1908 한성부지적도

서울역사박물관:

https://museum.seoul.go.kr/cgcm/board/NR_boardView.do?bbsCd=1012&seq=20150316095605491

내용:

1908년 발행 한성부 지적도 중 현재 잔존하는 **29매**를 영인한 자료.

공개 PDF:

```text
한성부지적도.pdf
약 88 MB
```

### 중요성

고지도는 상대적인 공간관계를 잘 보여주지만 정확한 좌표와 필지 형태에는 한계가 있다.

1908 한성부지적도는 다음을 연결하는 bridge 역할을 한다.

```text
조선 후기 고지도
        ↓
대한제국기 도시
        ↓
1912 지적원도
        ↓
현대 지적도
```

### 활용

- 고지도 도로망 georeferencing
- 기존 골목과 근대 도로 구분
- 필지 경계
- 관아 대지
- 하천 경계
- 도시 block morphology

---

## 8.2 1912 경성부 지적원도

국가기록원 지적아카이브:

https://theme.archives.go.kr/next/acreage/

예: 경성부 북부 검색

https://theme.archives.go.kr/next/acreage/listMapTotalSearch.do?depth1=%EA%B2%BD%EA%B8%B0%EB%8F%84&depth2=%EA%B2%BD%EC%84%B1%EB%B6%80&depth3=%EB%B6%81%EB%B6%80&formType=map&locationCode=1111010400&serviceCode=7-7-7

현재 해당 검색에서:

```text
경기도 경성부 북부 지적원도: 82건
생산년도: 1912
생산기관: 조선총독부 임시토지조사국
```

일부 도면:

```text
축척 1:300
```

### 중요성

이 자료는 프로젝트의 **좌표 기준 backbone**으로 사용하는 것이 적절하다.

가능하다면 경성부 전체 지적원도를 수집한다.

수집 메타데이터:

```text
old_district
old_dong
sheet_number
year
scale
archive_id
download_url
image_width
image_height
```

---

# 9. 관아와 육조거리 reconstruction

## 9.1 광화문외제관아실측평면도 光化門外諸官衙實測平面圖

국가기록원 해제:

https://theme.archives.go.kr/next/place/observatory.do?flag=02

추정 연대:

```text
1907–1909
```

축척:

```text
1:600
```

방향:

```text
정북 기준
```

이 도면에는 광화문 앞 행정기관과 필지·건물의 실제 위치가 실측되어 있다.

확인 가능한 기관 예:

서쪽:

- 근위대대
- 경시청
- 군부
- 법부
- 통신관리국

동쪽:

- 내부
- 법무원
- 학부
- 탁지부
- 법관양성소

또한:

- 광화문 월대
- 개천
- 필지
- 건물 footprint

가 나타난다.

### 3D reconstruction에서의 가치

이 도면은 조선시대 육조거리와 대한제국기 관청 배치를 연결할 수 있는 가장 중요한 실측자료 중 하나이다.

---

# 10. 국가기록원 건축설계원도

국가기록원 관련 해제:

https://theme.archives.go.kr/next/place/outline.do?flag=05

국가기록원은 1900년대부터 1945년까지 생산된 **약 26,000매 이상의 건축설계원도**를 소장하고 있다.

자료에는 다음 유형이 포함된다.

- 지적도
- 지형도
- 배치도
- 평면도
- 입면도
- 단면도
- 상세도
- 건구표

일반적인 축척:

```text
지적·지형도: 1:600–1:1000
배치도: 1:300 / 1:600
평면·입면: 주로 1:100
단면·상세: 1:50 / 1:20 등
```

### 왜 조선시대 reconstruction에 중요한가

일제 초기에는 새로운 청사를 짓기 전 **기존 대한제국/조선 관아 건물을 그대로 사용**한 경우가 많다.

따라서:

```text
기존 건물
→ 전용
→ 증축
→ 철거
→ 근대건물 신축
```

과정을 도면에서 역추적할 수 있다.

특히 demolition plan이나 existing-condition plan은 이미 사라진 조선 건축물을 복원할 수 있는 중요한 증거가 될 수 있다.

---

# 11. 궁궐 자료

궁궐은 일반 도시지역보다 훨씬 많은 도면과 실측자료가 존재한다.

---

## 11.1 북궐도형

대상:

```text
경복궁
```

특징:

- 모눈 기반 평면도
- 전각 배치
- 일제강점기 대규모 철거 이전 상황

S-MAP에서도 북궐도형(1907)을 historical layer로 제공하고 있다.

https://smap.seoul.go.kr/

---

## 11.2 동궐도

대상:

```text
창덕궁
창경궁
```

채색 회화이지만 건축물·담장·지형·정원 정보를 매우 풍부하게 포함한다.

---

## 11.3 동궐도형

Hanyang2 설명:

https://dh.aks.ac.kr/hanyang2/wiki/index.php/%EB%8F%99%EA%B6%90%EB%8F%84%ED%98%95

특징:

- 1907년 이후
- 창덕궁·창경궁
- 1.1 cm 정사각 grid
- 건물 위치
- 규모
- 치수
- 문
- 연못
- 지형

궁궐 건물 footprint를 정확하게 reconstruction하기 위한 핵심 자료이다.

---

## 11.4 서궐도 / 서궐도안

대상:

```text
경희궁
```

향후 반드시 별도 수집해야 한다.

---

# 12. 발굴조사 자료

고지도보다 정확한 geometry를 얻을 수 있는 자료가 **발굴도면**이다.

서울역사아카이브 서울발굴기록:

https://museum.seoul.go.kr/archive/excavation/excavationBsnsIntrcn.jsp

주요 발굴지:

- 한양도성
- 의정부지
- 종묘광장
- 진관사
- 수유동 가마터
- 우이동 가마터

---

## 12.1 종묘광장

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveList.do?ctgryId=CTGRY971&type=E

조사:

```text
2008-11-24 – 2011-02-28
약 7,000 m²
```

확인된 유구:

- 조선시대 도로
- 하천
- 시전행랑
- 종묘 앞길

### 중요성

고지도에서 선으로 표시되는 도로가 실제로:

- 어느 폭이었는지
- 어느 깊이였는지
- 배수 구조가 어떠했는지
- 시전과 어떤 관계였는지

를 확인할 수 있다.

---

## 12.2 의정부지

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveList.do?ctgryId=CTGRY898&type=E

조사:

```text
2016–2019
```

확인된 주요 건물지:

- 정본당
- 석획당
- 협선당
- 내행랑
- 연못
- 정자

발굴 결과로 주요 건물의 실제 위치와 배치가 확인되었다.

### GIS 활용

발굴보고서의 plan을 georeference하여 관아 실측도와 비교한다.

```text
발굴 유구
+
1907–1909 실측도
+
1908 지적도
+
도성대지도
```

를 중첩하면 육조거리의 역사적 변화를 상당히 정확하게 복원할 수 있다.

---

# 13. Hanyang2 / 한양도성 타임머신

한국학중앙연구원 Hanyang2:

https://dh.aks.ac.kr/hanyang2/

2022 3D 건축물 목록:

https://dh.aks.ac.kr/hanyang2/wiki/index.php/2022_3D%EB%AA%A8%EB%8D%B8%EB%A7%81-%EA%B1%B4%EC%B6%95%EB%AC%BC

이미 다양한 역사 건물에 대해 3D 모델 및 semantic data가 만들어져 있다.

예:

- 문묘 대성전
- 문묘 명륜당
- 문묘 동무·서무
- 여러 궁궐 건축
- 성곽 관련 시설

### 활용 전략

Hanyang2를 단순히 "기존 3D 모델 다운로드처"로 보기보다 다음을 역추적하는 bibliography로 사용한다.

```text
3D model
→ 해당 건물 wiki
→ 참고 문헌
→ 도면
→ 실측조사
→ 사진
→ 원사료
```

즉 기존 모델보다 **모델을 만들 때 사용한 근거자료**가 더 중요하다.

---

# 14. 서울 S-MAP

https://smap.seoul.go.kr/

현재 S-MAP에는 역사 관련 기능이 존재한다.

- 한양도성 시간여행
- 육조거리 시간여행
- 한양도성 고지도
- 3D historical model

historical map 예:

```text
북궐도형 (1907)
경성시가도 (1927, 1:7,500)
```

3D 모델에는 다음 구분이 사용된다.

```text
복원
실측
재현
```

### 프로젝트 활용

S-MAP은 다음 두 가지 면에서 중요하다.

1. **선행 시스템 분석**
2. **기존 모델의 근거자료 탐색**

궁극적으로 우리 프로젝트는 S-MAP보다 **provenance와 uncertainty가 명확한 research-grade dataset**을 지향할 수 있다.

---

# 15. 미국 Library of Congress

LOC에는 19세기 말–20세기 초 서울 지도와 사진이 존재한다.

서울 지도 소개:

https://blogs.loc.gov/maps/2018/05/maps-of-seoul-south-korea-under-japanese-occupation/

대표 자료:

```text
Korea, Seoul City
1910
scale 1:7,500
```

이러한 지도는 지적원도와 함께 근대 초기 도시 구조를 검증하는 데 유용하다.

---

## 15.1 초기 서울 사진

예:

**The old city wall built over the mountains north of Seoul**

https://www.loc.gov/item/2003665581/

연대:

```text
1904
```

stereograph format이며 고해상도 TIFF도 제공되는 경우가 있다.

### 활용

사진에서 다음을 추출할 수 있다.

- 성벽 높이
- 산 능선
- 지붕 분포
- 도시 밀도
- 건물 높이
- skyline
- 도로 폭

여러 landmark를 이용하면 camera matching도 가능하다.

---

# 16. 일본 국립국회도서관 NDL

NDL Search:

https://ndlsearch.ndl.go.jp/

대표 자료:

**朝鮮全地圖 京城市街全圖**

https://ndlsearch.ndl.go.jp/books/R100000002-I000000555019

발행:

```text
1913
```

축척:

```text
京城市街全圖: 1:10,000
朝鮮全圖: 1:1,200,000
```

### 중요성

한국 기관의 자료와 별개 계통으로 보존된 경성 지도·안내도·도시도 자료를 확보할 수 있다.

검색어:

```text
京城
京城市街
京城府
漢城
朝鮮 京城 地圖
京城 市街圖
```

---

# 17. 국립중앙도서관

https://www.nl.go.kr/

향후 다음 범주를 집중 조사한다.

- 고지도
- 고문헌
- 일제강점기 지도
- 경성 안내도
- 도시계획도
- 사진집
- 조선 후기 지리지

검색어는 한글·한자·일본어를 함께 사용한다.

```text
한양
한성
경성
도성도
한양도
한성도
수선전도
경조오부도
漢陽
漢城
京城
都城圖
首善全圖
```

일부 디지털 원문은 온라인 이용 제한이 있을 수 있으므로 `access_level` 필드를 catalog에 기록한다.

---

# 18. 추가로 반드시 조사해야 할 고지도

현재 확인된 자료 외에 다음 지도군을 체계적으로 수집해야 한다.

## 한양 전역

- 한양도
- 한양전도
- 한성도
- 한성전도
- 도성도
- 경도도
- 경조도
- 경성도
- 한경도
- 조선성시도
- 성시전도
- 한양성시전도

## 김정호 계열

- 수선전도
- 대동여지도 도성도
- 대동여지도 경조오부도
- 동여도 도성도
- 동여도 경조오부도

## 행정·군사

- 도성삼군문분계지도
- 오부 관련 지도
- 군영 배치도

## 궁궐

- 경복궁도
- 북궐도형
- 동궐도
- 동궐도형
- 서궐도
- 서궐도안
- 창덕궁 관련 실측도
- 창경궁 관련 실측도
- 경희궁 관련 도면

---

# 19. 지도 이외의 핵심 자료

3D reconstruction을 위해서는 "지도"라는 범주에서 벗어나야 한다.

수집 대상:

## 19.1 건축 실측보고서

문화재 수리보고서 및 실측조사보고서.

얻을 수 있는 것:

- 평면
- 입면
- 단면
- 부재 치수
- 지붕
- 기단
- 단청
- 재료

---

## 19.2 발굴조사보고서

얻을 수 있는 것:

- 실제 foundation
- 도로 폭
- 배수로
- 수로
- 담장
- 건물지
- 층위별 chronology

---

## 19.3 의궤

궁궐·행사·건축에 관한 의궤에는 다음 정보가 존재할 수 있다.

- 건물 구조
- 행사 동선
- 시설 배치
- 가설 구조물
- 재료
- 규모

---

## 19.4 조선왕조실록 / 승정원일기 / 일성록

특정 시설의:

- 신축
- 화재
- 철거
- 이전
- 개축

연대를 결정하는 데 사용한다.

---

## 19.5 호적 / 방·계 자료

주거 밀도와 행정구역 reconstruction에 활용 가능하다.

---

## 19.6 회화

예:

- 성시전도 계열
- 궁궐도
- 도시 풍속화
- 왕실 행사 그림

거리 경관과 building typology에 도움을 줄 수 있다.

---

# 20. 사진 자료의 활용

초기 사진은 단순 참고이미지가 아니라 **metric evidence**로 사용할 수 있다.

가능한 workflow:

```text
historic photo
      ↓
landmark identification
      ↓
camera position estimation
      ↓
camera focal length estimation
      ↓
3D scene matching
      ↓
building height / roof geometry constraint
```

특히 다음 landmark가 유리하다.

- 산 정상
- 성문
- 성벽
- 궁궐
- 종루
- 큰 관청
- 교량

stereograph가 존재하면 depth estimation 가능성도 검토한다.

---

# 21. 현대 지형 자료

건물보다 먼저 terrain을 구축해야 한다.

필요 자료:

- 현대 DEM / DSM
- LiDAR
- 한양도성 성벽 고도
- 청계천 원지형
- 복개된 지류
- 하천 발굴자료

주의할 점:

현재 서울 지형은 다음으로 크게 변형되었다.

- 도로 절개
- 성토
- 하천 복개
- 도시개발
- 산지 절개
- 철도
- 대형건물 지하공사

따라서 현대 DEM을 그대로 "조선시대 지형"으로 사용해서는 안 된다.

초기에는:

```text
modern DEM
+
archaeological elevations
+
historic streams
+
old road grades
```

로 historical terrain surface를 별도 추정한다.

---

# 22. 3D 건축물 reconstruction의 단계

모든 건물을 개별 수작업 모델링하는 것은 현실적으로 불가능하다.

다음 3단계로 구분하는 것이 좋다.

## Level 1 — landmark reconstruction

실제 건물을 비교적 정확하게 복원.

예:

- 궁궐
- 성문
- 종루
- 관아
- 종묘
- 사직
- 성균관
- 시전행랑

## Level 2 — evidence-based generic building

필지와 건물 footprint는 known, 외형은 건축 유형으로 추정.

## Level 3 — procedural urban infill

일반 민가·부속건물.

입력:

```text
parcel
building footprint probability
social district
road type
terrain
```

출력:

```text
hanok type
courtyard
roof orientation
wall
gate
building height
```

---

# 23. 도로 reconstruction

도로는 다음 자료를 단계적으로 비교한다.

```text
도성대지도
↓
19세기 지도
↓
1908 한성부지적도
↓
1912 지적원도
↓
1920s 경성지도
↓
현대 지적도
```

도로 객체에 다음 속성을 둔다.

```text
road_id
name_current
name_historic
geometry
valid_from
valid_to
width_est
source_id
confidence
```

도로 폭을 알 수 없는 경우:

- 발굴자료
- 지적도
- 사진
- 시전행랑 위치

를 이용해 추정한다.

---

# 24. 필지 reconstruction

조선시대 자체 cadastral map은 충분하지 않으므로 1908–1912 지적자료에서 역추적한다.

주의:

1912년 필지가 조선 후기 필지와 동일하다고 가정해서는 안 된다.

따라서 다음 변화도 기록해야 한다.

```text
parcel split
parcel merge
road widening
government acquisition
stream modification
palace expansion
```

---

# 25. 수계 reconstruction

한양의 도시 구조에서 청계천과 지류는 핵심이다.

수집 대상:

- 청계천 본류
- 지류
- 교량
- 암거
- 배수로
- 우물

도성대지도는 하천 본류와 지류를 구분해서 묘사하며, 여러 교량 이름도 제공한다.

발굴조사 자료와 지적도를 함께 사용하면 실제 channel 위치를 검증할 수 있다.

---

# 26. 객체별 provenance

모든 geometry는 source를 가져야 한다.

예:

```yaml
id: gov-office-uijeongbu-main
name: 정본당
type: government_building

valid_from: 1860
valid_to: 1910

geometry_source:
  - excavation_2019
  - gwanghwamun_plan_1908

appearance_source:
  - historical_photo_x

confidence:
  location: 0.99
  footprint: 0.98
  height: 0.55
  roof: 0.70
```

---

# 27. confidence 모델

권장 필드:

```text
existence_confidence
location_confidence
footprint_confidence
height_confidence
appearance_confidence
chronology_confidence
```

예:

| 값 | 의미 |
|---:|---|
| 1.0 | 실측/발굴로 직접 확인 |
| 0.8 | 여러 독립 자료 일치 |
| 0.6 | 한 개의 비교적 정확한 사료 |
| 0.4 | 간접 추정 |
| 0.2 | 유형학적 보간 |
| 0.0 | 추정 불가능 |

---

# 28. 권장 source catalog

초기에는 CSV 또는 SQLite/DuckDB로 시작할 수 있다.

`data/catalog/sources.csv`

권장 필드:

```text
id
title
title_hanja
title_japanese
date_start
date_end
date_text
creator
institution
collection
archive_id
source_type
url
download_url
access_level
license
map_scale
coverage
roads
parcels
buildings
terrain
waterways
photographs
image_width
image_height
georeferenced
local_path
notes
priority
verification_status
```

---

# 29. spatial feature schema

## roads

```text
id
geometry
name
name_hanja
road_class
width
valid_from
valid_to
confidence
source_ids
```

## waterways

```text
id
geometry
name
type
width
valid_from
valid_to
confidence
source_ids
```

## parcels

```text
id
geometry
cadastral_number
valid_from
valid_to
source_ids
```

## buildings

```text
id
geometry
name
type
roof_type
floors
height
valid_from
valid_to
location_confidence
shape_confidence
appearance_confidence
source_ids
```

## archaeological_features

```text
id
geometry
site
feature_type
period
elevation
report
source_id
```

---

# 30. 권장 repository 구조

```text
hanyang-3d/
│
├── README.md
├── LICENSE
├── CITATION.cff
│
├── docs/
│   ├── RESEARCH_AND_SOURCE_ROADMAP.md
│   ├── scope.md
│   ├── methodology.md
│   ├── chronology.md
│   ├── data_model.md
│   ├── georeferencing.md
│   ├── reconstruction_rules.md
│   └── sources.md
│
├── data/
│   ├── catalog/
│   │   ├── sources.csv
│   │   ├── sources.json
│   │   └── institutions.csv
│   │
│   ├── maps/
│   ├── cadastral/
│   ├── archaeology/
│   ├── photos/
│   ├── plans/
│   ├── texts/
│   └── terrain/
│
├── gis/
│   ├── control_points/
│   ├── georeferenced/
│   ├── roads/
│   ├── waterways/
│   ├── parcels/
│   ├── buildings/
│   ├── walls/
│   └── archaeology/
│
├── scripts/
│   ├── catalog/
│   ├── download/
│   ├── georeference/
│   ├── vectorize/
│   ├── validate/
│   └── export/
│
├── notebooks/
│
├── models/
│   ├── landmarks/
│   ├── procedural/
│   └── generated/
│
└── references/
    ├── bibliography.bib
    └── source_notes/
```

---

# 31. 대용량 원본 파일 관리

고해상도 지도와 PDF는 Git repository에 직접 넣지 않는 것이 좋다.

권장 방식:

```text
Git
→ metadata / scripts / vector data

Git LFS 또는 external storage
→ large images / scans

source URL
→ 원본 provenance
```

각 파일에는 checksum을 기록한다.

```text
sha256
```

이를 통해 외부 사이트의 파일이 변경되거나 교체되는 경우를 검출할 수 있다.

---

# 32. 초기 자동화 대상

Codex를 활용하여 다음 작업을 자동화할 수 있다.

## catalog crawler

```text
서울역사아카이브
→ title
→ date
→ archive id
→ description
→ license
→ download URL
```

## download manager

```text
source catalog
→ download
→ checksum
→ file metadata
```

## image metadata extractor

```text
width
height
DPI
format
file size
```

## map tiler

대형 지도를 IIIF 또는 tiled image 형태로 변환.

## GIS exporter

```text
GeoPackage
GeoJSON
PMTiles
```

---

# 33. Georeferencing 전략

고지도는 현대 지도처럼 동일한 scale과 projection을 갖지 않는다.

따라서 단순 affine transform보다:

- polynomial transform
- thin plate spline
- local rubber-sheeting

을 비교해야 한다.

Control point 후보:

- 흥인지문
- 숭례문
- 숙정문
- 창의문
- 경복궁 주요 문
- 종묘
- 사직단
- 청계천 주요 교량
- 산 정상
- 성곽 곡점

주의:

고지도에서 산세는 회화적으로 표현되므로 terrain feature를 control point로 과도하게 사용하면 왜곡이 커질 수 있다.

---

# 34. 지도 간 변형 자체도 데이터이다

고지도의 distortion을 단순 오류로 간주하지 말 것.

예:

```text
도성대지도 road
vs
1912 cadastral road
```

차이는 다음 중 하나일 수 있다.

1. 지도 제작의 cartographic distortion
2. 실제 도로 변경
3. 지적 측량 오차
4. georeferencing error

따라서 원본 vector와 corrected vector를 둘 다 보관하는 것이 좋다.

---

# 35. AI / Computer Vision 활용 가능성

향후 다음을 자동화할 수 있다.

## 지도 요소 segmentation

클래스:

```text
road
river
wall
building
text
mountain
administrative_boundary
```

## OCR

한문 지명 OCR은 일반 OCR만으로 충분하지 않을 가능성이 높다.

workflow:

```text
text detection
→ crop
→ OCR
→ gazetteer matching
→ human validation
```

## map matching

도성대지도에서 검출된 road graph를 1912 road graph와 graph matching하는 방법도 검토할 수 있다.

---

# 36. Gazetteer 구축

별도의 historical place database가 필요하다.

예:

```text
place_id
name_hangul
name_hanja
alternate_names
modern_name
type
valid_from
valid_to
lon
lat
source_ids
```

예:

```text
광통교
廣通橋
광교
bridge
```

동일 장소가 시대마다 이름이 바뀌므로 문자열 자체를 ID로 사용하지 않는다.

---

# 37. 향후 추가 조사 기관

국내:

- 서울역사박물관
- 한양도성박물관
- 국립고궁박물관
- 국립중앙박물관
- 국립중앙도서관
- 국가기록원
- 서울대학교 규장각한국학연구원
- 한국학중앙연구원 장서각
- 문화유산 관련 조사기관
- 서울시 문화본부
- 서울역사편찬원
- 국토지리정보원
- 서울기록원

해외:

- Library of Congress
- National Diet Library
- 일본 국립공문서관
- 일본 대학 도서관
- Harvard-Yenching
- British Library
- Bibliothèque nationale de France
- University map collections

---

# 38. 향후 검색할 자료 유형

```text
map
cadastral map
survey map
city plan
palace plan
architectural drawing
excavation report
repair report
photograph
stereograph
panorama
painting
uigwe
government record
land register
gazetteer
travel guide
military survey
```

---

# 39. 다국어 검색어

## 한국어

```text
한양 지도
한성 지도
서울 고지도
도성도
한양도
한양전도
수선전도
수선총도
경조오부도
한성부 지적도
경성부 지적원도
육조거리
광화문 관아
경복궁 배치도
동궐도
동궐도형
북궐도형
서궐도
발굴조사 보고서
```

## 한자

```text
漢陽
漢城
都城
都城圖
京兆
京兆五部
首善
首善全圖
首善總圖
光化門
六曹
```

## 일본어

```text
京城
京城府
京城市街
京城市街図
京城府地図
朝鮮 京城 地図
漢城 地図
朝鮮総督府 京城
```

---

# 40. 라이선스와 재사용

자료마다 다음을 반드시 기록한다.

```text
copyright_status
license_name
commercial_use
derivative_use
attribution_required
download_allowed
redistribution_allowed
```

주의:

동일한 유물이라도

- 박물관 소장유물 페이지
- 아카이브 디지털 이미지
- 발간 도록 PDF

에 서로 다른 이용조건이 적용될 수 있다.

따라서 **"기관 단위 license"가 아니라 "asset 단위 license"**로 관리한다.

---

# 41. 가장 먼저 해야 할 작업

## Phase 0 — repository

- GitHub repository 생성
- README
- 이 문서 추가
- source schema 생성
- issue template 생성

---

## Phase 1 — source catalog

우선 다음 기관 전체를 catalog한다.

1. 서울역사아카이브
2. 국가기록원 지적아카이브
3. 규장각
4. Hanyang2
5. S-MAP
6. Library of Congress
7. NDL

---

## Phase 2 — 핵심 원본 확보

최우선:

```text
P0-01 도성대지도
P0-02 도성대지도 부분도
P0-03 1908 한성부지적도
P0-04 1912 경성부 지적원도
P0-05 광화문외제관아실측평면도
P0-06 북궐도형
P0-07 동궐도형
```

---

## Phase 3 — coordinate backbone

```text
modern GIS
↓
1912 cadastral georeference
↓
1908 map
↓
19th century maps
↓
18th century maps
```

---

## Phase 4 — roads / streams

우선 사람이 직접 확인 가능한 core area를 선정한다.

추천:

```text
광화문
→ 종로
→ 종묘
→ 동대문
```

이 축은:

- 육조거리
- 운종가
- 시전
- 청계천
- 종묘
- 동대문

을 모두 포함한다.

---

## Phase 5 — landmark 3D

1차:

- 광화문
- 육조거리 관아
- 종루
- 시전행랑
- 청계천 교량

2차:

- 궁궐
- 종묘
- 사직
- 성균관
- 성문

---

## Phase 6 — ordinary urban fabric

필지와 도로 정보를 바탕으로 procedural hanok generation.

---

## Phase 7 — temporal reconstruction

UI 또는 GIS에서:

```text
1755
1780
1840
1868
1895
1908
1912
```

를 전환할 수 있게 한다.

---

# 42. 첫 번째 pilot area 제안

전체 한양을 처음부터 모델링하기보다는 **육조거리–종로–청계천**을 pilot으로 만드는 것이 좋다.

이 지역은 매우 많은 종류의 사료가 겹친다.

```text
도성대지도
+
수선총도
+
1908 지적도
+
1912 지적원도
+
광화문 관아 실측도
+
의정부지 발굴
+
종묘광장 발굴
+
초기 사진
+
S-MAP / Hanyang2
```

따라서 reconstruction methodology를 테스트하기에 가장 좋은 지역이다.

---

# 43. 프로젝트의 최종 데이터 형태

궁극적으로 목표는 단순 Blender scene이 아니라 다음과 같은 dataset이다.

```text
historical GIS
+
temporal database
+
evidence database
+
3D asset library
```

이를 기반으로:

- Blender
- Unreal Engine
- Cesium
- Three.js
- deck.gl
- QGIS
- web GIS

등 여러 front-end에서 사용할 수 있다.

---

# 44. 가능한 최종 결과물

## Research dataset

```text
Hanyang Historical GIS
```

## Interactive viewer

```text
Hanyang Time Machine
```

## 3D city

```text
1750s Hanyang
1800s Hanyang
1900 Hanyang
```

## academic output

- historical GIS methodology
- urban morphology change
- historical map georeferencing
- evidence-based 3D reconstruction
- AI-assisted historical cartography

---

# 45. 프로젝트에서 특히 중요한 원칙

### 1. "예쁜 복원"보다 provenance

모든 요소는 "왜 여기에 있는가"를 설명할 수 있어야 한다.

### 2. 시기를 섞지 않는다

18세기 지도와 1908 실측도를 그대로 한 시점으로 합치지 않는다.

### 3. geometry와 appearance를 분리한다

건물 위치는 확실해도 외형은 모를 수 있다.

### 4. uncertainty를 숨기지 않는다

추정을 database에 명시한다.

### 5. 원사료를 보존한다

vectorized data만 남기지 말고 원본과 좌표변환 정보도 보관한다.

### 6. 재현 가능하게 만든다

```text
source
→ download
→ georeference
→ vectorize
→ reconstruct
```

전체 과정을 script와 metadata로 남긴다.

---

# 46. 현재 단계에서 가장 중요한 결론

현재 확인한 자료만으로도 **조선 후기 한양의 상당 부분을 GIS와 3D로 재구성할 수 있는 자료 기반이 존재한다.**

특히 다음 세 계층이 핵심이다.

```text
18세기 도성대지도
        ↓
1908 한성부지적도
        ↓
1912 경성부 지적원도
```

여기에:

```text
궁궐 도형
관아 실측도
발굴조사
초기 사진
현존 전통건축
```

을 결합하면 단순한 지도 기반 visualization을 넘어 **증거 수준이 명시된 역사도시 digital twin**에 가까운 프로젝트로 확장할 수 있다.

---

# 47. Immediate TODO

```text
[ ] GitHub repository 생성
[ ] source catalog schema 생성
[ ] 서울역사아카이브 고지도 35건 catalog
[ ] 도성대지도 원본 확보
[ ] 도성대지도 부분도 전체 확보
[ ] 1908 한성부지적도 PDF 확보
[ ] 1912 경성부 지적원도 sheet 목록 수집
[ ] 광화문외제관아실측평면도 확보
[ ] 북궐도형 확보
[ ] 동궐도형 확보
[ ] 서울발굴기록의 발굴보고서 catalog
[ ] LOC Seoul map/photo catalog
[ ] NDL 京城 map catalog
[ ] license metadata 기록
[ ] pilot area 결정
[ ] coordinate system 결정
[ ] GeoPackage schema 생성
```

---

# 48. 주요 링크 요약

## 서울역사아카이브

https://museum.seoul.go.kr/archive/

고지도:

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveList.do?ctgryId=CTGRY780&type=C

자료 이용:

https://museum.seoul.go.kr/archive/archiveGuide/arcvGuide.jsp

발굴기록:

https://museum.seoul.go.kr/archive/excavation/excavationBsnsIntrcn.jsp

---

## 도성대지도

https://museum.seoul.go.kr/archive/archiveNew/NR_archiveView.do?ctgryId=CTGRY780&fileId=026d2d85-e2f5-4673-bf8d-5a9ed6163bee&fileSn=1098&type=C&upperNodeId=CTGRY780

---

## 1908 한성부지적도

https://museum.seoul.go.kr/cgcm/board/NR_boardView.do?bbsCd=1012&seq=20150316095605491

---

## 국가기록원 지적아카이브

https://theme.archives.go.kr/next/acreage/

---

## 국가기록원 건축도면

https://theme.archives.go.kr/next/place/outline.do?flag=05

광화문 관아:

https://theme.archives.go.kr/next/place/observatory.do?flag=02

---

## 규장각 도성도

https://kyudb.snu.ac.kr/book/view.do?book_cd=GR33429_00

---

## Hanyang2

https://dh.aks.ac.kr/hanyang2/

3D 건축물:

https://dh.aks.ac.kr/hanyang2/wiki/index.php/2022_3D%EB%AA%A8%EB%8D%B8%EB%A7%81-%EA%B1%B4%EC%B6%95%EB%AC%BC

---

## S-MAP

https://smap.seoul.go.kr/

---

## Library of Congress

서울 지도 소개:

https://blogs.loc.gov/maps/2018/05/maps-of-seoul-south-korea-under-japanese-occupation/

1904 서울 성곽 stereograph:

https://www.loc.gov/item/2003665581/

---

## National Diet Library

https://ndlsearch.ndl.go.jp/

1913 京城:

https://ndlsearch.ndl.go.jp/books/R100000002-I000000555019

---

## 국립중앙도서관

https://www.nl.go.kr/

---

# 49. 문서 관리

이 문서는 초기 조사본이다.

추가 조사 때마다 다음을 업데이트한다.

```text
last_updated
new source
download status
license
georeference status
dataset coverage
open questions
```

권장 파일명:

```text
docs/RESEARCH_AND_SOURCE_ROADMAP.md
```

---

# 50. Next research questions

향후 조사에서 우선 답해야 할 질문:

1. 1908 한성부지적도 29매는 정확히 어느 지역을 커버하는가?
2. 1912 경성부 지적원도 전체 sheet index를 자동 수집할 수 있는가?
3. 도성대지도를 높은 해상도로 원본 다운로드할 수 있는가?
4. 서울역사아카이브 지도 download endpoint를 자동화할 수 있는가?
5. 북궐도형 원본의 최고해상도 공개처는 어디인가?
6. 동궐도형 / 동궐도의 공개 이미지 라이선스는 무엇인가?
7. 서궐도안 최고해상도 자료는 어디에 있는가?
8. 서울발굴기록 보고서의 plan image를 자동 수집할 수 있는가?
9. 조선 후기 일반 민가의 footprint와 건물 밀도를 추정할 직접 자료가 있는가?
10. 19세기 말 파노라마 사진을 이용한 photogrammetric reconstruction이 가능한가?
11. 조선시대 청계천 지류의 정확한 고도와 단면을 복원할 수 있는가?
12. 기존 Hanyang2 / S-MAP 모델의 license 및 원본 asset 접근 범위는 어디까지인가?
13. 일제 초기 demolition / renovation plan에서 조선 관아 원형을 얼마나 역추적할 수 있는가?
14. 옛 도로와 1912 지적원도를 자동 graph matching할 수 있는가?
15. historical gazetteer를 기존 DB와 연계할 수 있는가?

---

**이 문서의 목적은 최종 결론을 제시하는 것이 아니라, 향후 모든 조사·GIS·3D 작업이 출처와 재현 가능성을 유지하도록 프로젝트의 방향을 고정하는 것이다.**
