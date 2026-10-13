import { Timer } from "./Timer";

export function GameHud({ round, moves, placed, total, roundEndsAt, completed = false }) {
  const percent = total ? Math.round(placed / total * 100) : 0;
  return (
    <div className="game-hud">
      <div className="hud-heading">
        <span className="badge badge-lavender">Round {round} of 5</span>
        <ol className="round-track" aria-label="Tournament rounds">
          {[1, 2, 3, 4, 5].map((number) => (
            <li key={number} className={number < round ? "done" : ""}
              aria-current={number === round ? "step" : undefined}>
              <span className="sr-only">Round </span>{number}
            </li>
          ))}
        </ol>
      </div>
      <div className="stats-grid">
        <div className="stat-card stat-peach">
          <span className="stat-label">Time left</span>
          <strong><Timer roundEndsAt={roundEndsAt} /></strong>
        </div>
        <div className="stat-card stat-lavender">
          <span className="stat-label">Your moves</span><strong>{moves}</strong>
        </div>
        <div className="stat-card stat-mint">
          <span className="stat-label">Pieces on board</span><strong>{placed} / {total}</strong>
        </div>
      </div>
      <div className="progress-heading">
        <span>{completed ? "Puzzle complete!" : total > 0 && placed === total
          ? "All pieces placed. Submit your round when ready." : "Piece by piece. You've got this."}</span>
        <strong>{percent}%</strong>
      </div>
      <progress aria-label="Board coverage" max={total || 1} value={placed} />
    </div>
  );
}
