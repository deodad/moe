import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
vacuums = [subject for subject in state["subjects"] if "v15" in json.dumps(subject).lower()]
upstairs = next((subject for subject in vacuums if "upstairs" in json.dumps(subject).lower()), None)
downstairs = next((subject for subject in vacuums if "downstairs" in json.dumps(subject).lower()), None)
june = next((event for event in state["events"] if "filter" in event["summary"].lower()), None)
july = next((event for event in state["events"] if "brush" in event["summary"].lower()), None)
metrics = {
    "two_distinct_subjects_created": float(len(vacuums) == 2 and upstairs is not None and downstairs is not None),
    "supported_history_reassigned": float(bool(upstairs) and bool(downstairs) and bool(june) and bool(july) and june["subjectId"] == upstairs["id"] and july["subjectId"] == downstairs["id"]),
    "history_preserved": float(len(state["events"]) == 2),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state, "tools": result["turns"][0]["tools"]}, indent=2))
