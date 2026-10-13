import { formatMs } from "../utils/formatters";

export function LeaderboardTable({ rows }) {
  return (
    <div className="table-scroll">
    <table className="leaderboard">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Moves</th>
          <th>Time (mm:ss)</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.playerId || row.name}>
            <td><span className={`rank-badge ${(row.rank || index + 1) <= 3 ? "rank-top" : ""}`}>{row.rank || index + 1}</span></td>
            <td>{row.name}</td>
            <td>{row.moves ?? row.totalMoves}</td>
            <td>{formatMs(row.timeMs ?? row.totalTimeMs)}</td>
            <td>{row.points ?? row.totalPoints}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length === 0 ? <p className="empty-state">The scores are on their way. Stay curious!</p> : null}
    </div>
  );
}
