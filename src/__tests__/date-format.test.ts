import { formatDate } from "@utils/date-format";
import { describe, expect, it } from "vitest";

describe("formatDate()", () => {
  it("formats a date in en-US long format", () => {
    // Use noon to avoid timezone boundary issues
    const date = new Date(2025, 5, 15, 12, 0, 0); // June 15, 2025
    const result = formatDate(date);
    expect(result).toContain("June");
    expect(result).toContain("15");
    expect(result).toContain("2025");
  });

  it("handles January 1st", () => {
    const date = new Date(2026, 0, 1, 12, 0, 0); // January 1, 2026
    const result = formatDate(date);
    expect(result).toContain("January");
    expect(result).toContain("2026");
  });

  it("handles December 31st", () => {
    const date = new Date(2025, 11, 31, 12, 0, 0); // December 31, 2025
    const result = formatDate(date);
    expect(result).toContain("December");
    expect(result).toContain("31");
  });
});
