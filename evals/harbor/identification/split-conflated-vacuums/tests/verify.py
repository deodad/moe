import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
vacuums = [thing for thing in state["things"] if "v15" in json.dumps(thing).lower()]
upstairs = next((thing for thing in vacuums if "upstairs" in json.dumps(thing).lower()), None)
downstairs = next((thing for thing in vacuums if "downstairs" in json.dumps(thing).lower()), None)
june = next((event for event in state["events"] if "filter" in event["summary"].lower()), None)
july = next((event for event in state["events"] if "brush" in event["summary"].lower()), None)
metrics = {
    "two_distinct_things_created": float(len(vacuums) == 2 and upstairs is not None and downstairs is not None),
    "supported_history_reassigned": float(bool(upstairs) and bool(downstairs) and bool(june) and bool(july) and june["thingId"] == upstairs["id"] and july["thingId"] == downstairs["id"]),
    "history_preserved": float(len(state["events"]) == 2),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state, "tools": result["turns"][0]["tools"]}, indent=2))
