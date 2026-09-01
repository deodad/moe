import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
active = state["subjects"]
mieles = [subject for subject in active if "miele" in json.dumps(subject).lower()]
bosches = [subject for subject in active if "bosch" in json.dumps(subject).lower()]
pump_events = [event for event in state["events"] if "pump" in event["summary"].lower()]
metrics = {
    "replacement_created": float(len(mieles) == 1),
    "replaced_subject_archived": float(not bosches and len(active) == 1),
    "prior_history_preserved": float(len(pump_events) == 1),
    "replacement_not_rename": float(bool(mieles) and len(pump_events) == 1 and pump_events[0]["subjectId"] != mieles[0]["id"]),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state, "tools": result["turns"][0]["tools"]}, indent=2))
