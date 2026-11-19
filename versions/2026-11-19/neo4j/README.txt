NEO4J — Ο ΔΙΟΙΚΗΤΙΚΟΣ ΓΡΑΦΟΣ ΤΟΥ ΙΑΤΡΙΚΟΥ ΑΘΗΝΩΝ

ΤΙ ΚΑΝΕΙ
Η τεκμηριωμένη βάση organization-timeline.json εισάγεται σε πραγματική
Neo4j Community. Οι κόμβοι και οι χρονικές παρατηρήσεις ανακτώνται με
Cypher και δημοσιεύονται ως organization-graph.json. Η ιστοσελίδα διαβάζει
αυτό το επαληθευμένο στιγμιότυπο. Η μετακίνηση των κόμβων αλλάζει μόνο
την εμφάνιση, όχι τις τεκμηριωμένες αρμοδιότητες ή τη βάση.

Δεν υπάρχει ζωντανή σύνδεση βάσης μέσα στο GitHub Pages και δεν απαιτείται
κωδικός από τον επισκέπτη. Η μετακίνηση κόμβων υλοποιείται από το γραφικό
περιβάλλον της ιστοσελίδας, όχι από τη μηχανή αποθήκευσης Neo4j.

ΔΕΔΟΜΕΝΑ
Person → HOLDS_ROLE → Role
Role/Body → RESPONSIBLE_FOR → Unit/Function
Role/Body → REPORTS_TO → Role/Body, μόνο με ρητή τεκμηρίωση
Person/Role → MEMBER_OF → Body, όπου τεκμηριώνεται

Κάθε σχέση έχει ξεχωριστό id, έτος, sourceIds, ημερομηνίες και περιορισμούς.
Οι γραμμές αποτελούν χρονικές παρατηρήσεις πηγών και όχι βεβαίωση πλήρους
οργανογράμματος ή αδιάλειπτης θητείας. Τα έτη χωρίς τεκμήρια παραμένουν κενά.
Κάθε κόμβος/σχέση κρατά επίσης payload JSON ώστε να διατηρούνται ακριβώς
οι σύνθετες παραπομπές και οι περιορισμοί. Οι βασικές ιδιότητες παραμένουν
άμεσα διαθέσιμες ως ιδιότητες Neo4j για ερωτήματα Cypher.

ΑΝΑΠΑΡΑΓΩΓΗ
Απαιτούνται Python 3.10+ και εγκατεστημένο Docker με ενεργό engine.
Από τη ρίζα του δημοσιευμένου repository:

python neo4j/build_snapshot.py --input data/organization-timeline.json --output data/organization-graph.json --report neo4j/verification.json

Χρησιμοποιείται η επίσημη εικόνα Neo4j Community 2026.10.2, με σταθερό digest.
Το πρόγραμμα δημιουργεί προσωρινό απομονωμένο container, τυχαίο κωδικό
στη μνήμη και θύρα δεσμευμένη μόνο στο 127.0.0.1. Το auth παραμένει ενεργό
και ελέγχεται ότι μη πιστοποιημένο αίτημα απορρίπτεται. Η τηλεμετρία χρήσης
και το Fleet Manager/discovery απενεργοποιούνται στην προσωρινή βάση.
Δεν χρησιμοποιούνται διαπιστευτήρια Git, αρχεία .env ή μόνιμοι τόμοι.
Μετά την εξαγωγή το container και οι ανώνυμοι τόμοι αφαιρούνται από Docker.
Η ληφθείσα επίσημη εικόνα παραμένει στην τοπική cache για επανάχρηση.

Το verification.json περιέχει την πραγματική έκδοση/edition, digest εικόνας,
hash πηγής/εξαγωγής, αριθμούς κόμβων/παρατηρήσεων, έλεγχο ανά έτος και
ακριβή ισότητα περιεχομένου πριν και μετά τη διέλευση από Neo4j.

ΓΙΑ ΔΙΚΗ ΣΑΣ ΒΑΣΗ NEO4J
Το import.cypher είναι φορητό αρχείο χωρίς διαπιστευτήρια. Εκτελείται
σε κενή ξεχωριστή βάση Neo4j. Τα queries.cypher περιέχουν παραδείγματα
με παραμέτρους $year και $personId. Για να παραχθεί νέο import:

python neo4j/generate_import.py --input data/organization-timeline.json --output neo4j/import.cypher

Τα παραδείγματα δεν συνδέονται σε υπάρχουσα βάση χωρίς δική σας ενέργεια.
Δεν διαγράφουν υφιστάμενα δεδομένα, αλλά μια νέα έκδοση χρειάζεται νέα
κενή βάση, ώστε να μην παραμείνουν παλαιές παρατηρήσεις.

ΕΠΙΣΗΜΗ ΤΕΚΜΗΡΙΩΣΗ (ΕΛΕΓΧΟΣ 12/11/2026)
https://neo4j.com/docs/operations-manual/current/docker/introduction/
https://neo4j.com/docs/operations-manual/current/installation/requirements/
https://neo4j.com/docs/query-api/current/query/
https://neo4j.com/docs/operations-manual/current/configuration/configuration-settings/
https://neo4j.com/legal-terms/

Χρησιμοποιείται Community Edition (GPL v3), όχι Enterprise ή Aura.
Δεν αναδιανέμεται η μηχανή Neo4j μέσα στην ιστοσελίδα· μόνο τα δεδομένα,
τα δικά μας scripts εισαγωγής/εξαγωγής και ο έλεγχος αναπαραγωγιμότητας.
