import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
initial = result["initialState"]
state = result["finalState"]
items = state["maintenance"]
tools = turn["tools"]

researched = any(tool["tool"] == "web__run" and tool["status"] == "complete" for tool in tools)
all_attached = bool(items) and all(item["subjectId"] == initial["subjects"][0]["id"] for item in items)
low_maintenance_plan = 1 <= len(items) <= 3
serialized = json.dumps(items).lower()
routine_cleaning = "clean" in serialized and any(term in serialized for term in ["burr", "grind chamber", "hopper"])
speculative_replacements = sum(any(term in item["title"].lower() for term in [
    "replace burr", "replace motor", "replace gearbox", "replace paddle wheel"
]) for item in items)
replacements_remain_conditional = speculative_replacements == 0
source_retained = any(item.get("data", {}).get("source") for item in items)
no_unrelated_mutation = not state["events"] and state["subjects"] == initial["subjects"]

metrics = {
    "researched": float(researched),
    "low_maintenance_plan": float(low_maintenance_plan),
    "routine_cleaning_captured": float(routine_cleaning),
    "replacements_remain_conditional": float(replacements_remain_conditional),
    "attached_to_supplied_subject": float(all_attached),
    "source_retained": float(source_retained),
    "no_unrelated_mutation": float(no_unrelated_mutation),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({
    "metrics": metrics,
    "output": turn["output"],
    "tools": tools,
    "maintenance": items,
}, indent=2))
