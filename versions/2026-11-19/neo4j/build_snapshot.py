"""Import the sourced organization graph into isolated Neo4j and export it.

Python 3.10+ and a running Docker engine are the only prerequisites.
No password is accepted on the command line or saved in a file.
"""
from __future__ import annotations

import argparse
import base64
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import time
import urllib.error
import urllib.request


RELATIONSHIPS = ("HOLDS_ROLE", "RESPONSIBLE_FOR", "REPORTS_TO", "MEMBER_OF")
LABELS = {"person": "Person", "role": "Role", "unit": "Unit",
          "function": "Function", "body": "Body"}
DEFAULT_IMAGE = "neo4j:2026.10.2@sha256:4a2fd4f41ce384aa7d6a74b399f22c202e154f3966119c28a18ed9a500904f5e"


def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def run_docker(*args, env=None, timeout=60, check=True):
    result = subprocess.run(["docker", *args], env=env, text=True,
                            capture_output=True, timeout=timeout)
    if check and result.returncode:
        # Docker can include environment settings in diagnostics. Never echo it.
        raise RuntimeError("Docker operation failed: " + args[0])
    return result.stdout.strip()


def validate(data):
    nodes = data["nodes"]
    observations = data["observations"]
    node_ids = {x["id"] for x in nodes}
    assert len(node_ids) == len(nodes), "Duplicate node IDs"
    assert len({x["id"] for x in observations}) == len(observations), "Duplicate observation IDs"
    source_ids = {x["id"] for x in data["sources"]}
    assert len(source_ids) == len(data["sources"]), "Duplicate evidence IDs"
    node_types = {x["id"]: x["type"].lower() for x in nodes}
    for node in nodes:
        assert node["type"].lower() in LABELS, "Unknown node type"
        assert set(node.get("sourceIds", [])) <= source_ids, "Unknown node evidence"
    for observation in observations:
        assert observation["type"] in RELATIONSHIPS, "Unknown relationship type"
        assert observation["source"] in node_ids and observation["target"] in node_ids, "Missing endpoint"
        assert isinstance(observation["year"], int), "Observation year must be explicit"
        assert observation.get("sourceIds"), "Every observation needs evidence"
        assert set(observation["sourceIds"]) <= source_ids, "Unknown observation evidence"
        if observation["type"] == "HOLDS_ROLE":
            assert node_types[observation["source"]] == "person" and node_types[observation["target"]] == "role", "Invalid role holder endpoints"
    for year in data["years"]:
        expected = {x["id"] for x in observations if x["year"] == year["year"]}
        assert set(year["observationIds"]) == expected, "Year index mismatch"


class QueryClient:
    def __init__(self, port, password):
        self.url = f"http://127.0.0.1:{port}/db/neo4j/query/v2"
        self.authorization = "Basic " + base64.b64encode(("neo4j:" + password).encode()).decode()
        self.calls = 0

    def query(self, statement, parameters=None):
        request = urllib.request.Request(self.url,
            data=packed({"statement": statement, "parameters": parameters or {}}).encode("utf-8"),
            headers={"Authorization": self.authorization, "Content-Type": "application/json",
                     "Accept": "application/json"}, method="POST")
        # Do not print the request or response: only selected non-secret results.
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.load(response)
        self.calls += 1
        if result.get("errors"):
            raise RuntimeError("Neo4j query failed: " + str(result["errors"][0].get("code", "unknown")))
        data = result.get("data", {})
        return [dict(zip(data.get("fields", []), values)) for values in data.get("values", [])]


def create_properties(item):
    # Payload preserves every nested citation and limitation exactly. The simple
    # properties below remain directly usable in Cypher without JSON parsing.
    result = {key: value for key, value in item.items()
              if value is not None and (isinstance(value, (str, int, float, bool)) or
                 isinstance(value, list) and all(isinstance(v, (str, int, float, bool)) for v in value))}
    result["payload"] = packed(item)
    return result


def build(args):
    raw = args.input.read_bytes()
    data = json.loads(raw)
    validate(data)
    dataset_hash = hashlib.sha256(raw).hexdigest()
    name = "mba4-neo4j-" + secrets.token_hex(6)
    password = secrets.token_urlsafe(32)
    env = dict(os.environ)
    env["NEO4J_AUTH"] = "neo4j/" + password
    started = False
    try:
        run_docker("run", "--detach", "--rm", "--name", name,
                   "--publish", "127.0.0.1::7474", "--memory", "1g", "--cpus", "2",
                   "--env", "NEO4J_AUTH",
                   "--env", "NEO4J_server_memory_heap_initial__size=256m",
                   "--env", "NEO4J_server_memory_heap_max__size=512m",
                   "--env", "NEO4J_server_memory_pagecache_size=128m",
                   "--env", "NEO4J_dbms_usage__report_enabled=false",
                   "--env", "NEO4J_dbms_fleet__manager_enabled=false",
                   "--env", "NEO4J_server_fleet__discovery_enabled=false",
                   args.image, env=env, timeout=180)
        started = True
        env.pop("NEO4J_AUTH", None)
        port = int(run_docker("port", name, "7474/tcp").rsplit(":", 1)[1])
        client = QueryClient(port, password)
        del password
        ready_deadline = time.monotonic() + 180
        while True:
            try:
                client.query("RETURN 1 AS ready")
                break
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                if time.monotonic() > ready_deadline:
                    raise RuntimeError("Neo4j did not become ready in time") from None
                time.sleep(2)

        # Prove authentication is enabled, independently of the authenticated call.
        unauth = urllib.request.Request(client.url,
            data=b'{"statement":"RETURN 1 AS ready"}',
            headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(unauth, timeout=10):
                raise RuntimeError("Unauthenticated database access was unexpectedly allowed")
        except urllib.error.HTTPError as error:
            assert error.code == 401, "Unexpected authentication status"

        component = client.query("CALL dbms.components() YIELD name, versions, edition RETURN name, versions, edition")[0]
        client.query("CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE")
        client.query("CREATE CONSTRAINT source_id IF NOT EXISTS FOR (n:EvidenceSource) REQUIRE n.id IS UNIQUE")
        for kind, label in LABELS.items():
            items = [create_properties(n) for n in data["nodes"] if n["type"].lower() == kind]
            if items:
                client.query(f"UNWIND $items AS item CREATE (n:Entity:{label}) SET n = item", {"items": items})
        client.query("UNWIND $items AS item CREATE (s:EvidenceSource) SET s = item",
                     {"items": [create_properties(s) for s in data["sources"]]})
        for relationship in RELATIONSHIPS:
            items = [create_properties(x) for x in data["observations"] if x["type"] == relationship]
            if items:
                client.query("UNWIND $items AS item MATCH (a:Entity {id: item.source}), (b:Entity {id: item.target}) "
                             f"CREATE (a)-[r:{relationship}]->(b) SET r = item", {"items": items})

        exported_nodes = [json.loads(x["payload"]) for x in client.query(
            "MATCH (n:Entity) RETURN n.payload AS payload ORDER BY n.id")]
        exported_observations = [json.loads(x["payload"]) for x in client.query(
            "MATCH (:Entity)-[r]->(:Entity) RETURN r.payload AS payload ORDER BY r.id")]
        assert sorted(exported_nodes, key=lambda x: x["id"]) == sorted(data["nodes"], key=lambda x: x["id"])
        assert sorted(exported_observations, key=lambda x: x["id"]) == sorted(data["observations"], key=lambda x: x["id"])

        by_year = client.query("UNWIND $years AS y OPTIONAL MATCH (:Entity)-[r]->(:Entity) WHERE r.year = y "
            "RETURN y AS year, count(r) AS observations, collect(r.id) AS observationIds ORDER BY year",
            {"years": [x["year"] for x in data["years"]]})
        for year in by_year:
            expected = {x["id"] for x in data["observations"] if x["year"] == year["year"]}
            assert set(year["observationIds"]) == expected
            assert year["observations"] == len(expected)
        counts = client.query("MATCH (:Entity)-[r]->(:Entity) RETURN type(r) AS type, count(r) AS count ORDER BY type")
        assert {x["type"]: x["count"] for x in counts} == dict(Counter(x["type"] for x in data["observations"]))
        named_roles = client.query("MATCH (p:Person)-[r:HOLDS_ROLE]->(role:Role) "
            "RETURN p.id AS person, role.id AS role, r.year AS year ORDER BY year, person, role")
        image_digest = run_docker("image", "inspect", args.image, "--format", "{{index .RepoDigests 0}}")
        provenance = {
            "engine": component["name"], "version": component["versions"][0], "edition": component["edition"],
            "exportMode": "actual-neo4j-query-export", "liveConnection": False,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "datasetSHA256": dataset_hash, "imageDigest": image_digest,
            "nodesImported": len(exported_nodes), "observationsImported": len(exported_observations),
            "sourcesImported": len(data["sources"]), "yearsQueried": len(by_year),
            "queriesExecuted": client.calls, "relationshipCounts": counts,
            "roundTripVerified": True, "authenticationVerified": True,
            "note": "Εξαγωγή από πραγματική Neo4j. Η ιστοσελίδα διαβάζει αυτό το στιγμιότυπο, χωρίς ζωντανή σύνδεση στη βάση."
        }
        output = {**data, "nodes": exported_nodes, "observations": exported_observations, "provenance": provenance}
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes((json.dumps(output, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        report = {"passed": True, "provenance": provenance, "yearChecks": by_year,
                  "namedRoleQueryRows": len(named_roles), "outputSHA256": hashlib.sha256(args.output.read_bytes()).hexdigest()}
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_bytes((json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        print(json.dumps({"passed": True, "neo4j": provenance["version"], "nodes": len(exported_nodes),
                          "observations": len(exported_observations), "years": len(by_year)}, ensure_ascii=False))
    finally:
        env.pop("NEO4J_AUTH", None)
        if started:
            run_docker("stop", "--time", "15", name, timeout=45, check=False)
            # --rm removes this invocation's container and anonymous volumes.
            remaining = run_docker("ps", "--all", "--filter", "name=^/" + name + "$", "--format", "{{.Names}}")
            if remaining:
                raise RuntimeError("The owned Neo4j container still exists; manual cleanup is needed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--image", default=DEFAULT_IMAGE)
    args = parser.parse_args()
    try:
        build(args)
    except Exception as error:
        # Do not expose request headers, environment, subprocess output or locals.
        print("Neo4j build failed (" + type(error).__name__ + "). No credentials printed.")
        if isinstance(error, (RuntimeError, AssertionError)):
            print(str(error))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
