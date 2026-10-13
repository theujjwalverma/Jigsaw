import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LeaderboardTable } from "../../src/components/LeaderboardTable";

it("highlights top ranks without changing scores and wraps the table for mobile scrolling", () => {
  const html = renderToStaticMarkup(<LeaderboardTable rows={[
    { playerId: "a", rank: 1, name: "Alice", moves: 4, timeMs: 6000, points: 10 },
    { name: "Bob", rank: 4, totalMoves: 40, totalTimeMs: 60000, totalPoints: 50 },
    { playerId: "c", name: "Charlie", moves: 6, timeMs: 10000, points: 5 },
  ]} />);
  expect(html).toContain('class="table-scroll"');
  expect(html).toContain('class="rank-badge rank-top">1');
  expect(html).toContain('class="rank-badge ">4');
  expect(html).toContain('class="rank-badge rank-top">3');
  expect(html).toContain("<td>40</td>");
  expect(html).toContain("<td>01:00</td>");
  expect(html).toContain("<td>50</td>");
});

it("displays round and tournament elapsed times in mm:ss", () => {
  const html = renderToStaticMarkup(<LeaderboardTable rows={[
    { name: "Alice", timeMs: 92427 },
    { name: "Bob", totalTimeMs: 105993 },
    { name: "Charlie", timeMs: 122645 },
  ]} />);
  expect(html).toContain("Time (mm:ss)");
  expect(html).toContain("<td>01:32</td>");
  expect(html).toContain("<td>01:45</td>");
  expect(html).toContain("<td>02:02</td>");
});

it("shows an honest empty state while waiting for scores", () => {
  expect(renderToStaticMarkup(<LeaderboardTable rows={[]} />)).toContain("The scores are on their way");
});
