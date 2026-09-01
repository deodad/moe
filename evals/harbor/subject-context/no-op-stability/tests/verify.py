import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
initial_subject = result["initialState"]["subjects"][0]
final_subject = result["finalState"]["subjects"][0]
turn = result["turns"][-1]
output = (turn.get("output") or "").lower()
tools = [tool.get("tool") for tool in turn.get("tools", [])]

metrics = {
    "canonical_evidence_loaded": float("get_subject" in tools or "get_history" in tools),
    "recorded_mileage_answered": float("64,180" in output or "64180" in output),
    "no_unnecessary_context_write": float("update_subject" not in tools),
    "context_remains_unchanged": float(final_subject.get("agentContext") == initial_subject.get("agentContext")),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
