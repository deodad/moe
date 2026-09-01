import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
first_state = result["turns"][0]["state"]
final_state = result["finalState"]

first_dysons = [subject for subject in first_state["subjects"] if "dyson" in subject["name"].lower()]
final_dysons = [
    subject
    for subject in final_state["subjects"]
    if "dyson" in subject["name"].lower() or "v15" in json.dumps(subject["attributes"]).lower()
]
preference = (final_dysons[0].get("carePreferences") or "").lower() if len(final_dysons) == 1 else ""

metrics = {
    "no_persistence_before_confirmation": float(not first_dysons),
    "confirmed_identity_persisted": float(
        len(final_dysons) == 1 and "v15" in json.dumps(final_dysons[0]).lower()
    ),
    "care_preference_persisted": float(
        bool(preference) and any(word in preference for word in ["group", "simple"])
    ),
    "uncertainty_not_in_preference": float(
        bool(preference)
        and not any(phrase in preference for phrase in ["green light", "uncertain", "unknown", "maybe"])
    ),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({"metrics": metrics, "preference": preference}, indent=2))
