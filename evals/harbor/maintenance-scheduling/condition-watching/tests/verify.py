import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
items = result["finalState"]["maintenance"]
matching = [item for item in items if "4/32" in json.dumps(item)]
item = matching[0] if matching else {}
metrics = {
    "one_condition_item_created": float(len(matching) == 1),
    "threshold_preserved": float("4/32" in item.get("due", {}).get("condition", "")),
    "due_date_not_invented": float(not item.get("due", {}).get("date")),
    "no_unwanted_check_reminder": float(not item.get("checkOn")),
    "derived_as_watching": float(item.get("timing") == "watching"),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
