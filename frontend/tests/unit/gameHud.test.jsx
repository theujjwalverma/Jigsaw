import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { GameHud } from "../../src/components/GameHud";

it("shows real round, move and completion progress", () => {
  const html = renderToStaticMarkup(
    <GameHud round={2} moves={7} placed={3} total={9} roundEndsAt={null} />,
  );
  expect(html).toContain("Round 2 of 5");
  expect(html).toContain("33%");
  expect(html).toContain('aria-label="Board coverage"');
  expect(html).toContain('max="9"');
  expect(html).toContain('value="3"');
  expect(html).toContain('aria-current="step"');
  expect(html).toContain("3 / 9");
});

it("handles an empty puzzle and marks full completion", () => {
  expect(renderToStaticMarkup(<GameHud round={1} moves={0} placed={0} total={0} />)).toContain("0%");
  const completed = renderToStaticMarkup(<GameHud round={5} moves={36} placed={36} total={36} completed />);
  expect(completed).toContain("100%");
  expect(completed).toContain("Puzzle complete!");
  const fullButWrong = renderToStaticMarkup(<GameHud round={1} moves={4} placed={4} total={4} completed={false} />);
  expect(fullButWrong).not.toContain("Puzzle complete!");
  expect(fullButWrong).toContain("All pieces placed. Submit your round when ready.");
});
