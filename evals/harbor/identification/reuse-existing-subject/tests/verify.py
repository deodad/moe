import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
subjects = [subject for subject in state["subjects"] if "4runner" in json.dumps(subject).lower()]
subject_id = subjects[0]["id"] if len(subjects) == 1 else None
oil_events = [event for event in state["events"] if "oil" in event["summary"].lower()]

metrics = {
    "existing_subject_reused": float(len(subjects) == 1),
    "history_attached_to_existing_subject": float(bool(subject_id) and len(oil_events) == 1 and oil_events[0]["subjectId"] == subject_id),
    "no_duplicate_created": float(len(state["subjects"]) == 1),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state}, indent=2))
