(() => {
  'use strict';
  const data = window.HISTORY_TIMELINE || {sources: [], steps: []};
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const sources = new Map((data.sources || []).map(source => [source.id, source]));
  const regions = ['Πλοϊέστι', 'Βουκουρέστι', 'Θεσσαλονίκη', 'Αττική'];
  // Only literally identical statements repeated at every station are generic.
  const commonLimitations = new Set((steps[0]?.limitations || []).filter(limit => steps.every(step => (step.limitations || []).includes(limit))));
  const isSourceConflict = limit => !commonLimitations.has(limit) && /δεν συμφωνούν|απόκλιση|δεν έχει συμφιλιωθεί|δεν έχουν συμφιλιωθεί/i.test(limit);
  const clamp = index => Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
  const getStep = index => steps[clamp(index)] || null;
  const managementKey = item => item.title + '|' + item.detail;
  function getChanges(index) {
    const step = getStep(index);
    const previous = index > 0 ? getStep(index - 1) : null;
    if (!step) return {locationIds: [], updatedLocationIds: [], managementTitles: []};
    const oldLocations = new Map((previous?.locations || []).map(location => [location.id, location]));
    const oldManagement = new Set((previous?.management || []).map(managementKey));
    return {
      locationIds: (step.locations || []).filter(location => !oldLocations.has(location.id)).map(location => location.id),
      updatedLocationIds: (step.locations || []).filter(location => {
        const old = oldLocations.get(location.id);
        return old && (old.detail !== location.detail || old.countLabel !== location.countLabel);
      }).map(location => location.id),
      managementTitles: (step.management || []).filter(item => !oldManagement.has(managementKey(item))).map(item => item.title)
    };
  }
  window.HISTORY_MODEL = Object.freeze({getStep, getChanges, regions: [...regions], stepCount: steps.length});
  if (typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  if (!$('history-map')) return;
  if (!steps.length) {
    $('history-step-title').textContent = 'Το χρονολόγιο δεν φορτώθηκε.';
    $('history-step-summary').textContent = 'Ανανεώστε τη σελίδα ή ανοίξτε την τεκμηρίωση από τον σύνδεσμο πηγών.';
    for (const id of ['history-play', 'history-prev', 'history-next', 'history-range']) $(id).disabled = true;
    return;
  }
  let current = 0;
  let timer = null;
  let selectedKey = null;
  const E = (tag, className = '', text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  function sourceLink(id) {
    const source = sources.get(id);
    if (!source) return E('span', 'history-source-unavailable', 'Μη διαθέσιμη παραπομπή: ' + id);
    const link = E('a', 'history-source-link', source.title + ' ↗');
    try {
      const url = new URL(source.url);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported source URL');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } catch (_) {
      return E('span', 'history-source-unavailable', source.title);
    }
    return link;
  }
  function sourceLinks(ids, className = '') {
    const box = E('div', 'history-source-links ' + className);
    [...new Set(ids || [])].forEach(id => box.append(sourceLink(id)));
    return box;
  }
  function image(name) {
    const img = E('img');
    img.src = 'assets/illustrations/' + name + '.svg';
    img.alt = '';
    img.width = 48;
    img.height = 39;
    return img;
  }
  function stop() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    $('history-play').setAttribute('aria-pressed', 'false');
    $('history-play').replaceChildren(E('span', '', '▶'), document.createTextNode(current === steps.length - 1 ? ' Από την αρχή' : ' Αναπαραγωγή'));
    $('history-play').firstChild.setAttribute('aria-hidden', 'true');
  }
  function selectDetail(key, title, detail, ids, context) {
    selectedKey = key;
    document.querySelectorAll('[data-history-key]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.historyKey === key)));
    $('history-detail-title').textContent = title;
    const body = $('history-detail-body');
    body.replaceChildren(E('p', 'history-detail-context', context), E('p', '', detail));
    body.append(sourceLinks(ids));
    if (!(ids || []).length) body.append(E('p', 'history-detail-empty', 'Δεν παρέχεται ειδική παραπομπή για αυτό το στοιχείο.'));
  }
  function locationButton(location, isNew, isUpdated) {
    const button = E('button', 'history-location' + (isNew ? ' is-new' : isUpdated ? ' is-updated' : ''));
    button.type = 'button';
    button.dataset.historyKey = 'location-' + location.id;
    button.setAttribute('aria-pressed', 'false');
    button.append(image('hospital'));
    const text = E('span', 'history-location-copy');
    text.append(E('strong', '', location.label));
    if (location.countLabel) text.append(E('small', '', location.countLabel));
    if (isNew) text.append(E('span', 'history-new-tag', 'Προστίθεται στην αποτύπωση'));
    else if (isUpdated) text.append(E('span', 'history-new-tag', 'Νέα πληροφορία'));
    button.append(text, E('span', 'history-card-arrow', '↗'));
    button.addEventListener('click', () => {
      stop();
      selectDetail(button.dataset.historyKey, location.label, location.detail, location.sourceIds, location.region + ' · τεκμήρια έως τον σταθμό ' + getStep(current).year);
    });
    return button;
  }
  function regionPanel(region, locations, newIds, updatedIds) {
    const panel = E('section', 'history-region' + (!locations.length ? ' is-unrecorded' : ''));
    panel.setAttribute('aria-label', region);
    panel.append(E('h4', '', region));
    const list = E('div', 'history-location-list');
    if (locations.length) locations.forEach(location => list.append(locationButton(location, newIds.has(location.id), updatedIds.has(location.id))));
    else list.append(E('p', 'history-unrecorded', 'Δεν έχει προστεθεί τεκμήριο σε αυτόν τον σταθμό.'));
    panel.append(list);
    return panel;
  }
  function renderMap(step, changes) {
    const map = $('history-map');
    map.replaceChildren();
    const locations = step.locations || [];
    const newIds = new Set(changes.locationIds);
    const updatedIds = new Set(changes.updatedLocationIds);
    for (const [name, cityNames] of [['Ρουμανία', ['Πλοϊέστι', 'Βουκουρέστι']], ['Ελλάδα', ['Θεσσαλονίκη', 'Αττική']]]) {
      const country = E('section', 'history-country');
      country.append(E('h3', 'history-country-name', name));
      const zones = E('div', 'history-country-regions');
      cityNames.forEach(region => zones.append(regionPanel(region, locations.filter(location => location.region === region), newIds, updatedIds)));
      country.append(zones);
      map.append(country);
    }
    const other = locations.filter(location => !regions.includes(location.region));
    if (other.length) map.append(regionPanel('Άλλες τεκμηριωμένες τοποθεσίες', other, newIds, updatedIds));
    $('history-location-count').textContent = locations.length + ' τεκμηριωμέν' + (locations.length === 1 ? 'η τοποθεσία' : 'ες τοποθεσίες') + ' έως τον σταθμό';
  }
  function renderManagement(step, changes) {
    const list = $('history-management-cards');
    list.replaceChildren();
    const management = step.management || [];
    if (!management.length) {
      const empty = E('div', 'history-management-empty');
      empty.append(image('structure'), E('h4', '', 'Δεν διαθέτουμε επαρκές ιστορικό οργανόγραμμα.'), E('p', '', 'Για αυτή την περίοδο οι επιλεγμένες πηγές δεν αρκούν για ασφαλή αποτύπωση διοικητικών ρόλων και γραμμών αναφοράς.'));
      list.append(empty);
      return;
    }
    const changed = new Set(changes.managementTitles);
    management.forEach((item, i) => {
      const button = E('button', 'history-manager' + (changed.has(item.title) ? ' is-new' : ''));
      button.type = 'button';
      button.dataset.historyKey = 'management-' + i;
      button.setAttribute('aria-pressed', 'false');
      const heading = E('span', 'history-manager-heading');
      heading.append(image('leadership'), E('strong', '', item.title), E('span', 'history-card-arrow', '↗'));
      button.append(heading, E('span', 'history-manager-detail', item.detail));
      if (changed.has(item.title)) button.append(E('span', 'history-new-tag', 'Νέα καταγραφή σε αυτόν τον σταθμό'));
      button.addEventListener('click', () => {
        stop();
        selectDetail(button.dataset.historyKey, item.title, item.detail, item.sourceIds, 'Διοικητική εικόνα · σταθμός ' + step.year);
      });
      list.append(button);
    });
  }
  function setStep(index, fromPlayback = false, updateURL = true) {
    if (!fromPlayback) stop();
    current = clamp(index);
    selectedKey = null;
    const step = getStep(current);
    const changes = getChanges(current);
    $('history-year').textContent = step.year;
    $('history-range').value = String(current);
    $('history-range').setAttribute('aria-valuetext', step.year + ' · ' + step.title);
    $('history-step-title').textContent = step.title;
    $('history-step-summary').textContent = step.summary;
    $('history-step-sources').replaceChildren(sourceLinks(step.sourceIds));
    document.querySelectorAll('[data-history-step]').forEach(button => {
      const on = Number(button.dataset.historyStep) === current;
      button.setAttribute('aria-pressed', String(on));
      if (on) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    $('history-prev').disabled = current === 0;
    $('history-next').disabled = current === steps.length - 1;
    const limits = $('history-limitations');
    limits.replaceChildren();
    if ((step.limitations || []).length) {
      const conflicts = step.limitations.filter(isSourceConflict);
      if (conflicts.length) {
        limits.append(E('strong', 'history-conflict-title', 'Αποκλίσεις μεταξύ των πηγών'));
        const visible = E('ul', 'history-visible-conflicts');
        conflicts.forEach(limit => visible.append(E('li', '', limit)));
        limits.append(visible);
      }
      const remaining = step.limitations.filter(limit => !isSourceConflict(limit));
      if (remaining.length) {
        const disclosure = E('details', 'history-limits-details');
        disclosure.append(E('summary', '', 'Όρια και διευκρινίσεις της αποτύπωσης (' + remaining.length + ')'));
        const ul = E('ul');
        remaining.forEach(limit => ul.append(E('li', '', limit)));
        disclosure.append(ul);
        limits.append(disclosure);
      }
      limits.hidden = false;
    } else limits.hidden = true;
    renderMap(step, changes);
    renderManagement(step, changes);
    $('history-detail-title').textContent = 'Επιλέξτε μια τοποθεσία ή έναν διοικητικό ρόλο.';
    $('history-detail-body').replaceChildren(E('p', '', 'Ανοίξτε μια κάρτα για την περιγραφή της και τις πρωτογενείς πηγές. Οι τοποθεσίες δεν ταυτίζονται με τον αριθμό ενεργών κλινικών.'));
    $('history-status').textContent = 'Σταθμός ' + step.year + '. ' + step.title + '. ' + (step.locations || []).length + ' τεκμηριωμένες τοποθεσίες έως τον σταθμό.';
    if (updateURL && window.history?.replaceState) window.history.replaceState(null, '', '#year-' + step.year);
    if (current === steps.length - 1) stop();
    else if (timer === null) stop();
  }
  function play() {
    if (timer !== null) { stop(); return; }
    if (current === steps.length - 1) setStep(0, true);
    $('history-play').replaceChildren(E('span', '', 'Ⅱ'), document.createTextNode(' Παύση'));
    $('history-play').firstChild.setAttribute('aria-hidden', 'true');
    $('history-play').setAttribute('aria-pressed', 'true');
    timer = window.setInterval(() => setStep(current + 1, true), 2500);
  }
  $('history-range').max = String(steps.length - 1);
  const changeKey = document.querySelector('.history-map-key > span:last-child');
  if (changeKey) {
    const mark = E('i', 'new');
    mark.setAttribute('aria-hidden', 'true');
    changeKey.replaceChildren(mark, document.createTextNode('Νέα ή εμπλουτισμένη καταγραφή'));
  }
  steps.forEach((step, i) => {
    const button = E('button', '', String(step.year));
    button.type = 'button';
    button.dataset.historyStep = String(i);
    button.setAttribute('aria-label', step.year + ' · ' + step.title);
    button.addEventListener('click', () => setStep(i));
    $('history-years').append(button);
  });
  $('history-play').addEventListener('click', play);
  $('history-prev').addEventListener('click', () => setStep(current - 1));
  $('history-next').addEventListener('click', () => setStep(current + 1));
  $('history-range').addEventListener('input', event => setStep(Number(event.target.value)));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  for (const source of sources.values()) {
    const row = E('div', 'history-source-entry');
    row.append(E('span', 'history-source-id', source.id), sourceLink(source.id));
    $('history-source-list').append(row);
  }
  const initialYear = Number((window.location.hash.match(/^#year-(\d{4})$/) || [])[1]);
  const initial = steps.findIndex(step => Number(step.year) === initialYear);
  setStep(initial >= 0 ? initial : 0, false, false);
  window.addEventListener('hashchange', () => {
    const year = Number((window.location.hash.match(/^#year-(\d{4})$/) || [])[1]);
    const index = steps.findIndex(step => Number(step.year) === year);
    if (index >= 0) setStep(index, false, false);
  });
})();
