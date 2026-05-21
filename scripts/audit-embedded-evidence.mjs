import fs from 'node:fs';

const topics = JSON.parse(fs.readFileSync('discussionTopics.json', 'utf8'));
const issues = [];
const passes = [];
let embeddedEvidenceItems = [];

const urls = {
  plasticCsv: 'https://ourworldindata.org/grapher/plastic-pollution.csv',
  plasticMetadata: 'https://api.ourworldindata.org/v1/indicators/1134064.metadata.json',
  co2TotalCsv: 'https://ourworldindata.org/grapher/annual-co2-emissions-per-country.csv',
  co2TotalMetadata: 'https://api.ourworldindata.org/v1/indicators/1119906.metadata.json',
  co2PerCapitaCsv: 'https://ourworldindata.org/grapher/co-emissions-per-capita.csv',
  co2PerCapitaMetadata: 'https://api.ourworldindata.org/v1/indicators/1119914.metadata.json',
  worldBankApi: 'https://api.worldbank.org/v2/country/KOR;USA;JPN;FIN;IND/indicator/SE.PRM.UNER.ZS?format=json&per_page=1000',
  worldBankTerms: 'https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets',
};

function getEmbeddedEvidenceItems() {
  const items = [];
  for (const topic of topics) {
    for (const [resourceIndex, resource] of (topic.resources || []).entries()) {
      if (resource.embeddedEvidence) {
        items.push({
          topicId: topic.id,
          resourceIndex,
          resourceTitle: resource.title,
          evidence: resource.embeddedEvidence,
        });
      }
    }
  }
  return items;
}

function getEvidenceByAuditKey(auditKey) {
  return embeddedEvidenceItems.filter(item => item.evidence.auditKey === auditKey);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some(cell => cell !== '')) rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

function formatInteger(value) {
  return Math.round(Number(value)).toLocaleString('en-US');
}

function formatOneDecimal(value) {
  return Number(value).toFixed(1);
}

function formatTwoDecimals(value) {
  return Number(value).toFixed(2);
}

function expectEqual(auditKey, field, actualValue, expectedValue) {
  const actual = JSON.stringify(actualValue);
  const expected = JSON.stringify(expectedValue);
  if (actual !== expected) {
    issues.push(`${auditKey}: ${field} differs from audited source\nexpected: ${expected}\nactual:   ${actual}`);
  }
}

function expectEvidence(auditKey, evidence, expected) {
  expectEqual(auditKey, 'title', evidence.title, expected.title);
  expectEqual(auditKey, 'license', evidence.license, expected.license);
  expectEqual(auditKey, 'unit', evidence.unit, expected.unit);
  expectEqual(auditKey, 'columns', evidence.columns, expected.columns);
  expectEqual(auditKey, 'sourceUrls', evidence.sourceUrls, expected.sourceUrls);
  expectEqual(auditKey, 'rows', evidence.rows, expected.rows);
}

async function assertOwidRedistributable(auditKey, metadataUrl) {
  const metadata = await fetchJson(metadataUrl);
  if (metadata.nonRedistributable !== false) {
    issues.push(`${auditKey}: OWID metadata is not redistributable`);
  }
}

function getCsvValue(rows, entity, year, column) {
  const match = rows.find(row => row.Entity === entity && row.Year === String(year));
  if (!match) throw new Error(`Missing CSV row for ${entity} ${year}`);
  return match[column];
}

async function buildPlasticAudit() {
  const auditKey = 'plastic-pollution-2020';
  await assertOwidRedistributable(auditKey, urls.plasticMetadata);
  const rows = parseCsv(await fetchText(urls.plasticCsv));
  const selections = [
    ['세계', 'World'],
    ['인도', 'India'],
    ['중국', 'China'],
    ['미국', 'United States'],
    ['일본', 'Japan'],
    ['대한민국', 'South Korea'],
  ];
  return {
    auditKey,
    description: '2020 total plastic pollution table',
    expected: {
      title: '2020년 총 플라스틱 오염량 일부 지역 비교',
      license: 'CC BY',
      unit: '톤',
      columns: ['지역', '연도', '총 플라스틱 오염량'],
      sourceUrls: [
        {
          label: '원자료 CSV',
          url: urls.plasticCsv,
        },
      ],
      rows: selections.map(([label, entity]) => [
        label,
        '2020',
        formatInteger(getCsvValue(rows, entity, 2020, 'Total plastic pollution')),
      ]),
    },
  };
}

async function buildWorldBankAudit() {
  const auditKey = 'world-bank-out-of-school-latest';
  const terms = await fetchText(urls.worldBankTerms);
  if (!terms.includes('Creative Commons Attribution 4.0 International License') || !terms.includes('APIs')) {
    issues.push(`${auditKey}: World Bank CC BY 4.0/API terms were not found`);
  }

  const [, dataRows] = await fetchJson(urls.worldBankApi);
  const selections = [
    ['대한민국', 'KOR'],
    ['일본', 'JPN'],
    ['인도', 'IND'],
    ['핀란드', 'FIN'],
    ['미국', 'USA'],
  ];
  return {
    auditKey,
    description: 'latest non-empty World Bank out-of-school percentages',
    expected: {
      title: '초등학교 나이 학교 밖 아동 비율 일부 국가 비교',
      license: 'CC BY 4.0',
      unit: '%',
      columns: ['국가', '자료 연도', '학교 밖 아동 비율'],
      sourceUrls: [
        {
          label: 'World Bank API',
          url: urls.worldBankApi,
        },
      ],
      rows: selections.map(([label, iso3]) => {
        const latest = dataRows.find(row => row.countryiso3code === iso3 && row.value !== null);
        if (!latest) throw new Error(`Missing World Bank row for ${iso3}`);
        return [label, latest.date, formatTwoDecimals(latest.value)];
      }),
    },
  };
}

async function buildCo2Audit() {
  const auditKey = 'co2-emissions-2024';
  await assertOwidRedistributable(auditKey, urls.co2TotalMetadata);
  await assertOwidRedistributable(auditKey, urls.co2PerCapitaMetadata);
  const totalRows = parseCsv(await fetchText(urls.co2TotalCsv));
  const perCapitaRows = parseCsv(await fetchText(urls.co2PerCapitaCsv));
  const selections = [
    ['세계', 'World'],
    ['중국', 'China'],
    ['미국', 'United States'],
    ['인도', 'India'],
    ['일본', 'Japan'],
    ['대한민국', 'South Korea'],
  ];
  return {
    auditKey,
    description: '2024 total and per-capita CO2 emissions table',
    expected: {
      title: '2024년 이산화탄소 배출량과 1인당 배출량 비교',
      license: 'CC BY',
      unit: '총배출량: 십억 톤, 1인당 배출량: 톤/명',
      columns: ['지역', '연도', '총배출량', '1인당 배출량'],
      sourceUrls: [
        {
          label: '총배출량 CSV',
          url: urls.co2TotalCsv,
        },
        {
          label: '1인당 배출량 CSV',
          url: urls.co2PerCapitaCsv,
        },
      ],
      rows: selections.map(([label, entity]) => [
        label,
        '2024',
        formatOneDecimal(Number(getCsvValue(totalRows, entity, 2024, 'Annual CO₂ emissions')) / 1_000_000_000),
        formatOneDecimal(getCsvValue(perCapitaRows, entity, 2024, 'CO₂ emissions per capita')),
      ]),
    },
  };
}

try {
  embeddedEvidenceItems = getEmbeddedEvidenceItems();
  const auditBuilders = [
    buildPlasticAudit,
    buildWorldBankAudit,
    buildCo2Audit,
  ];
  const audits = await Promise.all(auditBuilders.map(builder => builder()));
  const auditedKeys = new Set(audits.map(audit => audit.auditKey));

  embeddedEvidenceItems.forEach(({ topicId, resourceIndex, resourceTitle, evidence }) => {
    if (!auditedKeys.has(evidence.auditKey)) {
      issues.push(`${evidence.auditKey}: ${topicId}.resources[${resourceIndex}] (${resourceTitle}) has no dedicated audit case`);
    }
  });

  audits.forEach(({ auditKey, description, expected }) => {
    const matches = getEvidenceByAuditKey(auditKey);
    if (matches.length !== 1) {
      issues.push(`${auditKey}: expected exactly one embeddedEvidence item, found ${matches.length}`);
      return;
    }
    expectEvidence(auditKey, matches[0].evidence, expected);
    passes.push(`${auditKey}: checked ${description}`);
  });
} catch (error) {
  issues.push(error.message);
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}

passes.forEach(pass => console.log(`ok: ${pass}`));
console.log(`ok: ${passes.length} embedded evidence items match source data and checked reuse terms`);
