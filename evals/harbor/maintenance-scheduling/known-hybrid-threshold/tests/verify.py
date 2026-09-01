import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
items = result["finalState"]["maintenance"]
matching = [item for item in items if "18,000" in json.dumps(item) or "18000" in json.dumps(item)]
item = matching[0] if matching else {}
condition = item.get("due", {}).get("condition", "").lower()
metrics = {
    "one_useful_item_created": float(len(matching) == 1),
    "supported_time_date_calculated": float(item.get("due", {}).get("date") == "2027-01-15"),
    "mileage_alternative_preserved": float("mile" in condition and ("18,000" in condition or "18000" in condition)),
    "whichever_first_semantics_preserved": float(any(term in condition for term in ["whichever", "first", "before"])),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
