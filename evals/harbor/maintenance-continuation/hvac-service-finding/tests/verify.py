import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
initial = result["initialState"]
state = result["finalState"]
tools = turn["tools"]
subject_id = initial["subjects"][0]["id"]
initial_by_title = {item["title"]: item for item in initial["maintenance"]}
fall = initial_by_title["Fall heat-pump professional service visit"]
filter_item = initial_by_title["Replace 16x20x1 disposable pleated filter"]
spring = initial_by_title["Spring heat-pump professional service visit"]

fall_completion_calls = [tool for tool in tools if (
    tool["tool"] == "update_maintenance"
    and tool["status"] == "complete"
    and tool.get("arguments", {}).get("id") == fall["id"]
    and tool.get("arguments", {}).get("status") == "done"
)]
fall_completed = len(fall_completion_calls) == 1
planned_item_preserved = fall_completed and fall_completion_calls[0].get("result", {}).get("data") == fall["data"] and fall_completion_calls[0].get("result", {}).get("rationale") == fall["rationale"]
active = [item for item in state["maintenance"] if item["subjectId"] == subject_id]
active_ids = {item["id"] for item in active}
existing_plan_preserved = filter_item["id"] in active_ids and spring["id"] in active_ids
no_existing_duplicates = sum("filter" in item["title"].lower() for item in active) == 1 and sum(
    "spring" in item["title"].lower() for item in active
) == 1

capacitor_items = [item for item in active if "capacitor" in json.dumps(item).lower()]
condition_followup_created = len(capacitor_items) == 1
followup_before_cooling = bool(capacitor_items) and any(term in json.dumps(capacitor_items[0]).lower() for term in [
    "cooling", "spring", "before summer"
])
service_events = [event for event in state["events"] if event["subjectId"] == subject_id and "fall" in event["summary"].lower() and "service" in event["summary"].lower()]
completion_recorded_once = len(service_events) == 1
service_history = json.dumps(service_events).lower()
finding_retained_in_history = "capacitor" in service_history and "weak" in service_history
fall_not_active = fall["id"] not in active_ids

metrics = {
    "fall_service_completed": float(fall_completed),
    "planned_item_preserved": float(planned_item_preserved),
    "completion_recorded_once": float(completion_recorded_once),
    "service_finding_retained_in_history": float(finding_retained_in_history),
    "condition_followup_created_once": float(condition_followup_created),
    "followup_timed_before_cooling": float(followup_before_cooling),
    "existing_plan_preserved": float(existing_plan_preserved),
    "no_existing_item_duplicates": float(no_existing_duplicates),
    "completed_service_removed_from_attention": float(fall_not_active),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({
    "metrics": metrics,
    "output": turn["output"],
    "tools": tools,
    "events": state["events"],
    "maintenance": state["maintenance"],
}, indent=2))
