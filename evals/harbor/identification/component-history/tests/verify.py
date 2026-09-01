import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
runner = next((subject for subject in state["subjects"] if "4runner" in json.dumps(subject).lower()), None)
battery_events = [event for event in state["events"] if "battery" in event["summary"].lower()]
battery_subjects = [subject for subject in state["subjects"] if "battery" in subject["name"].lower()]

metrics = {
    "component_history_attached_to_parent": float(runner is not None and len(battery_events) == 1 and battery_events[0]["subjectId"] == runner["id"]),
    "component_not_promoted_to_subject": float(not battery_subjects),
    "no_duplicate_parent_created": float(len(state["subjects"]) == 1),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state}, indent=2))
