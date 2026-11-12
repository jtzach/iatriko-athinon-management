'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// Run from any directory: node scripts/validate-atlas.js
// This checks the data and the DOM-free scene API; it does not replace visual QA.
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const sandbox = {window: {}};
const failures = [];
const skipped = new Set();
let checks = 0;
function test(name, run) {
  try { run(); checks++; console.log('PASS ' + name); }
  catch (error) { failures.push(name + ': ' + error.message); console.error('FAIL ' + name + ': ' + error.message); }
}
function unique(items, label) {
  const ids = items.map(item => item.id);
  assert(ids.every(id => typeof id === 'string' && id.length), label + ': missing ID');
  assert.equal(new Set(ids).size, ids.length, label + ': duplicate ID');
  return new Set(ids);
}
function mirrored(stem, globalName) {
  const data = JSON.parse(read('data/' + stem + '.json'));
  vm.runInNewContext(read('data/' + stem + '.js'), sandbox, {filename: 'data/' + stem + '.js'});
  assert.deepEqual(plain(sandbox.window[globalName]), data, stem + ': JSON/JS mismatch');
  return data;
}
const H = mirrored('history-timeline', 'HISTORY_TIMELINE');
const P = mirrored('people-timeline', 'PEOPLE_TIMELINE');
const C = mirrored('context-timeline', 'CONTEXT_TIMELINE');
const M = mirrored('media-catalog', 'MEDIA_CATALOG');
const S = mirrored('sap-timeline', 'SAP_TIMELINE');
console.log('PASS five JSON/JS mirrors');
checks++;
vm.runInNewContext(read('assets/history-atlas.js'), sandbox, {filename: 'assets/history-atlas.js'});
const model = sandbox.window.ATLAS_MODEL;
assert(model, 'Missing window.ATLAS_MODEL');
for (const key of ['scene', 'roleYears', 'roleVisible', 'roleLabel', 'projection']) assert.equal(typeof model[key], 'function', 'Missing model function: ' + key);
const people = new Map(P.people.map(person => [person.id, person]));
const sourceIds = new Set(P.sources.map(source => source.id));
const historySourceIds = new Set(H.sources.map(source => source.id));
const contextSourceIds = new Set(C.sources.map(source => source.id));
const evidenceIds = new Set(S.evidence.map(item => item.id));
const units = new Set(H.steps.flatMap(step => step.locations.map(location => location.id)));
const rolesFor = (id, year) => model.scene(year, [id]).roles.map(row => row.role);
const hasRole = (id, year, title) => rolesFor(id, year).some(role => role.title === title);

 test('34 named people, 53 sourced roles and valid identities', () => {
  assert.equal(P.people.length, 34);
  assert.equal(P.people.reduce((n, person) => n + person.roles.length, 0), 53);
  unique(P.people, 'people'); unique(P.sources, 'people sources');
  for (const person of P.people) {
    assert(person.name.trim());
    assert(['board', 'executive', 'clinic'].includes(person.kind));
    assert.equal(person.portrait, null, person.id + ': portraits belong to the media catalogue');
    for (const role of person.roles) {
      assert(['company', 'group', 'clinic'].includes(role.scope));
      assert(['dated', 'snapshot'].includes(role.precision));
      assert(role.sourceIds.length, person.id + ': role without evidence');
      role.sourceIds.forEach(id => assert(sourceIds.has(id), person.id + ': missing source ' + id));
      role.unitIds.forEach(id => assert(units.has(id), person.id + ': missing unit ' + id));
      assert.deepEqual(role.observedYears, [...new Set(role.observedYears)].sort((a, b) => a - b));
      for (const key of ['startYear', 'endYear']) assert(role[key] === null || Number.isInteger(role[key]));
      for (const [key, yearKey] of [['startDate', 'startYear'], ['endDate', 'endYear']]) {
        if (!role[key]) continue;
        assert(/^\d{4}-\d{2}-\d{2}$/.test(role[key]), person.id + ': malformed ' + key);
        assert.equal(Number(role[key].slice(0, 4)), role[yearKey]);
      }
      if (role.startYear !== null && role.endYear !== null) assert(role.startYear <= role.endYear);
    }
  }
  P.sources.forEach(source => assert(new URL(source.url).protocol === 'https:'));
});

test('leadership change does not move 2026 titles into 2025', () => {
  const oldTitle = 'Διευθύνων Σύμβουλος — εκτελεστικό μέλος ΔΣ';
  const newTitle = 'Πρόεδρος ΔΣ — εκτελεστικό μέλος';
  assert(hasRole('vasilis-apostolopoulos', 2025, oldTitle), 'Vasilis CEO missing in 2025');
  assert(!hasRole('vasilis-apostolopoulos', 2026, oldTitle), 'Old CEO title leaked into selected 2026 records');
  assert(!hasRole('vasilis-apostolopoulos', 2025, newTitle), 'Chairmanship shown before 2026');
  assert(hasRole('vasilis-apostolopoulos', 2026, newTitle), 'New chairmanship missing in 2026');
  assert(!hasRole('christos-apostolopoulos', 2025, oldTitle), 'Christos CEO shown before 2026');
  assert(hasRole('christos-apostolopoulos', 2026, oldTitle), 'Christos CEO missing in 2026');
  const newChair = people.get('vasilis-apostolopoulos').roles.find(role => role.title === newTitle);
  assert.equal(newChair.startDate, '2026-01-02');
});

test('Talaris clinic duties begin in 2025 and are not extended to 2026', () => {
  const clinicTitles = ['Γενικός Διευθυντής Ιατρικού Παλαιού Φαλήρου', 'Γενικός Διευθυντής Ιατρικού Περιστερίου'];
  for (const title of clinicTitles) {
    assert(!hasRole('theodoros-talaris', 2024, title), title + ': leaked into 2024');
    assert(hasRole('theodoros-talaris', 2025, title), title + ': missing in 2025');
    assert(!hasRole('theodoros-talaris', 2026, title), title + ': unknown end was treated as current');
  }
});

test('within-year records retain explicit departures but stop afterwards', () => {
  const examples = [
    ['george-boutsioukos', 'Διευθυντής Διαχείρισης Ανθρώπινου Δυναμικού', 2022, '2022-02-16'],
    ['anastasios-tagaris', 'Διευθυντής Πληροφορικής Ομίλου', 2023, '2023-04-18'],
    ['despoina-papachristou', 'Γενική Διευθύντρια Ιατρικού Περιστερίου', 2024, '2024-12-31']
  ];
  for (const [id, title, year, endDate] of examples) {
    assert(hasRole(id, year, title), id + ': a role held during the year must remain in that annual set');
    assert(!hasRole(id, year + 1, title), id + ': ended role leaked into following year');
    assert.equal(people.get(id).roles.find(role => role.title === title).endDate, endDate);
  }
});

test('multi-person selection returns only the selected people and their units', () => {
  const selection = ['theodoros-talaris', 'varvara-pliatsika'];
  const scene = model.scene(2025, selection);
  assert.equal(scene.personCount, 2);
  assert(scene.roles.every(row => selection.includes(row.person.id)));
  assert.deepEqual([...new Set(scene.roles.map(row => row.person.id))].sort(), [...selection].sort());
  assert.deepEqual([...scene.unitIds].sort(), ['dafni', 'faliro', 'peristeri']);
  assert.equal(model.scene(2025, ['not-a-real-person']).roles.length, 0);
  assert.equal(model.scene(2026, selection).roles.length, 0, 'Unknown ends cannot imply ongoing roles');
});

test('early years show supported historical identities, not all present-day management', () => {
  const early = model.scene(1984);
  assert(early.personCount < P.people.length);
  assert.equal(early.locations.length, 1);
  assert.equal(early.locations[0].id, 'marousi');
  const founder = early.roles.find(row => row.person.id === 'george-apostolopoulos' && /Ιδρυτής/.test(row.role.title));
  assert(founder && /ιστορική ιδιότητα/.test(founder.role.title), 'Founder must be labelled as a historical identity');
  assert(!early.roles.some(row => /Πρόεδρος ΔΣ|Διευθύνων Σύμβουλος/.test(row.role.title)), 'No invented early board offices');
  assert(H.steps.filter(step => step.year < 2022).every(step => step.management.length === 0));
});

test('every location has a bounded geographic position and valid history evidence', () => {
  unique(H.sources, 'history sources'); unique(M.locations, 'map positions');
  const positions = new Map(M.locations.map(position => [position.id, position]));
  assert.equal(units.size, 8);
  const [west, south, east, north] = model.bounds.region;
  const project = model.projection('region');
  for (const id of units) {
    const position = positions.get(id);
    assert(position, 'Missing geographic position: ' + id);
    assert(Number.isFinite(position.lon) && Number.isFinite(position.lat));
    assert(position.lon >= west && position.lon <= east && position.lat >= south && position.lat <= north, id + ': outside region bounds');
    const [x, y] = project(position.lon, position.lat);
    assert(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 760 && y >= 0 && y <= 600, id + ': bad projection');
    assert(/^https:\/\//.test(position.sourceUrl), id + ': missing public geographic source');
    assert(position.basis, id + ': missing coordinate limitation');
  }
  for (const step of H.steps) {
    step.sourceIds.forEach(id => assert(historySourceIds.has(id)));
    for (const location of step.locations) location.sourceIds.forEach(id => assert(historySourceIds.has(id)));
  }
  for (let year = 1984; year <= 2026; year++) {
    const scene = model.scene(year);
    assert(scene.step.year <= year);
    scene.locations.forEach(location => assert(model.firstSeen[location.id] <= year));
  }
});

test('historical context never appears before its event year', () => {
  unique(C.events, 'context events'); unique(C.sources, 'context sources');
  for (const event of C.events) {
    assert(Number.isInteger(event.year));
    assert(event.sourceIds.length);
    event.sourceIds.forEach(id => assert(contextSourceIds.has(id), event.id + ': missing context source ' + id));
  }
  assert.equal(model.scene(1984).events.length, 0);
  for (let year = 1984; year <= 2026; year++) {
    const scene = model.scene(year);
    assert(scene.events.length <= 3);
    assert(scene.events.every(event => event.year <= year), 'Future context at ' + year);
    for (let i = 1; i < scene.events.length; i++) assert(scene.events[i - 1].year >= scene.events[i].year);
  }
});

test('research hypotheses remain separate from sourced event statements', () => {
  for (const event of C.events) {
    const hypothesis = event.hypothesis;
    assert(hypothesis && hypothesis.claim && hypothesis.alternative && hypothesis.needed.length, event.id + ': incomplete hypothesis');
    assert(/^Ερευνητική υπόθεση:/i.test(hypothesis.claim), event.id + ': claim lacks explicit hypothesis label');
    assert(!['fact', 'documented', 'verified'].includes(hypothesis.status), event.id + ': hypothesis classified as fact');
    const eventStatement = {...event}; delete eventStatement.hypothesis;
    assert(!JSON.stringify(eventStatement).includes(hypothesis.claim), event.id + ': hypothesis merged into fact layer');
    (hypothesis.companyEvidenceIds || []).forEach(id => assert(evidenceIds.has(id), event.id + ': unknown company evidence ' + id));
  }
  for (const hypothesis of S.hypotheses) {
    assert.equal(hypothesis.status, 'hypothesis');
    assert(hypothesis.missingEvidence.length);
    hypothesis.supportingEvidenceIds.forEach(id => assert(evidenceIds.has(id)));
  }
});

const combinedPath = 'data/management-atlas.json';
test('combined download matches its component datasets when available', () => {
  if (!fs.existsSync(path.join(root, combinedPath))) { skipped.add(combinedPath + ' (not created yet)'); return; }
  const combined = JSON.parse(read(combinedPath));
  const arrays = [];
  function visit(value) {
    if (Array.isArray(value)) { arrays.push(JSON.stringify(value)); value.forEach(visit); }
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  }
  visit(combined);
  for (const [name, array] of [['people', P.people], ['history steps', H.steps], ['context events', C.events], ['map locations', M.locations]]) {
    assert(arrays.includes(JSON.stringify(array)), 'Combined download differs from live ' + name);
  }
});

function htmlFiles(dir = root) {
  const result = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory() && !['.git', 'node_modules', '.venv', 'tmp'].includes(entry.name)) result.push(...htmlFiles(path.join(dir, entry.name)));
    else if (entry.isFile() && /\.html?$/i.test(entry.name)) result.push(path.join(dir, entry.name));
  }
  return result;
}
function checkLocalURL(raw, file, line, anchor = false) {
  raw = raw.replace(/&amp;/g, '&').trim();
  if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) return;
  const base = 'https://atlas-local.invalid/' + path.relative(root, file).split(path.sep).join('/');
  const url = new URL(raw, base);
  const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  assert(target === root || target.startsWith(root + path.sep), 'Local link escapes site root: ' + raw);
  if (relative === combinedPath && !fs.existsSync(target)) { skipped.add(combinedPath + ' link (not created yet)'); return; }
  assert(fs.existsSync(target), path.relative(root, file) + ':' + line + ': missing ' + raw);
  const resolved = fs.statSync(target).isDirectory() ? path.join(target, 'index.html') : target;
  assert(fs.existsSync(resolved), 'Directory link has no index.html: ' + raw);
  if (anchor && url.hash.length > 1 && /\.html?$/i.test(resolved)) {
    const id = decodeURIComponent(url.hash.slice(1));
    if (/^:~:text=/.test(id)) return;
    const html = fs.readFileSync(resolved, 'utf8');
    const ids = [...html.matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
    assert(ids.includes(id), path.relative(root, file) + ':' + line + ': missing anchor ' + raw);
  }
}
test('all local HTML links, scripts, styles and media assets resolve', () => {
  const files = htmlFiles(); assert(files.length >= 3);
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/\b(href|src|poster)\s*=\s*["']([^"']*)["']/gi)) {
      const line = html.slice(0, match.index).split('\n').length;
      checkLocalURL(match[2], file, line, match[1].toLowerCase() === 'href');
    }
    for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
      if (match[1].trim().startsWith('data:')) continue;
      for (const item of match[1].split(',')) checkLocalURL(item.trim().split(/\s+/)[0], file, html.slice(0, match.index).split('\n').length);
    }
  }
  for (const photo of M.photos) {
    if (photo.personId) assert(people.has(photo.personId), 'Unknown photo identity: ' + photo.personId);
    (photo.personIds || []).forEach(id => assert(people.has(id), 'Unknown group photo identity: ' + id));
    if (photo.unitId) assert(units.has(photo.unitId), 'Unknown photo location: ' + photo.unitId);
    checkLocalURL(photo.src, path.join(root, 'history.html'), 0);
  }
  console.log('Checked ' + files.length + ' HTML files and ' + M.photos.length + ' media entries.');
});

for (const item of skipped) console.log('SKIP ' + item);
if (failures.length) {
  console.error('\nAtlas validation: ' + failures.length + ' failed; ' + checks + ' passed.');
  process.exitCode = 1;
} else console.log('\nAtlas validation: ' + checks + ' checks passed' + (skipped.size ? '; ' + skipped.size + ' pending combined-download checks' : '') + '.');
