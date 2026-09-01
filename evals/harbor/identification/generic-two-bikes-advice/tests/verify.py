import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
state = result["finalState"]
output = turn["output"].lower()
identity_probe = "?" in turn["output"] and any(term in output for term in ["which bike", "road bike", "mountain bike"])
mutation_tools = {"create_subject", "update_subject", "record_event", "create_maintenance", "update_maintenance"}
called = {activity["tool"] for activity in turn["tools"]}
metrics = {
    "no_unnecessary_identity_probe": float(not identity_probe),
    "no_durable_mutation": float(not (called & mutation_tools) and state == result["initialState"]),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "output": turn["output"], "tools": turn["tools"]}, indent=2))
