import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
things = [thing for thing in state["things"] if "4runner" in json.dumps(thing).lower()]
thing_id = things[0]["id"] if len(things) == 1 else None
oil_events = [event for event in state["events"] if "oil" in event["summary"].lower()]

metrics = {
    "existing_thing_reused": float(len(things) == 1),
    "history_attached_to_existing_thing": float(bool(thing_id) and len(oil_events) == 1 and oil_events[0]["thingId"] == thing_id),
    "no_duplicate_created": float(len(state["things"]) == 1),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state}, indent=2))
