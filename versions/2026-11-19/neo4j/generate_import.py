"""Write an idempotent Cypher import from the same validated source JSON."""
import argparse
import json
from pathlib import Path
from build_snapshot import LABELS, RELATIONSHIPS, create_properties, validate


def literal(value):
    if isinstance(value, dict):
        return "{" + ", ".join("`" + k.replace("`", "``") + "`: " + literal(v) for k, v in value.items()) + "}"
    if isinstance(value, list):
        return "[" + ", ".join(literal(v) for v in value) + "]"
    return json.dumps(value, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    data = json.loads(args.input.read_bytes())
    validate(data)
    statements = ["// MBA-4: εισαγωγή σε ΚΕΝΗ, ξεχωριστή βάση Neo4j Community.",
                  "// Δεν διαγράφει στοιχεία. Για αλλαγή έκδοσης χρησιμοποιήστε νέα κενή βάση.",
                  "// Οι παρατηρήσεις ανά έτος δεν τεκμηριώνουν αδιάλειπτες θητείες.",
                  "CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE;",
                  "CREATE CONSTRAINT source_id IF NOT EXISTS FOR (n:EvidenceSource) REQUIRE n.id IS UNIQUE;"]
    for kind, label in LABELS.items():
        nodes = [create_properties(x) for x in data["nodes"] if x["type"].lower() == kind]
        if nodes:
            statements.append("UNWIND " + literal(nodes) + f" AS item MERGE (n:Entity:{label} {{id: item.id}}) SET n = item;")
    statements.append("UNWIND " + literal([create_properties(x) for x in data["sources"]]) +
                      " AS item MERGE (s:EvidenceSource {id: item.id}) SET s = item;")
    for kind in RELATIONSHIPS:
        edges = [create_properties(x) for x in data["observations"] if x["type"] == kind]
        if edges:
            statements.append("UNWIND " + literal(edges) +
                " AS item MATCH (a:Entity {id: item.source}), (b:Entity {id: item.target}) " +
                f"MERGE (a)-[r:{kind} {{id: item.id}}]->(b) SET r = item;")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(("\n\n".join(statements) + "\n").encode("utf-8"))
    print("Portable Cypher import generated from validated evidence.")


if __name__ == "__main__":
    main()
