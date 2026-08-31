import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
dysons = [thing for thing in state["things"] if "dyson" in json.dumps(thing).lower()]
identity = json.dumps(dysons[0]).lower() if len(dysons) == 1 else ""

metrics = {
    "corrected_identity_persisted": float(len(dysons) == 1 and "v12" in identity and "detect slim" in identity),
    "stale_identity_removed": float(bool(identity) and "v15" not in identity),
    "no_duplicate_created": float(len(state["things"]) == 1),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "finalState": state}, indent=2))
