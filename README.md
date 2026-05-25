# 트루핑키스 뉴스

미디어 리터러시 교육을 위한 정적 뉴스 웹앱입니다. 실제 정책 뉴스 형식의 기사와 교육용으로 창작한 가짜 뉴스가 섞여 있으며, 사용자는 기사 하단에서 팩트체크 과정을 확인하고 진짜/가짜 여부를 판단할 수 있습니다.

## 실행

정적 파일만 사용하므로 별도 빌드 과정이 없습니다.

```bash
python -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다.

## 구성

- `index.html`: 단일 페이지 앱, 화면 구성과 클라이언트 로직
- `articleList.json`: 기사 ID 목록
- `discussionTopics.json`: 토의·토론 주제와 근거자료 묶음
- `news-*.json`: 기사 데이터
- `assets/`: 기사 본문에 쓰는 로컬 이미지
- `docs/discussion-topic-guidelines.md`: 토의·토론 주제 편성 지침
- `scripts/validate-discussion-topics.mjs`: 토의 주제 데이터 검증 스크립트

## 토의·토론 주제 편성

토의·토론 주제는 `찬반 토론형`과 `해결 설계형 토의`로 구분합니다.

- 억지 찬반으로 만들지 않습니다.
- 실제 논쟁이 있는 주제는 `찬반 토론형`으로 둡니다.
- 사회적으로 필요성이 큰 주제는 `어떻게 할까`를 묻는 `해결 설계형 토의`로 둡니다.
- 토의 논제는 선택, 기준, 조건, 책임 중 하나 이상을 포함합니다.
- 하나의 큰 주제에는 화면에 보여 줄 여러 문장형 논제를 `discussionMotions`에 두고, 같은 순서의 질문형 판단 초점은 `discussionQuestions`에 호환용으로 둡니다.
- 첫 번째 논제는 대표 선택 논제로 두고 `essentialQuestion`에도 연결합니다.
- 찬반 토론형 주제에는 수업에서 바로 읽을 수 있는 명제형 문장을 `debateMotion`으로 둘 수 있으며, 화면에는 `토론 논제`로 함께 표시합니다.
- 각 논제는 `questionTypes`와 `elementaryQuestionTypes`에서 내부값 `토론 질문` 또는 `토의 질문`으로 구분하고, 화면에서는 `토론 논제`와 `토의 논제` 색 배지로 표시합니다.
- 화면에서는 주제 전체의 `찬반 토론형`/`해결 설계형 토의` 배지를 표시하지 않고, 선택 가능한 논제 단위의 유형만 보여줍니다.
- 화면의 읽기 수준은 `교사용·일반 보기`와 `초등 고학년 보기`로 구분해 표시합니다.
- 각 주제에는 기존 논제를 유지한 채 `elementaryTitle`, `elementarySummary`, `elementaryDiscussionMotions`, `elementaryDiscussionQuestions`, `elementaryDiscussionFrame`, `elementaryWritingPrompt`로 초등학교 고학년용 쉬운 버전을 함께 둡니다.
- 초등 고학년 보기에서는 핵심 용어를 쉬운 말로 없애지 않고, 화면에서 용어를 눌러 짧은 설명을 볼 수 있게 합니다.
- 모든 근거자료는 `readingFocus`, `relatedQuestions`로 읽을 초점과 연결되는 토의·토론 논제를 표시합니다.
- 토의·토론 근거자료의 `internal` 항목은 `type: "fake"`인 가짜 뉴스 판별 연습용 기사를 연결하지 않습니다.
- 초등 고학년 보기에서 더 쉬운 읽기 안내가 필요하면 자료에 `elementaryReadingFocus`를 함께 둡니다.
- 법 조항 원문이나 법령 개정이유처럼 읽기 어려운 1차 법률 자료는 핵심 근거자료로 두지 않고, 가능한 한 공식 안내문·해설문·정보성 글·칼럼을 우선 연결합니다.
- 외부 링크는 검색 결과, 기관 메인, 오래된 리다이렉트 주소가 아니라 카드 제목의 글·보고서·안내문이 바로 열리는 현재 URL을 사용합니다.
- 내부 읽기 글은 주제와 관련만 있는 배경 글이 아니라, 선택 가능한 토의·토론 논제의 근거·조건·책임 판단에 직접 도움이 되는 글만 연결합니다.
- `classroomReadingMaterials`는 상세 화면의 근거자료 묶음 안에서 `쟁점형 읽기 자료`로 먼저 보여 주며, 외부 본문을 옮기지 않고 선택 논제에 맞춰 새로 쓴 글이어야 합니다.
- 통계·조사·연구·논문 링크는 `resourceKind`로 자료 성격도 함께 표시합니다.
- 근거로 직접 쓰기 쉬운 통계·조사·연구 자료는 `evidenceInfo`로 출처, 조사대상·범위, 시점, 주의점을 분리해 표시합니다.
- 재사용 조건이 명확한 원자료 CSV/API는 `embeddedEvidence`로 작은 표를 재생산할 수 있으며, 원자료 링크, 라이선스, 단위, 발췌 기준, 반올림·단위 변환 기준을 함께 적습니다. 두 개 이상의 원자료를 조합한 표는 `sourceUrls`에 각 원자료 링크를 남깁니다.
- 재생산 표는 `auditKey`, `verificationNote`, `copyrightBasis`를 함께 두고, 원자료와 대조할 수 없거나 저작권 조건이 불명확하면 표를 만들지 않고 외부 링크만 남깁니다.
- 사이트 안에서 직접 보여주는 데이터·표·그래프는 `scripts/audit-embedded-evidence.mjs`에 항목별 감사 케이스를 추가해 제목, 단위, 열, 원자료 링크, 표시값을 원자료와 하나씩 대조합니다.
- 번역·어린이용 재구성이 가능한 핵심 자료는 원문 링크만 두지 말고 `news-*.json` 내부 읽기 글로 만들어 토의 주제의 `internal` 근거자료에 연결합니다.
- 별도 기사로 만들기 전에도 재사용 조건이 명확한 외부 원문은 `koreanReconstruction`, `elementaryKoreanReconstruction`으로 카드 안에 한국어 재구성 읽기 글을 둘 수 있습니다.
- 실제 세계·국내 토론대회 논제를 참고해 주제의 토론 가능성을 점검한 경우 `competitionReferences`에 원 논제, 출처, 수업용 변환 이유, 연결 논제 번호를 남깁니다.
- 대회가 공개한 논제 참고자료나 주제도서 안내가 있으면 `competitionReferences.readingMaterials`로 연결하되, 저작권 보호 자료의 본문·번역·요약은 앱에 옮기지 않습니다.
- 외부 자료를 본문으로 재사용하기 어렵지만 수업 전 이해 자료가 필요하면 `classroomReadingMaterials`에 사이트 자체 창작 읽기 자료를 둡니다.
- 자세한 기준은 `docs/discussion-topic-guidelines.md`를 따릅니다.

토의 주제 데이터를 고친 뒤에는 아래 검사를 실행합니다.

```bash
node scripts/validate-discussion-topics.mjs
node scripts/audit-embedded-evidence.mjs
```

## 저작권/출처 메모

- 일부 실제 기사 내용은 공공누리 제1유형(출처표시) 자료를 교육 목적으로 각색한 것입니다.
- 기사 이미지, 작성자 프로필, 표, 그래프는 정책브리핑 원문 이미지를 가져온 것이 아니라 트루핑키스 뉴스에서 AI로 생성한 로컬 JPG/PNG 자료를 사용합니다.
- 진짜뉴스, 가짜뉴스 여부와 별개로 댓글과 반응 수는 모두 미디어 리터러시 교육을 위해 만든 가상 예시입니다.
- 가짜 뉴스와 일부 보조 자료는 미디어 리터러시 교육을 위해 창작된 내용입니다.
