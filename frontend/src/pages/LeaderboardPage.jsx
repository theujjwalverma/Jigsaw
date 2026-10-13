import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import { useGameStore } from "../services/gameState";
import { LeaderboardTable } from "../components/LeaderboardTable";

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { eventId, roundNumber } = useParams();
  const roundNumberAsNumber = Number(roundNumber);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const leaderboardRound = useGameStore((s) => s.leaderboardRound);
  const currentRound = useGameStore((s) => s.currentRound);
  const finalLeaderboard = useGameStore((s) => s.finalLeaderboard);
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    const loadEventWindow = async () => {
      const { data } = await api.get(`/events/${eventId}`);
      setSecondsLeft(data.leaderboardSeconds || 30);
    };

    loadEventWindow();
  }, [eventId, leaderboardRound]);

  useEffect(() => {
    const handle = setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(handle);
  }, [leaderboardRound]);

  useEffect(() => {
    if (currentRound > roundNumberAsNumber) {
      navigate(`/game/${eventId}/${currentRound}`);
    }
  }, [currentRound, roundNumberAsNumber, navigate, eventId]);

  return (
    <section className="page leaderboard-page">
      <p className="eyebrow">SMALL PIECES. BIG ACHIEVEMENTS.</p>
      <h1>Round Leaderboard</h1>
      {finalLeaderboard.length ? (
        <>
          <p className="celebration">Tournament complete. Look at you go!</p>
          <LeaderboardTable rows={finalLeaderboard} />
        </>
      ) : (
        <>
          <p className="badge badge-peach">Next round starts in {secondsLeft}s</p>
          <LeaderboardTable rows={leaderboard} />
        </>
      )}
    </section>
  );
}
