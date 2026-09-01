import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
subject = result["finalState"]["subjects"][0]
context = (subject.get("agentContext") or "").lower()
preferences = (subject.get("carePreferences") or "").lower()
attributes = json.dumps(subject.get("attributes", {})).lower()

metrics = {
    "confirmed_preference_saved": float("safety" in preferences and "reliability" in preferences and "cosmetic" in preferences),
    "confirmed_preference_not_still_tentative": float(
        any(term in context for term in ["user confirmed", "user wants"])
        and "safety" in context
        and "reliability" in context
    ),
    "four_wheel_drive_saved": float("4wd" in attributes or "four-wheel" in attributes or "four wheel" in attributes),
    "answered_question_removed": float(not any(term in context for term in ["4wd remains unknown", "whether the truck is 4wd", "4wd is unknown"])),
    "unrelated_context_preserved": float("access cab" in context and "unconfirm" in context),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
