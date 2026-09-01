import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
initial = result["initialState"]
state = result["finalState"]
tools = turn["tools"]
thing = state["things"][0]
thing_id = thing["id"]
items = [item for item in state["maintenance"] if item["thingId"] == thing_id]
initial_ids = {item["id"] for item in initial["maintenance"]}
final_ids = {item["id"] for item in items}

preference = (thing.get("carePreferences") or "").lower()
preference_updated = (
    any(term in preference for term in ["few", "low-noise", "minimal"])
    and any(term in preference for term in ["condition", "evidence", "symptom"])
)
low_noise_plan = 1 <= len(items) <= 2
serialized = json.dumps(items).lower()
useful_filter_care = "filter" in serialized and any(term in serialized for term in ["wash", "clean"])
no_speculative_work = not any(
    term in " ".join(item["title"].lower() for item in items)
    for term in ["replace the battery", "check for blockages", "replace motor", "repair"]
)
source_retained = bool(items) and any(item.get("data", {}).get("source") for item in items)

archived_ids = {
    tool.get("arguments", {}).get("id")
    for tool in tools
    if tool["tool"] == "update_maintenance"
    and tool["status"] == "complete"
    and tool.get("arguments", {}).get("status") == "archived"
}
retired_ids = initial_ids - final_ids
obsolete_items_retired = len(retired_ids) >= 3 and retired_ids <= archived_ids
no_fake_completion = (
    state["events"] == initial["events"]
    and not any(
        tool["tool"] == "update_maintenance"
        and tool.get("arguments", {}).get("status") == "done"
        for tool in tools
    )
)
thing_not_duplicated = len(state["things"]) == 1

metrics = {
    "care_preference_updated": float(preference_updated),
    "low_noise_plan": float(low_noise_plan),
    "useful_filter_care_retained": float(useful_filter_care),
    "no_speculative_work_left_active": float(no_speculative_work),
    "obsolete_items_retired": float(obsolete_items_retired),
    "no_fake_completion_history": float(no_fake_completion),
    "source_context_retained": float(source_retained),
    "thing_not_duplicated": float(thing_not_duplicated),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({
    "metrics": metrics,
    "output": turn["output"],
    "tools": tools,
    "maintenance": items,
    "things": state["things"],
    "events": state["events"],
}, indent=2))
