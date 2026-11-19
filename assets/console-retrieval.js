(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ConsoleRetrieval = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // This index retrieves editorially checked cards. It does not generate text,
  // infer corporate facts, call a model or send the query to a remote service.
  const stopWords = new Set(('ο η το οι τα του της των τον την τους τις στον στην στο στους στις ' +
    'απο αποι αποια αποιο για με σε και ή αλλα αν ενα μια ενας ενος μιας ως οτι που πως τι ποιο ποια ποιος ' +
    'ποιοι ποιες ποιας ποιον ποτε γιατι ειναι ηταν θα να δεν εχει εχουν ειχε εχω εχουμε μας σας μου σου ' +
    'μεταξυ κατα καθως μεσα αυτο αυτη αυτος αυτα αυτες αυτων εδω εκει μπορει μπορουμε μπορεις ' +
    'θελω θελουμε δειξε βρες πες εξηγησε παρακαλω πληροφοριες σχετικα σημαινει σημαινουν ' +
    'ακριβως λιγα περισσοτερα συνοπτικα αναλυτικα απλα λογια γνωριζουμε ξερουμε λειτουργει ' +
    'tell me what is the a an of and about').split(/\s+/).map(normalize));
  const fieldWeights = { title: 6, aliases: 5, topic: 2.5, answer: 1 };
  const maxQueryLength = 400;

  function normalize(value) {
    return String(value == null ? '' : value).normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('el-GR')
      .replace(/ς/g, 'σ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  }

  function tokenize(value) {
    return [...new Set(normalize(value).split(' ').filter(t => t && !stopWords.has(t) && (t.length > 1 || /^\d$/.test(t))))];
  }

  function similarity(query, term) {
    if (query === term) return 1;
    // Conservative Greek inflection/prefix support, never an acronym expansion.
    if (query.length < 4 || term.length < 4 || !/[α-ω]/.test(query + term)) return 0;
    let common = 0;
    while (common < query.length && common < term.length && query[common] === term[common]) common++;
    return common >= 4 && common / Math.max(query.length, term.length) >= 0.72 ? 0.7 : 0;
  }

  function createIndex(cards) {
    if (!Array.isArray(cards)) throw new TypeError('Expected an array of evidence cards.');
    const ids = new Set();
    const documents = cards.map(card => {
      if (!card || typeof card.id !== 'string' || !card.id.trim() || ids.has(card.id) ||
          typeof card.title !== 'string' || typeof card.answer !== 'string') {
        throw new TypeError('Every card needs a unique ID, title and answer.');
      }
      ids.add(card.id);
      const copy = Object.freeze({ ...card,
        aliases: Object.freeze([...(Array.isArray(card.aliases) ? card.aliases : [])]),
        sourceIds: Object.freeze([...(Array.isArray(card.sourceIds) ? card.sourceIds : [])]),
        requirementIds: Object.freeze([...(Array.isArray(card.requirementIds) ? card.requirementIds : [])])
      });
      const values = { title: card.title, aliases: copy.aliases.join(' '), topic: card.topic || '', answer: card.answer };
      const fields = Object.fromEntries(Object.entries(values).map(([key, text]) => [key, tokenize(text)]));
      return { card: copy, fields, phrases: [card.title, ...copy.aliases].map(normalize), terms: new Set(Object.values(fields).flat()) };
    });
    const frequency = new Map();
    for (const doc of documents) for (const term of doc.terms) frequency.set(term, (frequency.get(term) || 0) + 1);
    const vocabulary = [...frequency.keys()];
    const idf = term => 1 + Math.log((documents.length + 1) / ((frequency.get(term) || 0) + 1));

    function search(query, limit = 5) {
      if (typeof query !== 'string' || !documents.length) return [];
      const count = Number.isFinite(limit) ? Math.min(10, Math.max(0, Math.floor(limit))) : 5;
      if (!count) return [];
      const input = query.slice(0, maxQueryLength), terms = tokenize(input);
      if (!terms.length) return [];
      // Unknown query words count against coverage. A known place name alone
      // must not turn an unrelated question about a person into an answer.
      const queryWeights = new Map(terms.map(term => {
        const known = vocabulary.filter(v => similarity(term, v) > 0);
        return [term, known.length ? Math.max(...known.map(idf)) : 2.6];
      }));
      const totalWeight = [...queryWeights.values()].reduce((sum, n) => sum + n, 0);
      const normalizedQuery = normalize(input);
      const results = [];
      for (const doc of documents) {
        let score = 0, coveredWeight = 0;
        const matchedTokens = [], matchedFields = new Set();
        for (const term of terms) {
          let best = 0, match = 0;
          for (const [field, words] of Object.entries(doc.fields)) {
            const strength = words.reduce((max, word) => Math.max(max, similarity(term, word)), 0);
            if (strength) {
              matchedFields.add(field);
              best = Math.max(best, strength * fieldWeights[field]);
              match = Math.max(match, strength);
            }
          }
          if (match) {
            matchedTokens.push(term);
            coveredWeight += queryWeights.get(term) * match;
            score += best * queryWeights.get(term);
          }
        }
        const coverage = coveredWeight / totalWeight;
        if (coverage < 0.56 || !matchedTokens.length) continue;
        const exactPhrase = doc.phrases.some(phrase => phrase && (normalizedQuery === phrase ||
          (phrase.length >= 4 && (' ' + normalizedQuery + ' ').includes(' ' + phrase + ' '))));
        if (exactPhrase) score += 8;
        score *= coverage;
        if (score < 2) continue;
        results.push({ card: doc.card, score: Math.round(score * 1000) / 1000,
          matchedTokens, matchedFields: [...matchedFields] });
      }
      return results.sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id, 'el-GR')).slice(0, count);
    }

    return Object.freeze({ search, stats: Object.freeze({ cards: documents.length, terms: vocabulary.length }) });
  }

  return Object.freeze({ normalize, tokenize, createIndex });
});
