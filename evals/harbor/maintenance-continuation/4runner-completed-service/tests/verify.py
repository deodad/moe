import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
initial = result["initialState"]
state = result["finalState"]
tools = turn["tools"]
subject_id = initial["subjects"][0]["id"]
initial_item_id = initial["maintenance"][0]["id"]

completion_calls = [tool for tool in tools if (
    tool["tool"] == "update_maintenance"
    and tool["status"] == "complete"
    and tool.get("arguments", {}).get("id") == initial_item_id
    and tool.get("arguments", {}).get("status") == "done"
)]
completed_with_update = len(completion_calls) == 1
planned_item_preserved = completed_with_update and completion_calls[0].get("result", {}).get("data") == initial["maintenance"][0]["data"] and completion_calls[0].get("result", {}).get("rationale") == initial["maintenance"][0]["rationale"]
service_events = [event for event in state["events"] if event["subjectId"] == subject_id and any(
    term in event["summary"].lower() for term in ["5,000", "5000", "service"]
)]
completion_recorded_once = len(service_events) == 1
completion_history = json.dumps(service_events).lower()
completion_details_retained = "5,120" in completion_history and "toyota" in completion_history

active = [item for item in state["maintenance"] if item["subjectId"] == subject_id]
next_items = [item for item in active if any(term in item["title"].lower() for term in ["10,000", "10000", "10k"])]
next_interval_created = len(next_items) == 1
shop_granularity_preserved = bool(next_items) and any(
    term in next_items[0]["title"].lower() for term in ["service", "visit", "maintenance"]
)
completed_item_not_active = all(item["id"] != initial_item_id for item in active)
subject_not_duplicated = len(state["subjects"]) == 1
subject_does_not_mirror_mileage = not any(
    "mileage" in key.lower() or "odometer" in key.lower()
    for key in state["subjects"][0].get("attributes", {})
)

metrics = {
    "completed_with_update_maintenance": float(completed_with_update),
    "planned_item_preserved": float(planned_item_preserved),
    "completion_recorded_once": float(completion_recorded_once),
    "completion_details_retained_in_history": float(completion_details_retained),
    "next_interval_created_once": float(next_interval_created),
    "shop_granularity_preserved": float(shop_granularity_preserved),
    "completed_item_removed_from_attention": float(completed_item_not_active),
    "subject_not_duplicated": float(subject_not_duplicated),
    "subject_does_not_mirror_mileage": float(subject_does_not_mirror_mileage),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({
    "metrics": metrics,
    "output": turn["output"],
    "tools": tools,
    "events": state["events"],
    "maintenance": state["maintenance"],
    "subjects": state["subjects"],
}, indent=2))
