import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
state = result["finalState"]
output = turn["output"].lower()
asks_which = "?" in turn["output"] and any(term in output for term in ["which", "road", "mountain"])

metrics = {
    "asks_which_existing_thing": float(asks_which),
    "no_ambiguous_history_recorded": float(not state["events"]),
    "no_ambiguous_maintenance_created": float(not state["maintenance"]),
    "no_duplicate_created": float(len(state["things"]) == 2),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "output": turn["output"], "finalState": state}, indent=2))
