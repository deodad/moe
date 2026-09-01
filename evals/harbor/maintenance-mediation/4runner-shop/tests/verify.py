import json
from pathlib import Path

result = json.loads(Path("/app/eval-result.json").read_text())
turn = result["turns"][0]
initial = result["initialState"]
state = result["finalState"]
items = state["maintenance"]
tools = turn["tools"]

researched = any(tool["tool"] == "web__run" and tool["status"] == "complete" for tool in tools)
web_calls = [tool for tool in tools if tool["tool"] == "web__run" and tool["status"] == "complete"]

def serialized_call(tool):
    return json.dumps({
        "arguments": tool.get("arguments"),
        "result": tool.get("result"),
    }).lower()

official_schedule_discovered = any(
    "toyota 2026 4runner warranty and maintenance guide" in serialized_call(tool)
    and "toyota.com" in serialized_call(tool)
    for tool in web_calls
)
official_pdf_attempted = any(
    tool.get("arguments", {}).get("open")
    and "t-mms-264runner.pdf" in json.dumps(tool.get("arguments")).lower()
    and "toyota.com" in json.dumps(tool.get("arguments")).lower()
    for tool in web_calls
)
manufacturer_schedule_opened = any(
    tool.get("arguments", {}).get("open")
    and "t-mms-264runner.pdf" in serialized_call(tool)
    and "toyota.com" in serialized_call(tool)
    and "content type: application/pdf" in serialized_call(tool)
    for tool in web_calls
)
mirror_schedule_opened = any(
    tool.get("arguments", {}).get("open")
    and "content type: application/pdf" in serialized_call(tool)
    and any(domain in serialized_call(tool) for domain in ["manuals.plus", "device.report"])
    for tool in web_calls
)
all_attached = bool(items) and all(item["subjectId"] == initial["subjects"][0]["id"] for item in items)
small_plan = 1 <= len(items) <= 4

serialized = json.dumps(items).lower()
titles = " ".join(item["title"].lower() for item in items)
service_title = any(term in titles for term in ["service", "scheduled maintenance", "maintenance visit"])
underlying_work = sum(term in serialized for term in ["oil", "tire", "brake", "filter", "fluid", "inspect"])
composite_granularity = service_title and underlying_work >= 2
source_retained = any(item.get("data", {}).get("source") for item in items)
has_timing_basis = any(term in serialized for term in ["mile", "month", "year", "interval"])
no_unrelated_mutation = state["events"] == initial["events"] and state["subjects"] == initial["subjects"]
withheld_without_primary = manufacturer_schedule_opened or not items

metrics = {
    "researched": float(researched),
    "official_schedule_discovered": float(official_schedule_discovered),
    "official_pdf_attempted": float(official_pdf_attempted),
    "manufacturer_schedule_opened": float(manufacturer_schedule_opened),
    "withheld_without_primary": float(withheld_without_primary),
    "small_plan": float(small_plan),
    "composite_shop_granularity": float(composite_granularity),
    "attached_to_supplied_subject": float(all_attached),
    "source_retained": float(source_retained),
    "timing_basis_retained": float(has_timing_basis),
    "no_unrelated_mutation": float(no_unrelated_mutation),
}
Path("/logs/verifier/reward.json").write_text(json.dumps(metrics))
Path("/logs/verifier/details.json").write_text(json.dumps({
    "metrics": metrics,
    "output": turn["output"],
    "tools": tools,
    "maintenance": items,
    "research_diagnostics": {
        "official_schedule_discovered": official_schedule_discovered,
        "official_pdf_attempted": official_pdf_attempted,
        "official_pdf_opened": manufacturer_schedule_opened,
        "mirror_pdf_opened": mirror_schedule_opened,
        "persisted_item_count": len(items),
        "withheld_without_primary": withheld_without_primary,
    },
}, indent=2))
