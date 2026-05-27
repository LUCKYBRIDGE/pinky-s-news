import fs from 'node:fs';

const articleIds = new Set(JSON.parse(fs.readFileSync('articleList.json', 'utf8')));
const topics = JSON.parse(fs.readFileSync('discussionTopics.json', 'utf8'));
const articleTypes = new Map();
const articleSourceUrls = new Map();

articleIds.forEach((articleId) => {
  const articlePath = `${articleId}.json`;
  if (!fs.existsSync(articlePath)) return;
  const article = JSON.parse(fs.readFileSync(articlePath, 'utf8'));
  articleTypes.set(articleId, article.type);
  if (typeof article.sourceUrl === 'string' && article.sourceUrl.trim()) {
    articleSourceUrls.set(articleId, article.sourceUrl.trim());
  }
});

const allowedTypes = new Set(['찬반 토론형', '해결 설계형 토의']);
const allowedQuestionTypes = new Set(['토론 논제', '토의 논제']);
const deprecatedQuestionTypes = new Set(['토론 질문', '토의 질문']);
const allowedElementarySuitability = new Set(['초등 고학년 적합', '교사 지도 권장', '일반용 중심']);
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
const dataEvidenceKindPattern = /통계|데이터|조사|연구|논문|지표/i;
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
const reconstructionAllowedPatterns = [
  /CC BY/i,
  /CC0/i,
  /Creative Commons/i,
  /Open Government Licence/i,
  /\bOGL\b/i,
  /공공누리/,
  /미국 연방정부/,
  /공공영역/,
  /공개 자료/,
  /공공자료/,
  /NASA 공개/,
  /public domain/i,
];
const reconstructionBlockedPatterns = [
  /본문을 옮기지 않고/,
  /최소 설명만/,
  /본문 재사용 없이/,
  /복사하지 않습니다/,
  /원문 링크로만/,
];
const linkOnlyUsagePatterns = [
  ...reconstructionBlockedPatterns,
  /옮기지 않습니다/,
];
const embeddedEvidenceOnlyUsagePatterns = [
  /감사된 표·수치만/,
  /감사된 데이터만/,
];
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

function normalizeReconstructionBody(reconstruction) {
  if (!isObject(reconstruction) || !Array.isArray(reconstruction.body)) return '';
  return reconstruction.body.map(paragraph => paragraph.trim()).join('\n');
}

function extractReconstructionNumbers(reconstruction) {
  const body = normalizeReconstructionBody(reconstruction);
  return Array.from(new Set(body.match(/[0-9]+(?:\.[0-9]+)?%?/g) || []));
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

  if (!topic.elementarySuitability || !allowedElementarySuitability.has(topic.elementarySuitability)) {
    issues.push(`${label}: elementarySuitability must be one of ${Array.from(allowedElementarySuitability).join(', ')}`);
  }

  if (!topic.elementarySuitabilityNote || typeof topic.elementarySuitabilityNote !== 'string') {
    issues.push(`${label}: missing elementary string field "elementarySuitabilityNote"`);
  }

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
    const internalSourceUrls = new Set(
      topic.resources
        .filter(resource => resource.type === 'internal' && articleSourceUrls.has(resource.articleId))
        .map(resource => articleSourceUrls.get(resource.articleId))
    );
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
        if (resource.url && internalSourceUrls.has(resource.url.trim())) {
          issues.push(`${resourceLabel}: duplicate source URL already appears as an internal reading article; keep the translated/reconstructed article and link its original source there`);
        }
        ['resourceKind', 'readingFocus'].forEach((field) => {
          if (resource[field] !== undefined && typeof resource[field] !== 'string') {
            issues.push(`${resourceLabel}: optional field "${field}" must be a string`);
          }
        });
        ['evidenceHighlights', 'elementaryEvidenceHighlights'].forEach((field) => {
          if (resource[field] !== undefined) {
            if (!Array.isArray(resource[field]) || resource[field].length === 0 || resource[field].some(item => typeof item !== 'string' || !item.trim())) {
              issues.push(`${resourceLabel}: optional field "${field}" must be a non-empty array of strings`);
            }
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
        const hasKoreanReconstruction = resource.koreanReconstruction !== undefined;
        const hasElementaryKoreanReconstruction = resource.elementaryKoreanReconstruction !== undefined;
        if (hasKoreanReconstruction || hasElementaryKoreanReconstruction) {
          const reuseTerms = [
            resource.license,
            resource.usage,
          ].filter(Boolean).join(' ');
          if (!reconstructionAllowedPatterns.some(pattern => pattern.test(reuseTerms))) {
            issues.push(`${resourceLabel}: korean reconstruction requires clear reuse terms such as CC BY, CC0, OGL, public domain, or government public material`);
          }
          if (reconstructionBlockedPatterns.some(pattern => pattern.test(reuseTerms))) {
            issues.push(`${resourceLabel}: link-only resources must not include korean reconstruction fields`);
          }
          if (!hasKoreanReconstruction || !hasElementaryKoreanReconstruction) {
            issues.push(`${resourceLabel}: provide both koreanReconstruction and elementaryKoreanReconstruction, or neither`);
          } else {
            const standardBody = normalizeReconstructionBody(resource.koreanReconstruction);
            const elementaryBody = normalizeReconstructionBody(resource.elementaryKoreanReconstruction);
            if (standardBody && elementaryBody && standardBody === elementaryBody) {
              issues.push(`${resourceLabel}: elementaryKoreanReconstruction must be rewritten for upper elementary readers, not copied from koreanReconstruction`);
            }
            const standardNumbers = extractReconstructionNumbers(resource.koreanReconstruction);
            const missingElementaryNumbers = standardNumbers.filter(number => !elementaryBody.includes(number));
            if (missingElementaryNumbers.length) {
              issues.push(`${resourceLabel}: elementaryKoreanReconstruction should preserve numeric evidence from koreanReconstruction (${missingElementaryNumbers.join(', ')})`);
            }
          }
        }
        if (!hasKoreanReconstruction && !hasElementaryKoreanReconstruction) {
          const usageText = resource.usage || '';
          if (resource.embeddedEvidence !== undefined) {
            if (!embeddedEvidenceOnlyUsagePatterns.some(pattern => pattern.test(usageText))) {
              issues.push(`${resourceLabel}: embedded evidence without reconstruction should state that only audited tables or data are reproduced`);
            }
          } else if (!linkOnlyUsagePatterns.some(pattern => pattern.test(usageText))) {
            issues.push(`${resourceLabel}: external resources without reconstruction must clearly say they are link-only`);
          }
        }
        if (resource.embeddedEvidence !== undefined) {
          if (!Array.isArray(resource.evidenceHighlights) || resource.evidenceHighlights.length === 0) {
            issues.push(`${resourceLabel}: embeddedEvidence resources should surface key numbers in evidenceHighlights`);
          }
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
        const dataEvidenceLabel = [
          resource.resourceKind,
          resource.perspective,
          resource.title,
        ].filter(Boolean).join(' ');
        if (dataEvidenceKindPattern.test(dataEvidenceLabel) && (hasKoreanReconstruction || resource.embeddedEvidence !== undefined)) {
          if (!Array.isArray(resource.evidenceHighlights) || resource.evidenceHighlights.length === 0) {
            issues.push(`${resourceLabel}: data, survey, research, or report resources with site-readable text should include evidenceHighlights`);
          }
          if (!Array.isArray(resource.elementaryEvidenceHighlights) || resource.elementaryEvidenceHighlights.length === 0) {
            issues.push(`${resourceLabel}: data, survey, research, or report resources should include elementaryEvidenceHighlights`);
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
