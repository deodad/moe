import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
state = result["finalState"]
vacuum = next((subject for subject in state["subjects"] if "vacuum" in subject["name"].lower()), None)
bin_items = [item for item in state["maintenance"] if "bin" in item["title"].lower() or "empty" in item["title"].lower()]
output = turn["output"].lower()
model_probe = any(phrase in output for phrase in ["what model", "which model", "model number", "check the label"])

metrics = {
    "model_insensitive_action_completed": float(vacuum is not None and len(bin_items) == 1 and bin_items[0]["subjectId"] == vacuum["id"]),
    "no_unnecessary_model_probe": float(not model_probe),
    "no_duplicate_created": float(len(state["subjects"]) == 1),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "output": turn["output"], "finalState": state}, indent=2))
