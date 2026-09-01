import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
state = result["finalState"]
output = turn["output"].lower()
clarifies_conflict = "?" in turn["output"] and any(term in output for term in ["2019", "2020", "another", "same", "correct"])

metrics = {
    "identity_conflict_clarified": float(clarifies_conflict),
    "no_history_recorded_before_resolution": float(not state["events"]),
    "no_identity_mutation_before_resolution": float(state["subjects"] == result["initialState"]["subjects"]),
    "no_duplicate_created": float(len(state["subjects"]) == 1),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "output": turn["output"], "finalState": state}, indent=2))
