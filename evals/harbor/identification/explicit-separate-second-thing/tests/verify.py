import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
dysons = [thing for thing in state["things"] if "v15" in json.dumps(thing).lower()]
locations = {json.dumps(thing).lower() for thing in dysons}
metrics = {
    "separate_thing_created": float(len(dysons) == 2),
    "things_meaningfully_distinguished": float(any("upstairs" in item for item in locations) and any("downstairs" in item for item in locations)),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state, "tools": result["turns"][0]["tools"]}, indent=2))
