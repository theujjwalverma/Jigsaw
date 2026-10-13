function scoreForRank(rank, maxPlayers = 50) {
  return Math.max(1, maxPlayers - (rank - 1));
}

function rankRoundResults(entries) {
  const sorted = [...entries].sort((a, b) => {
    const completeA = a.completed ? 1 : 0;
    const completeB = b.completed ? 1 : 0;
    if (completeA !== completeB) return completeB - completeA;

    if (a.moves !== b.moves) return a.moves - b.moves;
    return a.timeMs - b.timeMs;
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    points: scoreForRank(index + 1),
  }));
}

function buildTournamentLeaderboard(players, roundResultsByRound) {
  const byId = new Map();
  players.forEach((p) => {
    byId.set(p.id, {
      playerId: p.id,
      name: p.name,
      totalPoints: 0,
      totalMoves: 0,
      totalTimeMs: 0,
    });
  });

  roundResultsByRound.forEach((roundResults) => {
    roundResults.forEach((row) => {
      const target = byId.get(row.playerId);
      if (!target) return;
      target.totalPoints += row.points;
      target.totalMoves += row.moves;
      target.totalTimeMs += row.timeMs;
    });
  });

  return [...byId.values()].sort((a, b) => {
    if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.totalMoves !== b.totalMoves) return a.totalMoves - b.totalMoves;
    return a.totalTimeMs - b.totalTimeMs;
  });
}

module.exports = {
  scoreForRank,
  rankRoundResults,
  buildTournamentLeaderboard,
};
