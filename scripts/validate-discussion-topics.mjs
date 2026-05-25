import fs from 'node:fs';

const articleIds = new Set(JSON.parse(fs.readFileSync('articleList.json', 'utf8')));
const topics = JSON.parse(fs.readFileSync('discussionTopics.json', 'utf8'));
const articleTypes = new Map();

articleIds.forEach((articleId) => {
  const articlePath = `${articleId}.json`;
  if (!fs.existsSync(articlePath)) return;
  const article = JSON.parse(fs.readFileSync(articlePath, 'utf8'));
  articleTypes.set(articleId, article.type);
});

const allowedTypes = new Set(['찬반 토론형', '해결 설계형 토의']);
const allowedQuestionTypes = new Set(['토론 논제', '토의 논제']);
const deprecatedQuestionTypes = new Set(['토론 질문', '토의 질문']);
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
  '해야',
  '금지',
  '없어야',
  '안 될',
  '폐지',
  '되어야',
  '있어야',
  '알려야',
  '없어져야',
  '옳은',
  '옳',
  '잘한',
  '정당화',
  '평가',
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
const reconstructionFields = ['title', 'body'];
const rawLegalResourcePatterns = [
  /법규 원문/,
  /법령 정보/,
  /법 조항/,
  /legal-library\/browse\/rules/i,
  /law\.go\.kr\/LSW\/lsRvsRsnListP/i,
];
const deprecatedExternalUrlPatterns = [
  /worldbank\.org\/en\/topic\/education\/brief\/learning-poverty$/i,
  /cisa\.gov\/topics\/election-security\/foreign-influence-operations-and-disinformation/i,
  /digital-strategy\.ec\.europa\.eu\/en\/policies\/digital-services-act-package/i,
  /hhs\.gov\/surgeongeneral\/priorities\/youth-mental-health\/social-media/i,
  /ftc\.gov\/tips-advice\/business-center\/guidance\/complying-coppa-frequently-asked-questions/i,
  /ftc\.gov\/node\/79016/i,
  /consumer\.ftc\.gov\/node\/87227/i,
  /korea\.kr\/policy\/civilView\.do/i,
];

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validateReconstruction(resourceLabel, fieldName, reconstruction) {
  if (!isObject(reconstruction)) {
    issues.push(`${resourceLabel}: ${fieldName} must be an object when present`);
    return;
  }
  reconstructionFields.forEach((field) => {
    if (field === 'body') {
      if (!Array.isArray(reconstruction.body) || reconstruction.body.length === 0 || reconstruction.body.some(paragraph => typeof paragraph !== 'string' || !paragraph.trim())) {
        issues.push(`${resourceLabel}: ${fieldName}.body must contain non-empty paragraph strings`);
      }
    } else if (!reconstruction[field] || typeof reconstruction[field] !== 'string') {
      issues.push(`${resourceLabel}: ${fieldName}.${field} must be a non-empty string`);
    }
  });
}

topics.forEach((topic, index) => {
  const label = topic.id || `topic[${index}]`;

  if (!isObject(topic)) {
    issues.push(`${label}: topic must be an object`);
    return;
  }

  ['id', 'category', 'discussionType', 'discussionTypeDescription', 'title', 'summary', 'essentialQuestion', 'discussionMotion', 'debateReason', 'writingPrompt'].forEach((field) => {
    if (!topic[field] || typeof topic[field] !== 'string') {
      issues.push(`${label}: missing string field "${field}"`);
    }
  });

  ['elementaryTitle', 'elementarySummary', 'elementaryDiscussionMotion', 'elementaryWritingPrompt'].forEach((field) => {
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

  if (!Array.isArray(topic.questionTypes) || !Array.isArray(topic.discussionQuestions) || topic.questionTypes.length !== topic.discussionQuestions.length) {
    issues.push(`${label}: questionTypes should match discussionQuestions length`);
  } else {
    topic.questionTypes.forEach((questionType, questionIndex) => {
      if (!allowedQuestionTypes.has(questionType)) {
        issues.push(`${label}: questionTypes[${questionIndex}] must be one of ${Array.from(allowedQuestionTypes).join(', ')}`);
      }
      if (deprecatedQuestionTypes.has(questionType)) {
        issues.push(`${label}: questionTypes[${questionIndex}] should use 논제, not 질문`);
      }
    });
  }

  if (!Array.isArray(topic.discussionMotions) || !Array.isArray(topic.discussionQuestions) || topic.discussionMotions.length !== topic.discussionQuestions.length) {
    issues.push(`${label}: discussionMotions should match discussionQuestions length`);
  } else {
    const seenMotions = new Set();
    topic.discussionMotions.forEach((motion, motionIndex) => {
      if (typeof motion !== 'string' || !motion.trim() || motion.trim().endsWith('?')) {
        issues.push(`${label}: discussionMotions[${motionIndex}] should be a non-question motion string`);
        return;
      }
      if (seenMotions.has(motion)) {
        issues.push(`${label}: discussionMotions[${motionIndex}] duplicates another discussion motion`);
      }
      seenMotions.add(motion);
    });
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

  if (!Array.isArray(topic.elementaryQuestionTypes) || !Array.isArray(topic.elementaryDiscussionQuestions) || topic.elementaryQuestionTypes.length !== topic.elementaryDiscussionQuestions.length) {
    issues.push(`${label}: elementaryQuestionTypes should match elementaryDiscussionQuestions length`);
  } else {
    topic.elementaryQuestionTypes.forEach((questionType, questionIndex) => {
      if (!allowedQuestionTypes.has(questionType)) {
        issues.push(`${label}: elementaryQuestionTypes[${questionIndex}] must be one of ${Array.from(allowedQuestionTypes).join(', ')}`);
      }
      if (deprecatedQuestionTypes.has(questionType)) {
        issues.push(`${label}: elementaryQuestionTypes[${questionIndex}] should use 논제, not 질문`);
      }
    });
  }

  if (!Array.isArray(topic.elementaryDiscussionMotions) || !Array.isArray(topic.elementaryDiscussionQuestions) || topic.elementaryDiscussionMotions.length !== topic.elementaryDiscussionQuestions.length) {
    issues.push(`${label}: elementaryDiscussionMotions should match elementaryDiscussionQuestions length`);
  } else {
    const seenMotions = new Set();
    topic.elementaryDiscussionMotions.forEach((motion, motionIndex) => {
      if (typeof motion !== 'string' || !motion.trim() || motion.trim().endsWith('?')) {
        issues.push(`${label}: elementaryDiscussionMotions[${motionIndex}] should be a non-question motion string`);
        return;
      }
      if (seenMotions.has(motion)) {
        issues.push(`${label}: elementaryDiscussionMotions[${motionIndex}] duplicates another elementary discussion motion`);
      }
      seenMotions.add(motion);
    });
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

  if (topic.competitionReferences !== undefined) {
    if (!Array.isArray(topic.competitionReferences)) {
      issues.push(`${label}: competitionReferences must be an array when present`);
    } else {
      const discussionQuestionCount = Array.isArray(topic.discussionQuestions) ? topic.discussionQuestions.length : 0;
      topic.competitionReferences.forEach((reference, referenceIndex) => {
        const referenceLabel = `${label}.competitionReferences[${referenceIndex}]`;
        if (!isObject(reference)) {
          issues.push(`${referenceLabel}: competition reference must be an object`);
          return;
        }
        ['tournament', 'year', 'source', 'sourceUrl', 'originalMotion', 'adaptationNote'].forEach((field) => {
          if (!reference[field] || typeof reference[field] !== 'string') {
            issues.push(`${referenceLabel}: missing string field "${field}"`);
          }
        });
        if (reference.sourceUrl && !/^https?:\/\//.test(reference.sourceUrl)) {
          issues.push(`${referenceLabel}: sourceUrl must start with http:// or https://`);
        }
        if (!Array.isArray(reference.relatedQuestions) || reference.relatedQuestions.length === 0) {
          issues.push(`${referenceLabel}: relatedQuestions must be a non-empty array`);
        } else {
          reference.relatedQuestions.forEach((questionNumber, relatedIndex) => {
            if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > discussionQuestionCount) {
              issues.push(`${referenceLabel}: relatedQuestions[${relatedIndex}] must reference an existing discussion question`);
            }
          });
        }
        if (reference.readingMaterials !== undefined) {
          if (!Array.isArray(reference.readingMaterials) || reference.readingMaterials.length === 0) {
            issues.push(`${referenceLabel}: readingMaterials must be a non-empty array when present`);
          } else {
            reference.readingMaterials.forEach((material, materialIndex) => {
              const materialLabel = `${referenceLabel}.readingMaterials[${materialIndex}]`;
              if (!isObject(material)) {
                issues.push(`${materialLabel}: reading material must be an object`);
                return;
              }
              ['title', 'source', 'url', 'materialType', 'usageNote', 'copyrightNote'].forEach((field) => {
                if (!material[field] || typeof material[field] !== 'string') {
                  issues.push(`${materialLabel}: missing string field "${field}"`);
                }
              });
              if (material.url && !/^https?:\/\//.test(material.url)) {
                issues.push(`${materialLabel}: url must start with http:// or https://`);
              }
            });
          }
        }
      });
    }
  }

  if (topic.classroomReadingMaterials !== undefined) {
    if (!Array.isArray(topic.classroomReadingMaterials) || topic.classroomReadingMaterials.length === 0) {
      issues.push(`${label}: classroomReadingMaterials must be a non-empty array when present`);
    } else {
      const discussionQuestionCount = Array.isArray(topic.discussionQuestions) ? topic.discussionQuestions.length : 0;
      topic.classroomReadingMaterials.forEach((material, materialIndex) => {
        const materialLabel = `${label}.classroomReadingMaterials[${materialIndex}]`;
        if (!isObject(material)) {
          issues.push(`${materialLabel}: classroom reading material must be an object`);
          return;
        }
        ['title', 'materialType', 'usageNote', 'copyrightNote'].forEach((field) => {
          if (!material[field] || typeof material[field] !== 'string') {
            issues.push(`${materialLabel}: missing string field "${field}"`);
          }
        });
        if (!Array.isArray(material.body) || material.body.length < 2 || material.body.some(paragraph => typeof paragraph !== 'string' || !paragraph.trim())) {
          issues.push(`${materialLabel}: body must contain at least 2 non-empty paragraph strings`);
        }
        if (!Array.isArray(material.relatedQuestions) || material.relatedQuestions.length === 0) {
          issues.push(`${materialLabel}: relatedQuestions must be a non-empty array`);
        } else {
          material.relatedQuestions.forEach((questionNumber, relatedIndex) => {
            if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > discussionQuestionCount) {
              issues.push(`${materialLabel}: relatedQuestions[${relatedIndex}] must reference an existing discussion question`);
            }
          });
        }
        if (!material.copyrightNote || !material.copyrightNote.includes('창작 자료')) {
          issues.push(`${materialLabel}: copyrightNote should state that this is original created material`);
        }
      });
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
        } else if (articleTypes.get(resource.articleId) === 'fake') {
          issues.push(`${resourceLabel}: internal resources must not reference fake-news practice article ${resource.articleId}`);
        }
      } else if (resource.type === 'external') {
        ['title', 'source', 'url', 'perspective', 'stance', 'license', 'usage'].forEach((field) => {
          if (!resource[field] || typeof resource[field] !== 'string') {
            issues.push(`${resourceLabel}: missing string field "${field}"`);
          }
        });
        const rawLegalBlob = [
          resource.title,
          resource.date,
          resource.url,
          resource.resourceKind,
          resource.usage,
        ].filter(Boolean).join(' ');
        if (rawLegalResourcePatterns.some(pattern => pattern.test(rawLegalBlob))) {
          issues.push(`${resourceLabel}: use accessible legal explainers or issue guides instead of raw legal texts`);
        }
        if (deprecatedExternalUrlPatterns.some(pattern => pattern.test(resource.url))) {
          issues.push(`${resourceLabel}: external url points to an outdated or generic redirect; use the current content-specific URL`);
        }
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
        if (resource.koreanReconstruction !== undefined) {
          validateReconstruction(resourceLabel, 'koreanReconstruction', resource.koreanReconstruction);
        }
        if (resource.elementaryKoreanReconstruction !== undefined) {
          validateReconstruction(resourceLabel, 'elementaryKoreanReconstruction', resource.elementaryKoreanReconstruction);
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
