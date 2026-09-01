import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
initial = result["initialState"]["maintenance"][0]
items = result["finalState"]["maintenance"]
item = next((entry for entry in items if entry["id"] == initial["id"]), {})
metrics = {
    "same_item_updated": float(bool(item)),
    "condition_unchanged": float(item.get("due", {}).get("condition") == initial.get("due", {}).get("condition")),
    "due_date_not_invented": float(not item.get("due", {}).get("date")),
    "check_on_updated": float(item.get("checkOn") == "2026-12-01"),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
