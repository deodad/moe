import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
subject = state["subjects"][0]
context = (subject.get("agentContext") or "").lower()
attributes = json.dumps(subject.get("attributes", {})).lower()
preferences = (subject.get("carePreferences") or "").lower()
events = json.dumps(state["events"]).lower()
cab_clue_preserved = (
    "access cab" in context
    or "half-door" in context
    or "half door" in context
    or "smaller rear" in context
)
cab_uncertain = any(term in context for term in ["unconfirmed", "not confirmed", "unknown", "suggest"])

metrics = {
    "mileage_recorded_as_event": float("150" in events and any(term in events for term in ["mile", "odometer"])),
    "tpms_condition_recorded": float("tpms" in events or "tire-pressure" in events or "tire pressure" in events),
    "colloquial_context_preserved": float("old beater" in context),
    "cab_clue_is_tentative": float(cab_clue_preserved and cab_uncertain),
    "identity_clue_not_promoted": float("access cab" not in attributes),
    "care_inference_not_promoted": float(not preferences or not any(term in preferences for term in ["cosmetic", "essential", "reliability only"])),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
