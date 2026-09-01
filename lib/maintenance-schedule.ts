import type { Timing } from "@/lib/types";

const DAY_MS = 86_400_000;

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("due date must use YYYY-MM-DD");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("due date must be a valid calendar date");
  return date;
}

export function dateOnly(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonths(value: string, months: number) {
  const date = parseDate(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function timingForDate(dueDate: string, today = dateOnly()): Timing {
  const due = parseDate(dueDate);
  const current = parseDate(today);
  if (due < current) return "overdue";
  const daysUntilSunday = 7 - (current.getUTCDay() || 7);
  if (due <= parseDate(addDays(today, daysUntilSunday))) return "this_week";
  if (due.getUTCFullYear() === current.getUTCFullYear() && due.getUTCMonth() === current.getUTCMonth()) return "this_month";
  return "later";
}

type DueCriteria = { date?: string; condition?: string };

export function attentionDate(due: DueCriteria, checkOn: string | null) {
  if (!due.date) return checkOn;
  if (!checkOn) return due.date;
  return due.date < checkOn ? due.date : checkOn;
}

export function timingForMaintenance(due: DueCriteria, checkOn: string | null, today = dateOnly()): Timing {
  const date = attentionDate(due, checkOn);
  return date ? timingForDate(date, today) : "watching";
}

export function maintenanceScheduleLabel(due: DueCriteria, checkOn: string | null, today = dateOnly()) {
  const date = attentionDate(due, checkOn);
  if (!date) return "Watching";
  const label = friendlyDueDate(date, today);
  if (date === due.date) return label;
  if (label === "Today") return "Check today";
  if (label === "Tomorrow") return "Check tomorrow";
  if (label === "This week") return "Check this week";
  if (label === "Next week") return "Check next week";
  if (label === "Overdue") return "Check overdue";
  return `Check in ${label}`;
}

export function friendlyDueDate(dueDate: string, today = dateOnly()) {
  const due = parseDate(dueDate);
  const current = parseDate(today);
  const days = Math.round((due.getTime() - current.getTime()) / DAY_MS);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";

  const startOfWeek = addDays(today, -(current.getUTCDay() || 7) + 1);
  const weekOffset = Math.floor((due.getTime() - parseDate(startOfWeek).getTime()) / (7 * DAY_MS));
  if (weekOffset === 0) return "This week";
  if (weekOffset === 1) return "Next week";
  if (days < 56) return `${Math.round(days / 7)} weeks`;

  const months = Math.round(days / 30.4375);
  if (months < 12) return `${Math.max(2, months)} months`;
  if (due.getUTCFullYear() === current.getUTCFullYear() + 1) return "Next year";
  return `${Math.max(2, Math.round(months / 12))} years`;
}

export function legacyTimingDate(timing: Timing, today = dateOnly()) {
  if (timing === "overdue") return addDays(today, -1);
  if (timing === "this_week") return addDays(today, 3);
  if (timing === "this_month") return addDays(today, 21);
  return addMonths(today, 3);
}
