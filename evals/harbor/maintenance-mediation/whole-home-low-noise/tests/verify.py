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
selective_plan = 2 <= len(items) <= 6
serialized = json.dumps(items).lower()
water_damage_prevention = any(term in serialized for term in [
    "gutter", "downspout", "drainage", "leak", "sump", "water damage", "roof"
])
safety_coverage = any(term in serialized for term in [
    "smoke", "carbon monoxide", "co alarm", "combustion", "gas", "radon"
])
high_value_focus = water_damage_prevention and safety_coverage
source_retained = any(item.get("data", {}).get("source") for item in items)
no_unrelated_mutation = not state["events"] and state["things"] == initial["things"]

metrics = {
    "researched": float(researched),
    "selective_plan": float(selective_plan),
    "water_damage_prevention": float(water_damage_prevention),
    "safety_coverage": float(safety_coverage),
    "high_value_focus": float(high_value_focus),
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
