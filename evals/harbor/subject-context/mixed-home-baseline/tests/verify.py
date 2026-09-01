import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
state = result["finalState"]
subject = state["subjects"][0]
attributes = {str(key).lower(): str(value).lower() for key, value in subject.get("attributes", {}).items()}
context = (subject.get("agentContext") or "").lower()
events = json.dumps(state["events"]).lower()
maintenance = json.dumps(state["maintenance"]).lower()
roof_attributes = " ".join(value for key, value in attributes.items() if "roof" in key)

metrics = {
    "stable_configuration_saved": float(
        any("hvac" in key and "1" in value for key, value in attributes.items())
        and any("water" in key and "gas" in value for key, value in attributes.items())
    ),
    "roof_estimate_not_canonicalized": float(not roof_attributes),
    "roof_uncertainty_preserved": float("roof" in context and any(term in context for term in ["unconfirm", "estimate", "no record", "user reported", "user estimates"])),
    "winter_leak_recorded_as_evidence": float("faucet" in events and ("winter" in events or "cold" in events)),
    "unresolved_leak_kept_actionable": float("faucet" in maintenance and ("winter" in maintenance or "freeze" in maintenance)),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "result": result}, indent=2))
