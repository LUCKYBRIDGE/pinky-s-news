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
- 토의 질문은 선택, 기준, 조건, 책임 중 하나 이상을 포함합니다.
- 하나의 큰 주제에는 여러 `discussionQuestions`를 둘 수 있고, 첫 번째 질문은 대표 질문인 `essentialQuestion`과 같게 둡니다.
- 각 주제에는 기존 질문을 유지한 채 `elementaryTitle`, `elementarySummary`, `elementaryDiscussionQuestions`, `elementaryDiscussionFrame`, `elementaryWritingPrompt`로 초등학교 고학년용 쉬운 버전을 함께 둡니다.
- 모든 근거자료는 `readingFocus`, `relatedQuestions`로 읽을 초점과 연결되는 토의 질문을 표시합니다.
- 초등 고학년 보기에서 더 쉬운 읽기 안내가 필요하면 자료에 `elementaryReadingFocus`를 함께 둡니다.
- 통계·조사·연구·논문 링크는 `resourceKind`로 자료 성격도 함께 표시합니다.
- 근거로 직접 쓰기 쉬운 통계·조사·연구 자료는 `evidenceInfo`로 출처, 조사대상·범위, 시점, 주의점을 분리해 표시합니다.
- 재사용 조건이 명확한 원자료 CSV/API는 `embeddedEvidence`로 작은 표를 재생산할 수 있으며, 원자료 링크, 라이선스, 단위, 발췌 기준, 반올림·단위 변환 기준을 함께 적습니다. 두 개 이상의 원자료를 조합한 표는 `sourceUrls`에 각 원자료 링크를 남깁니다.
- 재생산 표는 `auditKey`, `verificationNote`, `copyrightBasis`를 함께 두고, 원자료와 대조할 수 없거나 저작권 조건이 불명확하면 표를 만들지 않고 외부 링크만 남깁니다.
- 사이트 안에서 직접 보여주는 데이터·표·그래프는 `scripts/audit-embedded-evidence.mjs`에 항목별 감사 케이스를 추가해 제목, 단위, 열, 원자료 링크, 표시값을 원자료와 하나씩 대조합니다.
- 번역·어린이용 재구성이 가능한 핵심 자료는 원문 링크만 두지 말고 `news-*.json` 내부 읽기 글로 만들어 토의 주제의 `internal` 근거자료에 연결합니다.
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
