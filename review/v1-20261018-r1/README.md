# 꼬마 군단 1.0 협업 검토용 소스 · r1

**완성된 1.0 실행본이 아닙니다. 35전 전체 실전 전투·보상·전직 통합은 아직 연결되지 않았습니다.**

- 패키지 태그: `v10-review-20261018-r1` (Git 태그 생성 또는 GitHub 게시를 뜻하지 않음)
- 운영 기준: v0.9.11, commit `9f15c57c8b6cabff286874da34ecde1c8b2c8e8b`
- 실제 UI 및 모바일 확인: https://littlelegion.aldol.app/ (현재 운영 게임)
- 이 협업 폴더는 코드/계약/재현용 데이터입니다. 이미지·폰트·음원·HTML 실행본·배포 설정·.git·인증정보를 포함하지 않습니다.
- 외부 패키지 설치나 네트워크 호출 없이 Node.js >=18 및 Python 3 표준 라이브러리로 재현합니다.

## 먼저 볼 자료

1. `army-v10-validation/build-compatibility/REPORT.md`: P0 피해 영수증 오류 및 기존 유물·전직 호환.
2. `army-v10-validation/growth-economy/REPORT.md`: 병력/유물/균형 선택의 성장 기회 비교. 승률 모형이 아닙니다.
3. `army-v10-validation/routes-condition/REPORT.md`: 최소 7전/장, 전체 35전 경로 및 컨디션. 모든 전투 승리 가정입니다.
4. `army-v10-planning/IMPLEMENTATION-BASELINE.md`: 고정된 사용자 방향과 검증 중인 임시 수치 구분.
5. `army-v10-planning/legion-relic-rewards.md`: 6/15/27전 유물 3택1 기회. 추가 보상이 아니라 기존 보상 대체.
6. `army-v10-planning/second-class-branch-proposal.md` 및 `skill-implementation-contracts.md`: 16개 2차 후보와 구현 계약. 구현 완료 목록이 아닙니다.

## 실행

이 브랜치를 내려받은 뒤 review/v1-20261018-r1 폴더에서:

```sh
sha256sum -c SHA256SUMS
bash verify-all.sh
cat verification/STATUS.txt
```

전체 명령은 `verify-all.sh`에 있습니다. 스크립트가 자신의 위치로 이동하므로 실행을 시작한 디렉터리는 무관합니다. 검증 중 결과 JSON과 verification 로그를 다시 쓰므로 체크섬 검사는 실행 전에 하세요. 실행 입력은 이 협업 폴더 내부의 상대경로만 사용합니다.

최소 P0 재현만 실행하려면:

```sh
node army-v10-validation/build-compatibility/receipt-bug.cjs
```

이 명령의 종료 코드 0은 **버그가 없다는 뜻이 아니라 알려진 오류가 예상대로 재현됐다는 뜻**입니다. 기존 엔진 90초 피해 증폭으로 원값 47.5가 실제 피해 95가 되고, HP 적용 후 `Invalid damage receipt`가 발생하는지 확인합니다. 현재 공개 게임의 오류가 아니라 신규 isolated 모듈을 기존 host에 통합하기 전 차단 사항입니다. 수정하지 않은 재현본을 제공합니다.

## 폴더와 검증 범위

- `army-v10-implementation/src`: seeded graph 및 campaign 상태 전이. 전투 결과는 외부 영수증이며 보상 실제 획득/서비스/궁극 부여는 미연결.
- `army-v10-implementation/spear-skills`: 창병 2역할 독립 reducer 및 host adapter. 16직업 전체 구현 아님.
- `tiny-army-sites/dist/js`: 기존 실전 엔진 의존 소스 4개만 그대로 복사. 독립 전투 512건 및 편성 대조 192건은 v09 엔진 기준.
- `army-v10-validation`: 3종 감사 코드·결과·한계.
- `army-v10-planning`: 현재 설계 문서, 유물 카탈로그 및 군단 보상 예산 모형.
- `verification`: 새 압축 해제 경로에서 실제 재실행한 로그. 실제 기기 UI·청취·35전 실전 완주 검증을 포함하지 않음.
- `SHA256SUMS`: 체크섬 파일 자신을 제외한 패키지 모든 파일의 실제 SHA-256.
- 기존 `source-hashes`/`SOURCE-HASHES` 파일은 해당 감사 당시 기록입니다. 이 패키지의 현재 무결성 정본은 최상위 `SHA256SUMS`입니다.

## 협업 결과 제출 기준

수정 제안은 대상 파일, 원인, 최소 재현, 변경 전후 기대, 회귀 테스트와 함께 제시하세요. 피해 영수증은 단순 무제한 허용이 아니라 host의 피해 증폭·방어·흡수·HP 변화 및 eventId를 검증하는 계약이 필요합니다. 재시도 시 중복 피해와 저장 재개까지 확인해야 합니다. 경제 제안은 유물 선택 증가가 모집/전직 기회를 얼마나 대체하는지 같이 보고하고, 구조 모형 결과를 실제 플레이어 승률로 표현하지 마세요.

이 자료는 검토용 스냅샷이며 운영 배포나 GitHub 쓰기 권한을 부여하지 않습니다.

## GitHub 기준과 공유 범위

기존 저장소 https://github.com/aldol2678/tiny-army-expedition 의 확인된 main `baaa9a44d9d1918d2f8925bd3d82d526e891c5b2`는 v0.8.2 code-only 스냅샷입니다. 최신 운영 v0.9.11 및 독립 1.0 검토 소스와 같지 않습니다. 이번 검토의 기준은 collab/v1-review-20261018 브랜치의 review/v1-20261018-r1 폴더와 그 안의 SHA256SUMS입니다. 저장소 루트의 오래된 v0.8.2 파일과 섞어 비교하지 마세요. GitHub용 README 조정과 체크섬 재생성이 있으므로 별도 제공 ZIP의 체크섬과 동일하지 않습니다.

자료 제공 범위는 협업 검토용입니다. 이 패키지 전달 자체가 별도 공개 재업로드나 일괄 재라이선스 허용을 뜻하지 않습니다.

공개 협업 브랜치는 검토용이며 main 변경, 운영 배포, 에셋 공개, 새 라이선스 부여를 포함하지 않습니다.
