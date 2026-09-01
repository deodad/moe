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
low_noise_plan = 1 <= len(items) <= 3

serialized = json.dumps(items).lower()
filter_care = "filter" in serialized and any(term in serialized for term in ["wash", "clean", "month"])
source_retained = any(item.get("data", {}).get("source") for item in items)
speculative_titles = sum(any(term in item["title"].lower() for term in [
    "replace motor", "replace battery", "repair blockage", "fix suction", "replace cyclone"
]) for item in items)
no_speculative_failure_tasks = speculative_titles == 0
no_unrelated_mutation = not state["events"] and state["subjects"] == initial["subjects"]

metrics = {
    "researched": float(researched),
    "low_noise_plan": float(low_noise_plan),
    "manufacturer_filter_care_captured": float(filter_care),
    "no_speculative_failure_tasks": float(no_speculative_failure_tasks),
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
