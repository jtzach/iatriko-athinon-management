'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));
const data = json('data/ceo-presentation.json');
const evidence = json('data/presentation-evidence.json');
const strategy = json('data/strategy-evidence.json');
const sources = new Map(data.sources.map(s => [s.id, s]));
const originalSources = new Map([...evidence.sources, ...strategy.sources].map(s => [s.id, s]));
const finding = id => data.findings.find(f => f.id === id);
const originalFinding = id => evidence.findings.find(f => f.id === id);
let checks = 0;
function check(name, action) { action(); checks++; console.log('PASS ' + name); }

check('Twelve ordered scenes, exact three manual stops, and 300/420 seconds', () => {
  assert.equal(data.scenes.length, 12);
  assert.equal(new Set(data.scenes.map(s => s.id)).size, 12);
  assert.deepEqual(data.scenes.map(s => s.slide), Array.from({length:12}, (_, i) => i + 1));
  assert.deepEqual(data.scenes.map(s => s.visual), ['cover','decisions','nps-total','nps-units','patient-journey','elliniko-dates','document-timeline','readiness-dependencies','gaia-profit','gaia-capacity','space-comparison','pilot-choice']);
  assert.deepEqual(data.pauseSlides, [4,6,9]);
  assert.deepEqual(data.scenes.filter(s => s.pauseAtFinding).map(s => s.slide), [4,6,9]);
  assert.deepEqual(data.playback.manualPauseSlides, [4,6,9]);
  assert.equal(data.playback.pauseBehavior, 'immediate_on_entry_until_next');
  for (const s of data.scenes) {
    assert(Number.isFinite(s.seconds) && s.seconds > 0, 'Positive scene timing');
    assert(s.spoken.trim() && s.title.trim() && s.summary.trim());
    assert(s.limitations.length && s.limitations.every(x => x.trim()));
    assert(data.classificationLabels[s.classification], 'Known evidence classification');
    if (s.pauseAtFinding) assert(s.pauseQuestion && s.pauseQuestion.trim());
  }
  assert.equal(data.durationSeconds, 420);
  assert.equal(data.autoplaySeconds, 300);
  assert.equal(data.recommendedPauseSeconds, 120);
  assert.equal(data.scenes.reduce((n, s) => n + s.seconds, 0), data.durationSeconds);
  assert.equal(data.scenes.filter(s => !s.pauseAtFinding).reduce((n, s) => n + s.seconds, 0), data.autoplaySeconds);
  assert.equal(data.scenes.filter(s => s.pauseAtFinding).reduce((n, s) => n + s.seconds, 0), data.recommendedPauseSeconds);
});

check('Every cited source exists and its URL/page locator matches the evidence register', () => {
  assert.equal(sources.size, data.sources.length, 'Unique source IDs');
  const cited = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.sourceIds) for (const id of value.sourceIds) {
      assert(sources.has(id), 'Missing source: ' + id); cited.add(id);
    }
    for (const child of Object.values(value)) if (typeof child === 'object') walk(child);
  }
  walk(data.scenes); walk(data.findings);
  assert.equal(cited.size, sources.size, 'Source register contains only cited sources');
  for (const s of data.sources) {
    const url = new URL(s.url);
    assert.equal(url.protocol, 'https:');
    assert(!url.username && !url.password, 'No URL credentials');
    if (s.pdfPage != null) {
      assert(Number.isInteger(s.pdfPage) && s.pdfPage > 0);
      assert.equal(new URLSearchParams(url.hash.slice(1)).get('page'), String(s.pdfPage), 'PDF link opens the cited page: ' + s.id);
    } else assert(s.locator || s.note, 'Non-paginated sources have a textual locator');
    const original = originalSources.get(s.id);
    if (original) {
      assert.equal(s.url, original.url, s.id + ' URL');
      assert.equal(s.pdfPage ?? null, original.pdfPage ?? null, s.id + ' PDF page');
      assert.equal(s.printedPage ?? null, original.printedPage ?? null, s.id + ' printed page');
      assert.equal(s.locator ?? null, original.locator ?? null, s.id + ' locator');
    } else {
      assert.equal(s.id, 'am-official-marousi-photo', 'Only the credited cover photo is an added source');
      assert.equal(s.url, 'https://www.iatriko.gr/istoriki_anadromi/');
      assert.equal(s.assetUrl, 'https://www.iatriko.gr/wp-content/uploads/2025/10/Rectangle-5943.png');
    }
  }
});

check('NPS totals, six units, differences, samples and scope match the existing evidence', () => {
  const nps = finding('nps').metrics;
  assert.deepEqual(nps, originalFinding('nps').metrics);
  assert.equal(nps.clinics.length, 6);
  assert.equal(nps.total.nps2025 - nps.total.nps2024, nps.total.changePoints);
  assert.deepEqual([nps.total.nps2024, nps.total.nps2025], [47,48]);
  for (const c of nps.clinics) assert.equal(c.nps2025 - c.nps2024, c.changePoints, c.id);
  const faliro = nps.clinics.find(c => c.id === 'faliro');
  assert.deepEqual([faliro.nps2024, faliro.nps2025, faliro.changePoints], [62,49,-13]);
  assert.equal(nps.clinics.filter(c => c.changePoints > 0).length, 4);
  assert(finding('nps').scope.includes('Δεν περιλαμβάνεται η Ρουμανία'));
});

check('Elliniko forecasts and chronology match the registered documents', () => {
  const e = finding('elliniko').metrics;
  assert.deepEqual(e.forecasts.map(f => f.completionYear), [2028,2031]);
  assert.equal(e.differenceYears, strategy.elliniko.discrepancyYears);
  assert.equal(e.differenceYears, e.forecasts[1].completionYear - e.forecasts[0].completionYear);
  assert.equal(strategy.elliniko.status, 'unreconciled_public_disclosure');
  for (const forecast of e.forecasts) {
    assert.equal(forecast.classification, 'company_claim');
    assert.equal(forecast.yearEnd, true);
    const allowed = strategy.elliniko['target' + forecast.completionYear];
    for (const id of forecast.sourceIds) assert(allowed.includes(id), 'Forecast supported by registered source');
    const [y,m,d] = forecast.documentDate.split('-').map(Number);
    const source = originalSources.get(forecast.sourceIds[0]);
    assert(source.period.includes(d + '/' + m + '/' + y), 'Document date agrees with registered period');
  }
  assert.deepEqual(e.chronology.map(x => x.date), ['2026-04-30','2026-05-26']);
  assert.deepEqual(e.chronology.map(x => x.forecastYear), [2031,2028]);
  for (const row of e.chronology) {
    const forecast = e.forecasts.find(x => x.publisher === row.publisher);
    assert.equal(row.date, forecast.documentDate);
    assert.equal(row.forecastYear, forecast.completionYear);
    assert.deepEqual(row.sourceIds, forecast.sourceIds);
  }
  assert(data.scenes[5].limitations.join(' ').includes('δεν αποδεικνύει καθυστέρηση'));
});

check('Gaia profit and announced capacity retain distinct types, periods and units', () => {
  const metrics = finding('gaia').metrics, original = originalFinding('gaia').metrics;
  for (const key of ['activityProfitAfterTax','disposalGainAfterTax','announcedCapacity']) assert.deepEqual(metrics[key], original[key]);
  assert.equal(metrics.activityProfitAfterTax.value, 930);
  assert.equal(metrics.activityProfitAfterTax.unit, 'EUR_thousand');
  assert.equal(metrics.disposalGainAfterTax.value, 2165);
  assert.equal(metrics.announcedCapacity.type, 'company_claim');
  assert.deepEqual([metrics.announcedCapacity.beds, metrics.announcedCapacity.operatingRooms], [100,4]);
  assert.equal(data.scenes[9].classification, 'company_claim');
  assert.equal(data.scenes[8].classification, 'published_fact');
});

check('Proposed tests and hypotheses are explicit and include possible disconfirmation', () => {
  assert.deepEqual(data.findings.map(f => f.id), ['nps','elliniko','gaia']);
  for (const f of data.findings) {
    assert(f.publishedFacts.length && Array.isArray(f.companyClaims));
    assert.equal(f.hypothesis.classification, 'hypothesis');
    assert(f.hypothesis.text && f.hypothesis.sourceIds.length);
    assert.equal(f.proposedTest.classification, 'proposal');
    assert(f.proposedTest.steps.length && f.proposedTest.couldDisconfirm && f.proposedTest.note);
  }
  for (const n of [5,8,11,12]) assert.equal(data.scenes[n-1].classification, 'proposal');
  assert.equal(data.scenes[5].classification, 'mixed');
  assert(data.aiDeclaration.includes('εκκρεμούν'));
});

const index = read('index.html'), ui = read('assets/ceo-presentation.js');
const legacy = read('historical-presentation.html');
function localPath(link, owner) {
  if (/^(?:https?:|data:|mailto:|#)/i.test(link)) return null;
  const decoded = decodeURIComponent(link.split(/[?#]/, 1)[0]);
  const full = path.resolve(root, decoded);
  assert(full.startsWith(root + path.sep), 'Link stays in published root: ' + owner);
  assert(fs.existsSync(full) && fs.statSync(full).isFile(), 'Missing UI target in ' + owner + ': ' + decoded);
  return decoded;
}
check('Entry and preserved historical page have valid local assets and links', () => {
  for (const [owner,html] of [['index.html',index],['historical-presentation.html',legacy]]) {
    for (const [,link] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) localPath(link, owner);
  }
  for (const file of ['writing/CEO-Ιατρικό-Αθηνών-3-Ευρήματα.pptx','research.html','strategy.html','organization.html','history.html','sap.html','historical-presentation.html','data/ceo-presentation.json']) {
    assert(ui.includes(file), 'Archive navigation retains: ' + file); localPath(file,'CEO archive');
  }
  assert(legacy.includes('assets/presentation.js') && legacy.includes('data/history-timeline.js'));
  assert(legacy.includes('01 / 15'), 'The former fifteen-scene presentation is retained');
  assert(!legacy.includes('assets/ceo-presentation.js'), 'Historical presentation retains its own player');
});

check('Initial page loads only the lightweight CEO player and self-contained data', () => {
  const scripts = [...index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(m => m[1].split('?')[0]);
  assert.deepEqual(scripts, ['assets/ceo-player-core.js','assets/ceo-presentation.js']);
  for (const dependency of ['data/history-timeline.js','data/context-timeline.js','data/media-catalog.js','assets/maps/greece-romania-region.js','assets/presentation.js','assets/history-atlas.js']) assert(!index.includes(dependency), 'No heavy initial dependency: ' + dependency);
  const fetched = [...ui.matchAll(/fetch\(['"]([^'"]+)['"]/g)].map(m => m[1].split('?')[0]);
  assert.deepEqual(fetched, ['data/ceo-presentation.json']);
  assert(index.includes('assets/media/marousi.png'), 'Cover is a local credited photo');
  assert(index.includes('data-action="start"') && index.includes('data-action="pause"') && index.includes('data-action="next"'));
  assert(index.includes('data-action="notes"') && index.includes('data-action="sources"'));
});

// Read the PPTX ZIP directory with Node builtins. This checks the linked deck,
// including XML relationships, without relying on an installed PowerPoint app.
function zipEntries(bytes) {
  let eocd = -1;
  for (let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) if(bytes.readUInt32LE(i)===0x06054b50){eocd=i;break;}
  assert(eocd >= 0, 'PPTX has a ZIP central directory');
  const count=bytes.readUInt16LE(eocd+10), entries=new Map();
  let p=bytes.readUInt32LE(eocd+16);
  for(let i=0;i<count;i++){
    assert.equal(bytes.readUInt32LE(p),0x02014b50);
    const method=bytes.readUInt16LE(p+10),size=bytes.readUInt32LE(p+20),nameLength=bytes.readUInt16LE(p+28),extraLength=bytes.readUInt16LE(p+30),commentLength=bytes.readUInt16LE(p+32),local=bytes.readUInt32LE(p+42);
    const name=bytes.subarray(p+46,p+46+nameLength).toString('utf8');
    const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
    const compressed=bytes.subarray(start,start+size);
    assert(method===0||method===8,'Supported ZIP method');
    entries.set(name,method===0?compressed:zlib.inflateRawSync(compressed));
    p+=46+nameLength+extraLength+commentLength;
  }
  return entries;
}
const pptx='writing/CEO-Ιατρικό-Αθηνών-3-Ευρήματα.pptx';
const pptxBytes=fs.readFileSync(path.join(root,pptx));
const pptxEntries=zipEntries(pptxBytes);
check('Linked PowerPoint is the verified twelve-slide deck with all speaker notes', () => {
  const auditPath='docs/CEO-PRESENTATION-20261119.json';
  const audit=fs.existsSync(path.join(root,auditPath))?json(auditPath):{
    sha256:'3900b6dbc09423ab3a00b899ac280f886823035f5f7dc831d755ed0b0c871551',
    slides:12,spokenDurationSeconds:420
  };
  assert.equal(crypto.createHash('sha256').update(pptxBytes).digest('hex'),audit.sha256);
  assert.equal(audit.slides,12);
  assert.equal(audit.spokenDurationSeconds,420);
  const names=[...pptxEntries.keys()];
  assert.equal(names.filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,12);
  const notes=names.filter(n=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
  assert.equal(notes.length,12);
  for(const n of notes){const t=pptxEntries.get(n).toString('utf8');assert(t.includes('ΤΙ ΛΕΜΕ')&&t.includes('ΟΡΙΟ ΕΡΜΗΝΕΙΑΣ'));}
});

check('New public assets contain no credential markers or local filesystem paths', () => {
  const patterns=[
    /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /(?<![A-Za-z])[A-Za-z]:[\\/]/,
    /file:\/\//i,
    /(?:^|[\s"'=])\/(?:Users|home|mnt|workspace)\//m,
    /https?:\/\/[^\s/'"<>]+:[^\s/'"<>]+@/i
  ];
  const files=['index.html','historical-presentation.html','assets/ceo-presentation.css','assets/ceo-presentation.js','assets/ceo-player-core.js','data/ceo-presentation.json'];
  function scan(name,text){for(const pattern of patterns)assert(!pattern.test(text),'Sensitive content or local path in '+name);}
  for(const file of files)scan(file,read(file));
  for(const [name,body] of pptxEntries)if(/\.(?:xml|rels)$/.test(name))scan(pptx+'!'+name,body.toString('utf8'));
});

console.log(`Validated CEO presentation: ${checks} checks, 12 scenes, ${sources.size} sources, 3 manual pauses, 300 seconds automatic / 420 seconds planned.`);
