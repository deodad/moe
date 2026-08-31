import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
state = result["finalState"]
output = turn["output"].lower()
asks_which = "?" in turn["output"] and any(term in output for term in ["which", "v12", "v15", "upstairs", "downstairs"])
metrics = {
    "asks_for_material_identity": float(asks_which),
    "no_mutation_before_resolution": float(state == result["initialState"]),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "output": turn["output"], "tools": turn["tools"]}, indent=2))
