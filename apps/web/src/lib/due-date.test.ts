import { describe, expect, it } from "vitest";
import { formatDueDate, isOverdue } from "./due-date.js";

// vite.config.ts pins TZ to America/Toronto (UTC-4 in September, UTC-5 in January).
const now = new Date("2026-08-27T12:00:00Z");

describe("formatDueDate", () => {
  it("renders the instant in the viewer's zone without the year when it is the current year", () => {
    expect(formatDueDate("2026-09-03T15:00:00.000Z", now)).toBe("Sep 3, 11:00 AM");
  });

  it("appends the year when it is not the current one", () => {
    expect(formatDueDate("2027-01-15T14:30:00.000Z", now)).toBe("Jan 15, 2027, 9:30 AM");
  });

  it("uses the viewer's calendar day, not UTC's", () => {
    // 02:30 UTC on the 4th is still the evening of the 3rd in Toronto.
    expect(formatDueDate("2026-09-04T02:30:00.000Z", now)).toBe("Sep 3, 10:30 PM");
  });
});

describe("isOverdue", () => {
  it("is true only when the instant has passed and the todo is incomplete", () => {
    expect(isOverdue("2026-08-27T11:59:59.999Z", false, now)).toBe(true);
    expect(isOverdue("2026-08-27T12:00:00.000Z", false, now)).toBe(false);
    expect(isOverdue("2026-08-27T11:59:59.999Z", true, now)).toBe(false);
    expect(isOverdue(null, false, now)).toBe(false);
  });
});
