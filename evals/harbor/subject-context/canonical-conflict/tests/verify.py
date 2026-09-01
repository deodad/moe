import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
subject = result["finalState"]["subjects"][0]
context = (subject.get("agentContext") or "").lower()
output = " ".join(turn.get("output", "") or "" for turn in result["turns"]).lower()
tools = [tool.get("tool") for turn in result["turns"] for tool in turn.get("tools", [])]

metrics = {
    "canonical_evidence_loaded": float("get_subject" in tools or "get_history" in tools),
    "answer_uses_replacement_event": float("2021" in output and not any(term in output for term in ["probably original", "likely original"])),
    "stale_original_inference_removed": float("original" not in context or any(term in context for term in ["not original", "superseded", "incorrect"])),
    "context_reflects_canonical_evidence": float("2021" in context and any(term in context for term in ["invoice", "replaced", "replacement"])),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
