import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
items = state["maintenance"]
tool_arguments = [tool.get("arguments", {}) for tool in result["turns"][0]["tools"]]
matching = [item for item in items if "18,000" in json.dumps(item) or "18000" in json.dumps(item)]
condition = matching[0].get("due", {}).get("condition", "").lower() if matching else ""
metrics = {
    "one_useful_item_created": float(len(matching) == 1),
    "mileage_and_time_condition_preserved": float("18" in condition and "month" in condition and ("mile" in condition or "18,000" in condition)),
    "unsupported_due_date_not_created": float(bool(matching) and not matching[0].get("due", {}).get("date")),
    "no_bucket_sent_as_schedule": float(all("timing" not in arguments for arguments in tool_arguments)),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
