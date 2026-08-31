import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
dysons = [thing for thing in state["things"] if "dyson" in json.dumps(thing).lower()]
thing = dysons[0] if len(dysons) == 1 else None
identity = json.dumps(thing).lower() if thing else ""
metrics = {
    "duplicates_merged": float(len(dysons) == 1),
    "agent_selected_identity_preserved": float(bool(thing) and "v12" in identity and "costco" in identity),
    "care_preference_preserved": float(bool(thing) and "group" in (thing.get("carePreferences") or "").lower()),
    "history_moved_to_survivor": float(bool(thing) and len(state["events"]) == 1 and state["events"][0]["thingId"] == thing["id"]),
    "maintenance_moved_to_survivor": float(bool(thing) and len(state["maintenance"]) == 1 and state["maintenance"][0]["thingId"] == thing["id"]),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state, "tools": result["turns"][0]["tools"]}, indent=2))
