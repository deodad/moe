import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
dysons = [subject for subject in state["subjects"] if "dyson" in json.dumps(subject).lower()]
subject = dysons[0] if len(dysons) == 1 else None
identity = json.dumps(subject).lower() if subject else ""
metrics = {
    "duplicates_merged": float(len(dysons) == 1),
    "agent_selected_identity_preserved": float(bool(subject) and "v12" in identity and "costco" in identity),
    "care_preference_preserved": float(bool(subject) and "group" in (subject.get("carePreferences") or "").lower()),
    "history_moved_to_survivor": float(bool(subject) and len(state["events"]) == 1 and state["events"][0]["subjectId"] == subject["id"]),
    "maintenance_moved_to_survivor": float(bool(subject) and len(state["maintenance"]) == 1 and state["maintenance"][0]["subjectId"] == subject["id"]),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state, "tools": result["turns"][0]["tools"]}, indent=2))
