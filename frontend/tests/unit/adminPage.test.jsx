import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AdminPage } from "../../src/pages/AdminPage";

vi.mock("../../src/services/socket", () => ({ socket: {} }));

it("explains the login prerequisite and prevents unauthenticated image selection", () => {
  const html = renderToStaticMarkup(<AdminPage />);
  expect(html).toContain("Log in before uploading images or starting a round.");
  expect(html.match(/type="file"[^>]*disabled=""/g)).toHaveLength(5);
  expect(html).toContain("Selecting a file is not confirmation of upload");
  expect(html).not.toContain("Lock Event");
  expect(html).not.toContain("Unlock");
  expect(html).toContain("Save Timer Settings");
  for (let round = 1; round <= 5; round++) {
    expect(html).toContain(`Round ${round} duration (seconds, 60-1800)`);
    expect(html).toContain(`Recommended square size: ${(round + 1) * 300} x ${(round + 1) * 300} px`);
    expect(html).toContain(`aria-describedby="image-guidance round-${round}-image-size"`);
  }
  expect(html).toContain("Landscape and portrait images keep their original proportions");
  expect(html).toContain("PNG, JPEG or WebP; up to 5 MB per image");
  expect(html).toContain("Leaderboard pause (seconds, 5-120)");
});
