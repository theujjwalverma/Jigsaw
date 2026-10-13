import { useEffect } from "react";
import { socket } from "../services/socket";
import { useGameStore } from "../services/gameState";
import { restorePlayerState } from "../services/playerState";

export function useGameSocket() {
  const {
    eventId,
    playerId,
    setRound,
    setLeaderboard,
    setFinalLeaderboard,
  } = useGameStore();

  useEffect(() => {
    if (!eventId || !playerId) return;

    const onConnect = () => {
      socket.emit("game:join", { eventId, playerId });
      restorePlayerState(eventId, playerId);
    };

    const onRoundStart = (payload) => {
      setRound({
        currentRound: payload.round,
        roundEndsAt: payload.roundEndsAt,
        puzzle: payload.puzzle,
      });
    };

    const onReconnected = (payload) => {
      if (payload.playerId === playerId) restorePlayerState(eventId, playerId);
    };

    const onRoundEnd = (payload) => {
      setLeaderboard({
        leaderboard: payload.leaderboard || [],
        round: payload.round || 0,
      });
    };

    const onTournamentEnd = (payload) => {
      setFinalLeaderboard(payload || []);
    };

    socket.on("game:round-start", onRoundStart);
    socket.on("game:round-end", onRoundEnd);
    socket.on("game:tournament-end", onTournamentEnd);
    socket.on("game:player-reconnected", onReconnected);
    socket.on("connect", onConnect);
    const onError = (payload) => useGameStore.getState().setConnectionError(payload.message);
    socket.on("game:error", onError);
    if (socket.connected) onConnect();
    else socket.connect();
    restorePlayerState(eventId, playerId);
    const timer = setInterval(() => restorePlayerState(eventId, playerId), 2000);

    return () => {
      clearInterval(timer);
      socket.off("connect", onConnect);
      socket.off("game:error", onError);
      socket.off("game:round-start", onRoundStart);
      socket.off("game:round-end", onRoundEnd);
      socket.off("game:tournament-end", onTournamentEnd);
      socket.off("game:player-reconnected", onReconnected);
    };
  }, [
    eventId,
    playerId,
    setRound,
    setLeaderboard,
    setFinalLeaderboard,
  ]);

  return socket;
}
