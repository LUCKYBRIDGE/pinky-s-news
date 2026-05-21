import fs from 'node:fs';

const topics = JSON.parse(fs.readFileSync('discussionTopics.json', 'utf8'));
const issues = [];

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

function findEvidence(auditKey) {
  for (const topic of topics) {
    for (const resource of topic.resources || []) {
      if (resource.embeddedEvidence?.auditKey === auditKey) {
        return resource.embeddedEvidence;
      }
    }
  }
  issues.push(`${auditKey}: embeddedEvidence not found`);
  return null;
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

function expectRows(auditKey, actualRows, expectedRows) {
  const actual = JSON.stringify(actualRows);
  const expected = JSON.stringify(expectedRows);
  if (actual !== expected) {
    issues.push(`${auditKey}: rows differ from source data\nexpected: ${expected}\nactual:   ${actual}`);
  }
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

async function auditPlastic() {
  const auditKey = 'plastic-pollution-2020';
  const evidence = findEvidence(auditKey);
  if (!evidence) return;

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
  const expectedRows = selections.map(([label, entity]) => [
    label,
    '2020',
    formatInteger(getCsvValue(rows, entity, 2020, 'Total plastic pollution')),
  ]);

  expectRows(auditKey, evidence.rows, expectedRows);
}

async function auditWorldBank() {
  const auditKey = 'world-bank-out-of-school-latest';
  const evidence = findEvidence(auditKey);
  if (!evidence) return;

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
  const expectedRows = selections.map(([label, iso3]) => {
    const latest = dataRows.find(row => row.countryiso3code === iso3 && row.value !== null);
    if (!latest) throw new Error(`Missing World Bank row for ${iso3}`);
    return [label, latest.date, formatTwoDecimals(latest.value)];
  });

  expectRows(auditKey, evidence.rows, expectedRows);
}

async function auditCo2() {
  const auditKey = 'co2-emissions-2024';
  const evidence = findEvidence(auditKey);
  if (!evidence) return;

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
  const expectedRows = selections.map(([label, entity]) => [
    label,
    '2024',
    formatOneDecimal(Number(getCsvValue(totalRows, entity, 2024, 'Annual CO₂ emissions')) / 1_000_000_000),
    formatOneDecimal(getCsvValue(perCapitaRows, entity, 2024, 'CO₂ emissions per capita')),
  ]);

  expectRows(auditKey, evidence.rows, expectedRows);
}

try {
  await auditPlastic();
  await auditWorldBank();
  await auditCo2();
} catch (error) {
  issues.push(error.message);
}

if (issues.length) {
  console.error(issues.join('\n'));
  process.exit(1);
}

console.log('ok: embedded evidence matches source data and checked reuse terms');
