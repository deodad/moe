import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
tools = [activity["tool"] for activity in result["turns"][0]["tools"]]

metrics = {
    "no_ownership_inferred": float(not state["things"]),
    "no_maintenance_persisted": float(not state["maintenance"]),
    "create_thing_not_called": float("create_thing" not in tools),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "tools": tools, "finalState": state}, indent=2))
