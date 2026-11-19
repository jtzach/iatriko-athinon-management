// Ετήσια παρατήρηση — όχι πλήρης ετήσια απογραφή.
// Παράμετρος $year: το ζητούμενο έτος, π.χ. 2025.
MATCH (a:Entity)-[r]->(b:Entity)
WHERE r.year = $year
RETURN a, r, b;

// Ποιοι τεκμηριωμένοι ρόλοι συνδέονται με συγκεκριμένο πρόσωπο;
// Παράμετρος $personId: id από το organization-timeline.json.
MATCH (p:Person {id: $personId})-[held:HOLDS_ROLE]->(role:Role)
RETURN p.label AS person, role.label AS role, held.year AS year,
       held.observedAt AS observedAt, held.sourceIds AS sources
ORDER BY year;

// Μόνο ρητές, τεκμηριωμένες γραμμές αναφοράς.
MATCH (a:Entity)-[r:REPORTS_TO]->(b:Entity)
WHERE r.year = $year
RETURN a.label AS fromRole, b.label AS toRole, r.sourceIds AS sources,
       r.evidenceStatus AS evidenceStatus;

// Πεδία ευθύνης με τις χρονικές παρατηρήσεις τους.
MATCH (a:Entity)-[r:RESPONSIBLE_FOR]->(b:Entity)
WHERE r.year = $year
RETURN a.label AS responsibilityHolder, b.label AS responsibility,
       r.label AS relation, r.sourceIds AS sources;

// Κάλυψη τεκμηρίωσης, όχι μέγεθος οργανισμού.
MATCH (:Entity)-[r]->(:Entity)
RETURN r.year AS year, type(r) AS relationship, count(r) AS observations
ORDER BY year, relationship;
