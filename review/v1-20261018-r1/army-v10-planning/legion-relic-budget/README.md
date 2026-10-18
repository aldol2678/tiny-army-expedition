# 군단 유물 예산 비교

`../legion-relic-rewards.md`의 독립 산술 모델. 제품 코드/운영 저장/전투 엔진을 읽거나 수정하지 않는다. Python 표준 라이브러리만 사용한다.

- 실행: `python army-v10-planning/legion-relic-budget/model.py`
- 테스트: `python -m unittest discover -s army-v10-planning/legion-relic-budget -v`
- 결과 갱신은 출력물을 이 디렉터리의 `results.json`으로 명시적으로 리다이렉트한다.

카테고리 기대값은 적격성 적용 전의 독립1:1:1 가정이다. 희귀도 샘플러·보상 저장·실제 효과/상한 계산·전투 승률을 구현하지 않는다. 후보 필터는 대표 입력 fixture만 검사한다. 첫25종 ID를 도감에서 읽어 향후 후보가 섞이지 않았는지 확인하지만 전부 구현되었다고 취급하지 않는다.
