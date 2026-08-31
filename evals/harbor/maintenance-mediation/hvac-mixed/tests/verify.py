import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
initial = result["initialState"]
state = result["finalState"]
items = state["maintenance"]
tools = turn["tools"]

researched = any(tool["tool"] == "web__run" and tool["status"] == "complete" for tool in tools)
all_attached = bool(items) and all(item["thingId"] == initial["things"][0]["id"] for item in items)
useful_plan_size = 2 <= len(items) <= 4
titles = [item["title"].lower() for item in items]
owner_filter_action = any("filter" in title for title in titles)
professional_bundle = any(any(term in title for term in ["professional", "seasonal", "service", "tune-up", "tuneup"]) for title in titles)
fragmented_professional_work = sum(any(term in title for term in [
    "refrigerant", "electrical", "coil", "blower", "capacitor", "condensate", "defrost"
]) for title in titles) > 1
source_retained = any(item.get("data", {}).get("source") for item in items)
no_unrelated_mutation = not state["events"] and state["things"] == initial["things"]

metrics = {
    "researched": float(researched),
    "useful_plan_size": float(useful_plan_size),
    "owner_filter_action": float(owner_filter_action),
    "professional_work_bundled": float(professional_bundle and not fragmented_professional_work),
    "attached_to_supplied_thing": float(all_attached),
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
