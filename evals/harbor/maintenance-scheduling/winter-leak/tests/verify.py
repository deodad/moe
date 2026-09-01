import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
items = result["finalState"]["maintenance"]
matching = [item for item in items if any(term in json.dumps(item).lower() for term in ["freeze", "winter"])]
condition = matching[0].get("due", {}).get("condition", "").lower() if matching else ""
metrics = {
    "seasonal_item_created": float(len(matching) == 1),
    "winter_condition_preserved": float("freeze" in condition or "winter" in condition),
    "unsupported_due_date_not_created": float(bool(matching) and not matching[0].get("due", {}).get("date")),
    "honest_attention_state": float(bool(matching) and matching[0].get("timing") in ["later", "watching"]),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
