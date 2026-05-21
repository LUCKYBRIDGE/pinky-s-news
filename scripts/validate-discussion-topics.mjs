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

  if (topic.discussionType && !allowedTypes.has(topic.discussionType)) {
    issues.push(`${label}: discussionType must be one of ${Array.from(allowedTypes).join(', ')}`);
  }

  if (topic.essentialQuestion && !questionKeywords.some((keyword) => topic.essentialQuestion.includes(keyword))) {
    issues.push(`${label}: essentialQuestion should include a choice, standard, condition, or responsibility keyword`);
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

  if (!Array.isArray(topic.resources) || topic.resources.length === 0) {
    issues.push(`${label}: resources must not be empty`);
  } else {
    topic.resources.forEach((resource, resourceIndex) => {
      const resourceLabel = `${label}.resources[${resourceIndex}]`;

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
