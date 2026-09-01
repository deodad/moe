import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
initial = result["initialState"]
state = result["finalState"]
tools = turn["tools"]
subject = state["subjects"][0]
subject_id = subject["id"]
items = [item for item in state["maintenance"] if item["subjectId"] == subject_id]
initial_ids = {item["id"] for item in initial["maintenance"]}
final_ids = {item["id"] for item in items}

preference = (subject.get("carePreferences") or "").lower()
preference_updated = (
    any(term in preference for term in ["toyota", "shop", "dealer"])
    and any(term in preference for term in ["visit", "service interval", "group", "composite"])
)

serialized = json.dumps(items).lower()
titles = " ".join(item["title"].lower() for item in items)
composite_plan = (
    1 <= len(items) <= 3
    and any(term in titles for term in ["service", "visit", "scheduled maintenance"])
    and sum(term in serialized for term in ["tire", "brake", "oil", "filter"]) >= 2
)
no_granular_items = not any(
    item["title"].lower().startswith(("rotate ", "inspect ", "change engine", "replace cabin"))
    for item in items
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
obsolete_items_retired = bool(retired_ids) and retired_ids <= archived_ids
no_fake_completion = (
    state["events"] == initial["events"]
    and not any(
        tool["tool"] == "update_maintenance"
        and tool.get("arguments", {}).get("status") == "done"
        for tool in tools
    )
)
subject_not_duplicated = len(state["subjects"]) == 1

metrics = {
    "care_preference_updated": float(preference_updated),
    "composite_shop_plan": float(composite_plan),
    "no_granular_items_left_active": float(no_granular_items),
    "obsolete_items_retired": float(obsolete_items_retired),
    "no_fake_completion_history": float(no_fake_completion),
    "source_context_retained": float(source_retained),
    "subject_not_duplicated": float(subject_not_duplicated),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({
    "metrics": metrics,
    "output": turn["output"],
    "tools": tools,
    "maintenance": items,
    "subjects": state["subjects"],
    "events": state["events"],
}, indent=2))
