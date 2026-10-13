import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";
import { socket } from "../services/socket";
import { MiniBoard } from "./MiniBoard";

export function LiveSpectatorFeed({ eventId, currentRound, puzzle: initialPuzzle, myPlayerId }) {
  const [spectatorData, setSpectatorData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    let isMounted = true;

    const fetchState = async () => {
      try {
        const { data } = await api.get(`/events/${eventId}/spectator`);
        if (isMounted) setSpectatorData(data);
      } catch {
        // silent fail
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchState();

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("event:watch", { eventId });

    const handlePlacement = ({ playerId, placements, moves, placedPieceIds, completed }) => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => {
            if (p.id !== playerId) return p;
            return {
              ...p,
              placements: placements || p.placements,
              moves: moves !== undefined ? moves : p.moves,
              placedPieceIds: placedPieceIds || p.placedPieceIds,
              completed: completed !== undefined ? completed : p.completed,
            };
          }),
        };
      });
    };

    const handlePlayerFinished = ({ playerId, moves, finishedAtMs }) => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => {
            if (p.id !== playerId) return p;
            return {
              ...p,
              completed: true,
              moves: moves !== undefined ? moves : p.moves,
              finishedAtMs: finishedAtMs || Date.now(),
            };
          }),
        };
      });
    };

    const handlePlayerJoined = ({ playerId, name }) => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        if (prev.players.some((p) => p.id === playerId)) {
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === playerId ? { ...p, connected: true } : p
            ),
          };
        }
        return {
          ...prev,
          players: [
            ...prev.players,
            {
              id: playerId,
              name,
              connected: true,
              moves: 0,
              completed: false,
              finishedAtMs: null,
              placements: {},
              placedPieceIds: [],
            },
          ],
        };
      });
    };

    const handlePlayerDisconnected = ({ playerId }) => {
      setSpectatorData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, connected: false } : p
          ),
        };
      });
    };

    socket.on("spectator:placement", handlePlacement);
    socket.on("spectator:player-finished", handlePlayerFinished);
    socket.on("game:player-joined", handlePlayerJoined);
    socket.on("game:player-disconnected", handlePlayerDisconnected);

    const interval = setInterval(fetchState, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      socket.off("spectator:placement", handlePlacement);
      socket.off("spectator:player-finished", handlePlayerFinished);
      socket.off("game:player-joined", handlePlayerJoined);
      socket.off("game:player-disconnected", handlePlayerDisconnected);
    };
  }, [eventId]);

  const activePuzzle = spectatorData?.puzzle || initialPuzzle;
  const totalPieces = useMemo(() => {
    if (!activePuzzle) return 0;
    return activePuzzle.pieces?.length || activePuzzle.grid * activePuzzle.grid;
  }, [activePuzzle]);

  const players = spectatorData?.players || [];
  const finishedCount = players.filter((p) => p.completed).length;

  if (loading && !spectatorData) {
    return (
      <div className="completed-live-feed clay-panel">
        <div className="live-feed-header">
          <span className="live-badge"><span className="live-dot" /> LIVE</span>
          <h3>Loading live player boards...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="completed-live-feed clay-panel">
      <div className="live-feed-header">
        <div className="live-feed-title-wrap">
          <span className="live-badge"><span className="live-dot" /> LIVE</span>
          <h3>Arena Live View</h3>
          <span className="live-feed-sub">
            {finishedCount} of {players.length} completed • Watching active solvers
          </span>
        </div>
      </div>

      <div className="completed-live-grid">
        {players.map((player) => {
          const isMe = player.id === myPlayerId;
          const placedCount = player.placedPieceIds?.length || Object.keys(player.placements || {}).length;
          const progressPct = totalPieces > 0 ? Math.round((placedCount / totalPieces) * 100) : 0;

          return (
            <div
              key={player.id}
              className={`completed-player-card ${player.completed ? "is-finished" : ""} ${isMe ? "is-me" : ""}`}
            >
              <div className="completed-player-header">
                <div className="player-meta">
                  <span className={`status-indicator ${player.connected ? "online" : "offline"}`} />
                  <strong className="player-name">
                    {player.name} {isMe ? "(You)" : ""}
                  </strong>
                </div>
                {player.completed ? (
                  <span className="badge-solved">✓ Solved</span>
                ) : (
                  <span className="badge-moves">{player.moves} moves</span>
                )}
              </div>

              <div className="completed-mini-board-box">
                <MiniBoard
                  puzzle={activePuzzle}
                  placements={player.placements || {}}
                  completed={player.completed}
                />
              </div>

              <div className="completed-player-footer">
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${player.completed ? 100 : progressPct}%` }}
                  />
                </div>
                <div className="player-card-metrics">
                  <span>{player.completed ? "Solved" : `${placedCount}/${totalPieces}`}</span>
                  <span>{player.completed ? "100%" : `${progressPct}%`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
