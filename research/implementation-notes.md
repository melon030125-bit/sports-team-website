# Chelsea FC 2026/27 구현용 콘텐츠 안내

## 범위와 기준

- `data/site.json`은 메인·선수단·경기·뉴스·상세 페이지가 함께 사용하는 수동 관리 데이터다.
- 시즌 스냅샷 기준: 2026년 11월 13일 KST. 실시간 데이터가 아니다.
- 선수 30명은 구단 남자 선수 프로필 목록 기준이며 PL 성인 등록 명단이나 당일 출전 가능 명단이 아니다.
- 한글 이름은 사이트의 편집 표기다. 검색 별칭과 영문 표시 이름을 구분한다.
- 핵심 선수 8명은 입문용 편집 추천이며 공식 순위·고정 선발을 뜻하지 않는다.
- 원본 리서치 문서는 보존한다.

## 데이터 필드

| 묶음 | 주요 필드 | 규칙 |
|---|---|---|
| season | label, asOf, manager, captain, competitions | 시즌·기준시각·감독·구단 주장·대회 상태 |
| players | id, number, en, ko, group, position, summary, aliases, featured | ID는 영문 슬러그, group은 GK/DF/MF/FW, featured는 입문용 추천 |
| matches | id, opponent, venue, competition, kickoff, date, status, tentative | venue는 home/away, date는 KST 날짜, kickoff는 시간대가 명시된 ISO 또는 null |
| matches | homeScore, awayScore, penalties | 스코어는 홈팀/원정팀 순서, 승부차기는 별도 문자열 |
| articles | id, title, category, date, summary, body, playerIds | date는 원문 게시일, body는 한국어 요약 문단 배열, playerIds는 선수 연결 |
| 공통 | source, checkedAt | 공식 근거 URL과 마지막 확인일. checkedAt은 자동으로 오늘 날짜로 바꾸지 않는다. |

## 경기 상태와 시간

- scheduled: 공식 일정상 예정된 경기.
- finished: 결과를 공식 보고서로 확인한 경기.
- unknown: 과거 일정이지만 결과를 이번 자료에서 확인하지 않은 경기. 무승부나 취소로 처리하지 않는다.
- postponed: 연기 공지가 확인됐을 때 사용한다.
- tentative: 잠정 시간 또는 자료 간 편성 차이가 남은 경기.
- 시간 미정인 최종전은 kickoff를 null로 둔다. 임의의 00:00을 만들지 않는다. 최종전의 date는 필터용 공식 날짜이며 dateBasis=Europe/London, localDate=2027-05-30을 함께 둔다. 이 날짜를 KST 확정 날짜처럼 표시하지 않고 “영국 5/30 · 한국 날짜·시간 미정”으로 안내한다.
- 2026년 12월 애스턴 빌라전은 구단 일정의 TBC와 PL 시각 표기가 달라 tentative로 처리한다.
- 2027년 1월 중순 이후 기본 편성은 tentative로 처리한다.
- KST는 Asia/Seoul, 영국시간은 Europe/London으로 표시한다.
- 0–0 결과와 결과 미확인(null)을 구분한다.
- 승부차기 숫자를 본 경기 점수에 합산하지 않는다.

## 재검증으로 반영한 정정

- 최근 선덜랜드·맨체스터 유나이티드·리버풀 경기의 공식 보고서는 모이세스 카이세도를 주장으로 표기한다. 레비 콜윌을 항상 최근 주장 대행으로 표시하지 않는다.
- 구단 주장은 리스 제임스이며 경기별 완장과 구단 주장 지위는 구분한다.
- FA컵 3라운드 대회 일정은 2027년 1월 9일 주말이지만 첼시의 개별 경기 날짜·상대·킥오프를 확정하지 않는다.
- 리그 순위·승점·선수 누적 통계는 검증 범위를 통일하지 못했으므로 표시하지 않는다.
- 가르나초의 거래 유형, 최신 부상 복귀일, 최종전 시간 등 미해결 항목을 확정 콘텐츠로 만들지 않는다.

## 페이지별 콘텐츠 사용

- 메인: 다음 경기, 최근 확인 결과, 핵심 선수, 최신 기사, 시즌 대회 상태.
- SQUAD·선수 상세: 선수 데이터와 playerIds로 연결한 기사. 부상·계약 정보는 최신 공식 소식으로 연결한다.
- MATCHES: PL 38경기와 카라바오컵 3경기, 총 41경기다. PL 완료 10경기의 결과와 컵 3경기 결과를 공식 경기 보고서에서 확인했다. 향후 확인되지 않은 과거 결과는 별도로 안내한다.
- NEWS·기사 상세: 공식 발표와 인터뷰를 짧게 요약하고 원문을 연결한다. 원문 게시일과 확인일을 구분한다.
- CLUB: 창단·경기장·우승 기록은 공식 구단·PL 자료를 연결한다.
- KOREAN GUIDE: 국내 PL 권리와 컵대회 편성을 혼동하지 않는다. 요금·티켓·팬 모임 공인 여부는 확정하지 않고 현행 공식 안내로 연결한다.

## 갱신 기준

1. 경기 편성이 바뀌면 kickoff·date·tentative와 source·checkedAt을 함께 갱신한다.
2. 경기 종료 후 공식 보고서로 status와 스코어를 갱신한다.
3. 선수 이동 시 현재 명단과 이탈·미래 합류를 분리한다. ID는 등번호 변경에도 유지한다.
4. 새 기사 추가 시 원문 게시일, 요약 작성 사실, 관련 선수 ID를 확인한다.
5. 출처 확인 없이 checkedAt만 변경하지 않는다.

## 주요 검증 출처

- 선수단: https://www.chelseafc.com/en/teams/mens-profiles
- 감독: https://www.chelseafc.com/en/news/article/xabi-alonso-appointed-chelsea-manager
- 주장·부상: https://www.chelseafc.com/en/news/article/injury-update-reece-james
- 리더십: https://www.chelseafc.com/en/news/article/alonso-we-have-a-good-mix-of-personalities-and-leaders-here
- PL 일정: https://www.premierleague.com/en/news/4675097/all-380-fixtures-for-202627-premier-league-season
- FA컵 대회 날짜: https://www.thefa.com/news/2026/jun/05/round-dates
- 국내 PL 중계권: https://www.premierleague.com/en/news/3703577/premier-league-broadcast-deals-for-2025-2028

## 콘텐츠 담당 완료 범위

- 생성: `data/site.json`, `research/implementation-notes.md`.
- 추가 기능: 없음. 기능 구현은 기능 담당 범위다.
- 제거 내용: 없음. 원본 자료와 기존 사이트 파일은 수정하지 않았다.
- 확인 필요: 향후 데이터 변경 시 시간대·미확인 상태·관련 ID 무결성을 함께 확인한다.

## 로컬 실행과 검증

- Node.js가 설치된 환경에서 저장소 루트에서 `node js/serve.mjs`를 실행한 뒤 `http://127.0.0.1:8000`으로 접속한다. 종료는 Ctrl+C다. 다른 포트는 `node js/serve.mjs 8080`처럼 지정한다.
- 별도의 패키지 설치나 빌드 과정은 없다. JSON 데이터와 ES 모듈을 읽기 때문에 HTML 파일 더블클릭 대신 HTTP 서버를 이용한다.
- `node --check script.js`, `node --check js/app.js`, `node --check js/utils.js`로 구문을 확인한다.
- `node js/verify.mjs`는 데이터·선수 연결·KST 자정·GMT/BST·점수·주소 처리와 기본 HTML 구조를 확인한다.
- 선택적으로 Chrome 원격 디버깅 포트 9227과 미리보기 포트 8000이 준비되어 있으면 `node js/verify.mjs --browser`로 실제 브라우저를 검증한다. 이 명령은 새 QA 탭만 만들고 닫으며 Chrome을 설치하거나 실행하지 않는다.
- 브라우저 검증 범위: 1440·700·390·320px의 10개 주소, 화면 넘침, 선수 검색·포지션, 경기 복합 필터, 초기화, 한국 날짜 미정, 뉴스 검색, 모바일 메뉴, Escape 포커스, 잘못된 상세 ID.
- 사진을 실제 선수 사진으로 오인하지 않도록 선수 카드는 CSS 셔츠, 뉴스는 추상 그래픽으로 표현했다. 외부 이미지·폰트 요청 없이 동작한다.
- 메인 다음 경기와 최근 결과는 `season.asOf` 기준 스냅샷이다. 확인하지 않은 실시간 정보를 자동으로 만들어내지 않는다.
- 구현 전환으로 기존 가상 구단 콘텐츠와 뉴스 대화상자는 교체되었고, 뉴스는 독립 상세 URL로 이동한다. 원본 리서치와 review-content/review-design 파일은 보존했다.
