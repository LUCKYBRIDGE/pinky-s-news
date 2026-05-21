import fs from 'node:fs';

const articleIds = new Set(JSON.parse(fs.readFileSync('articleList.json', 'utf8')));
const topics = JSON.parse(fs.readFileSync('discussionTopics.json', 'utf8'));

const allowedTypes = new Set(['찬반 토론형', '해결 설계형 토의']);
const questionKeywords = [
  '어떻게',
  '어디까지',
  '어떤',
  '누가',
  '무엇',
  '먼저',
  '기준',
  '조건',
  '책임',
  '허용',
  '제한',
  '집중',
  '넓게',
  '강하게',
  '단계적',
];

const issues = [];
const evidenceInfoFields = ['sourceDetail', 'sampleOrScope', 'timeRange', 'caution'];
const embeddedAuditKeys = new Set();
const embeddedEvidenceFields = [
  'title',
  'auditKey',
  'source',
  'sourceUrl',
  'license',
  'unit',
  'note',
  'reproductionNote',
  'verificationNote',
  'copyrightBasis',
];

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

topics.forEach((topic, index) => {
  const label = topic.id || `topic[${index}]`;

  if (!isObject(topic)) {
    issues.push(`${label}: topic must be an object`);
    return;
  }

  ['id', 'category', 'discussionType', 'discussionTypeDescription', 'title', 'summary', 'essentialQuestion', 'debateReason', 'writingPrompt'].forEach((field) => {
    if (!topic[field] || typeof topic[field] !== 'string') {
      issues.push(`${label}: missing string field "${field}"`);
    }
  });

  ['elementaryTitle', 'elementarySummary', 'elementaryWritingPrompt'].forEach((field) => {
    if (!topic[field] || typeof topic[field] !== 'string') {
      issues.push(`${label}: missing elementary string field "${field}"`);
    }
  });

  if (topic.discussionType && !allowedTypes.has(topic.discussionType)) {
    issues.push(`${label}: discussionType must be one of ${Array.from(allowedTypes).join(', ')}`);
  }

  if (topic.essentialQuestion && !questionKeywords.some((keyword) => topic.essentialQuestion.includes(keyword))) {
    issues.push(`${label}: essentialQuestion should include a choice, standard, condition, or responsibility keyword`);
  }

  if (!Array.isArray(topic.discussionQuestions) || topic.discussionQuestions.length < 2) {
    issues.push(`${label}: discussionQuestions should contain at least 2 selectable questions`);
  } else {
    const seenQuestions = new Set();
    topic.discussionQuestions.forEach((question, questionIndex) => {
      if (typeof question !== 'string' || !question.trim().endsWith('?')) {
        issues.push(`${label}: discussionQuestions[${questionIndex}] should be a question string`);
        return;
      }
      if (!questionKeywords.some((keyword) => question.includes(keyword))) {
        issues.push(`${label}: discussionQuestions[${questionIndex}] should include a choice, standard, condition, or responsibility keyword`);
      }
      if (seenQuestions.has(question)) {
        issues.push(`${label}: discussionQuestions[${questionIndex}] duplicates another discussion question`);
      }
      seenQuestions.add(question);
    });

    if (topic.essentialQuestion && topic.discussionQuestions[0] !== topic.essentialQuestion) {
      issues.push(`${label}: essentialQuestion should match discussionQuestions[0] for backward compatibility`);
    }
  }

  if (!Array.isArray(topic.elementaryDiscussionQuestions) || topic.elementaryDiscussionQuestions.length < 2) {
    issues.push(`${label}: elementaryDiscussionQuestions should contain at least 2 selectable questions`);
  } else {
    const seenQuestions = new Set();
    topic.elementaryDiscussionQuestions.forEach((question, questionIndex) => {
      if (typeof question !== 'string' || !question.trim().endsWith('?')) {
        issues.push(`${label}: elementaryDiscussionQuestions[${questionIndex}] should be a question string`);
        return;
      }
      if (!questionKeywords.some((keyword) => question.includes(keyword))) {
        issues.push(`${label}: elementaryDiscussionQuestions[${questionIndex}] should include a choice, standard, condition, or responsibility keyword`);
      }
      if (seenQuestions.has(question)) {
        issues.push(`${label}: elementaryDiscussionQuestions[${questionIndex}] duplicates another elementary discussion question`);
      }
      seenQuestions.add(question);
    });

    if (Array.isArray(topic.discussionQuestions) && topic.elementaryDiscussionQuestions.length !== topic.discussionQuestions.length) {
      issues.push(`${label}: elementaryDiscussionQuestions should match discussionQuestions length`);
    }
  }

  if (!Array.isArray(topic.discussionFrame) || topic.discussionFrame.length < 2) {
    issues.push(`${label}: discussionFrame should contain at least 2 perspective questions`);
  } else {
    topic.discussionFrame.forEach((frame, frameIndex) => {
      if (typeof frame !== 'string' || !frame.trim().endsWith('?')) {
        issues.push(`${label}: discussionFrame[${frameIndex}] should be a question string`);
      }
    });
  }

  if (!Array.isArray(topic.elementaryDiscussionFrame) || topic.elementaryDiscussionFrame.length < 2) {
    issues.push(`${label}: elementaryDiscussionFrame should contain at least 2 perspective questions`);
  } else {
    topic.elementaryDiscussionFrame.forEach((frame, frameIndex) => {
      if (typeof frame !== 'string' || !frame.trim().endsWith('?')) {
        issues.push(`${label}: elementaryDiscussionFrame[${frameIndex}] should be a question string`);
      }
    });

    if (Array.isArray(topic.discussionFrame) && topic.elementaryDiscussionFrame.length !== topic.discussionFrame.length) {
      issues.push(`${label}: elementaryDiscussionFrame should match discussionFrame length`);
    }
  }

  if (!Array.isArray(topic.resources) || topic.resources.length === 0) {
    issues.push(`${label}: resources must not be empty`);
  } else {
    const discussionQuestionCount = Array.isArray(topic.discussionQuestions) ? topic.discussionQuestions.length : 0;
    topic.resources.forEach((resource, resourceIndex) => {
      const resourceLabel = `${label}.resources[${resourceIndex}]`;

      if (!resource.readingFocus || typeof resource.readingFocus !== 'string') {
        issues.push(`${resourceLabel}: missing string field "readingFocus"`);
      }
      if (resource.elementaryReadingFocus !== undefined && typeof resource.elementaryReadingFocus !== 'string') {
        issues.push(`${resourceLabel}: optional field "elementaryReadingFocus" must be a string`);
      }
      if (!Array.isArray(resource.relatedQuestions) || resource.relatedQuestions.length === 0) {
        issues.push(`${resourceLabel}: relatedQuestions must be a non-empty array`);
      } else {
        resource.relatedQuestions.forEach((questionNumber, relatedIndex) => {
          if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > discussionQuestionCount) {
            issues.push(`${resourceLabel}: relatedQuestions[${relatedIndex}] must reference an existing discussion question`);
          }
        });
      }

      if (resource.type === 'internal') {
        if (!articleIds.has(resource.articleId)) {
          issues.push(`${resourceLabel}: missing internal article ${resource.articleId}`);
        }
      } else if (resource.type === 'external') {
        ['title', 'source', 'url', 'perspective', 'stance', 'license', 'usage'].forEach((field) => {
          if (!resource[field] || typeof resource[field] !== 'string') {
            issues.push(`${resourceLabel}: missing string field "${field}"`);
          }
        });
        if (resource.url && !/^https?:\/\//.test(resource.url)) {
          issues.push(`${resourceLabel}: external url must start with http:// or https://`);
        }
        ['resourceKind', 'readingFocus'].forEach((field) => {
          if (resource[field] !== undefined && typeof resource[field] !== 'string') {
            issues.push(`${resourceLabel}: optional field "${field}" must be a string`);
          }
        });
        if (resource.evidenceInfo !== undefined) {
          if (!isObject(resource.evidenceInfo)) {
            issues.push(`${resourceLabel}: evidenceInfo must be an object when present`);
          } else {
            evidenceInfoFields.forEach((field) => {
              if (!resource.evidenceInfo[field] || typeof resource.evidenceInfo[field] !== 'string') {
                issues.push(`${resourceLabel}: evidenceInfo.${field} must be a non-empty string`);
              }
            });
          }
        }
        if (resource.embeddedEvidence !== undefined) {
          if (!isObject(resource.embeddedEvidence)) {
            issues.push(`${resourceLabel}: embeddedEvidence must be an object when present`);
          } else {
            embeddedEvidenceFields.forEach((field) => {
              if (!resource.embeddedEvidence[field] || typeof resource.embeddedEvidence[field] !== 'string') {
                issues.push(`${resourceLabel}: embeddedEvidence.${field} must be a non-empty string`);
              }
            });
            if (resource.embeddedEvidence.auditKey) {
              if (embeddedAuditKeys.has(resource.embeddedEvidence.auditKey)) {
                issues.push(`${resourceLabel}: embeddedEvidence.auditKey duplicates another embeddedEvidence`);
              }
              embeddedAuditKeys.add(resource.embeddedEvidence.auditKey);
            }
            const columns = resource.embeddedEvidence.columns;
            const rows = resource.embeddedEvidence.rows;
            if (!Array.isArray(columns) || columns.length < 2 || columns.some(column => typeof column !== 'string' || !column.trim())) {
              issues.push(`${resourceLabel}: embeddedEvidence.columns must contain at least 2 string columns`);
            }
            if (!Array.isArray(rows) || rows.length === 0) {
              issues.push(`${resourceLabel}: embeddedEvidence.rows must not be empty`);
            } else if (Array.isArray(columns)) {
              rows.forEach((row, rowIndex) => {
                if (!Array.isArray(row) || row.length !== columns.length || row.some(cell => typeof cell !== 'string' || !cell.trim())) {
                  issues.push(`${resourceLabel}: embeddedEvidence.rows[${rowIndex}] must contain ${columns.length} string cells`);
                }
              });
            }
            if (resource.embeddedEvidence.sourceUrls !== undefined) {
              if (!Array.isArray(resource.embeddedEvidence.sourceUrls) || resource.embeddedEvidence.sourceUrls.length === 0) {
                issues.push(`${resourceLabel}: embeddedEvidence.sourceUrls must be a non-empty array when present`);
              } else {
                resource.embeddedEvidence.sourceUrls.forEach((link, linkIndex) => {
                  if (!isObject(link) || typeof link.label !== 'string' || !link.label.trim() || typeof link.url !== 'string' || !link.url.trim()) {
                    issues.push(`${resourceLabel}: embeddedEvidence.sourceUrls[${linkIndex}] must include label and url strings`);
                  }
                });
              }
            }
          }
        }
      } else {
        issues.push(`${resourceLabel}: type must be "internal" or "external"`);
      }
    });
  }
});

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}

const resourceCount = topics.reduce((total, topic) => total + topic.resources.length, 0);
console.log(`ok: ${articleIds.size} articles, ${topics.length} topics, ${resourceCount} resources`);
