import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
state = turn["state"]
output = turn["output"].lower()

dyson_subjects = [subject for subject in state["subjects"] if "dyson" in subject["name"].lower()]
dyson_ids = {subject["id"] for subject in dyson_subjects}
dyson_maintenance = [item for item in state["maintenance"] if item["subjectId"] in dyson_ids]
identification_detail = any(word in output for word in ["model", "number", "label", "which"])
identification_request = "?" in turn["output"] or any(
    phrase in output for phrase in ["please send", "send me", "tell me", "can you share"]
)

metrics = {
    "no_persistence_before_identification": float(not dyson_subjects and not dyson_maintenance),
    "requests_identification_evidence": float(identification_detail and identification_request),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "output": turn["output"]}, indent=2))
