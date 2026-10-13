import { describe, expect, it } from "vitest";
import { formatMs } from "../../src/utils/formatters";

describe("formatMs", () => {
  it("formats milliseconds to mm:ss", () => {
    expect(formatMs(61000)).toBe("01:01");
  });
});
