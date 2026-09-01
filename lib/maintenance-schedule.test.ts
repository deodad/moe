import { describe, expect, it } from "vitest";
import { addMonths, friendlyDueDate, timingForDate } from "@/lib/maintenance-schedule";

describe("maintenance scheduling", () => {
  it("derives attention buckets from calendar dates", () => {
    expect(timingForDate("2026-08-30", "2026-08-31")).toBe("overdue");
    expect(timingForDate("2026-09-04", "2026-08-31")).toBe("this_week");
    expect(timingForDate("2026-09-21", "2026-09-01")).toBe("this_month");
    expect(timingForDate("2026-12-01", "2026-09-01")).toBe("later");
  });

  it("shows friendly relative labels without losing the stored date", () => {
    expect(friendlyDueDate("2026-09-04", "2026-08-31")).toBe("This week");
    expect(friendlyDueDate("2026-09-08", "2026-08-31")).toBe("Next week");
    expect(friendlyDueDate("2026-09-22", "2026-08-31")).toBe("3 weeks");
    expect(friendlyDueDate("2026-12-01", "2026-08-31")).toBe("3 months");
    expect(friendlyDueDate("2027-09-01", "2026-08-31")).toBe("Next year");
  });

  it("reschedules by a real calendar month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});
