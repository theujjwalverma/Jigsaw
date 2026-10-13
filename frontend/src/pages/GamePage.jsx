import { useEffect } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PieceTray } from "../components/PieceTray";
import { PuzzleBoard } from "../components/PuzzleBoard";
import { GameHud } from "../components/GameHud";
import { LiveSpectatorFeed } from "../components/LiveSpectatorFeed";
import { api } from "../services/api";
import { useGameStore } from "../services/gameState";
import { useImageAspectRatio } from "../hooks/useImageAspectRatio";

export function GamePage() {
  const [selection, setSelection] = useState({ round: 0, pieceId: null });
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState(null);

  const { eventId: routeEventId, roundNumber } = useParams();
  const navigate = useNavigate();
  const {
    eventId,
    playerId,
    currentRound,
    roundEndsAt,
    puzzle,
    placedPieceIds,
    placements,
    completed,
    moves,
    leaderboard,
    eventStatus,
    connectionError,
    applyPlacement,
  } = useGameStore();
  const { imageAspectRatio, imageError } = useImageAspectRatio(puzzle?.imageUrl);
  const activePieceId = selection.round === currentRound ? selection.pieceId : null;
  const pickPiece = (pieceId) => setSelection({ round: currentRound, pieceId });
  const errorMessage = error?.eventId === eventId && error.playerId === playerId &&
    error.round === currentRound ? error.message : "";

  useEffect(() => {
    if (!playerId) {
      navigate(`/join/${routeEventId}`, { replace: true });
    } else if (eventStatus === "lobby") {
      navigate(`/lobby/${routeEventId || eventId}`, { replace: true });
    } else if (eventStatus === "between_rounds" || eventStatus === "finished" || leaderboard.length) {
      navigate(`/leaderboard/${routeEventId || eventId}/${currentRound || roundNumber}`);
    } else if (currentRound && currentRound !== Number(roundNumber)) {
      navigate(`/game/${routeEventId || eventId}/${currentRound}`, { replace: true });
    }
  }, [leaderboard, navigate, eventId, currentRound, roundNumber, eventStatus, playerId, routeEventId]);

  const isCurrentRound = () => {
    const latest = useGameStore.getState();
    return latest.eventId === eventId && latest.playerId === playerId && latest.currentRound === currentRound;
  };

  const sendAction = async (action, payload, failureMessage) => {
    if (isMoving || completed) return;
    setIsMoving(true);
    try {
      const { data } = await api.post(`/events/${eventId}/${action}`, {
        playerId,
        roundNumber: currentRound,
        ...payload,
      });
      if (!isCurrentRound()) return;
      applyPlacement(data);
      pickPiece(null);
      setError(null);
    } catch (err) {
      if (isCurrentRound()) setError({
        eventId, playerId, round: currentRound, message: err.response?.data?.error || failureMessage,
      });
    } finally {
      setIsMoving(false);
    }
  };
  const placePiece = (pieceId, cellId) =>
    sendAction("place-piece", { pieceId, cellId }, "Unable to place the piece. Please retry.");
  const submitRound = () =>
    sendAction("submit-round", {}, "Unable to submit the round. Please retry.");

  return (
    <section className="page game-page">
      <header className="page-heading">
        <div><p className="eyebrow">THE PUZZLE CHALLENGE</p><h1>Round {currentRound || 1}</h1>
          <p className="subtitle">Find your flow. Make the picture whole.</p>
        </div>
        <span className="badge badge-mint">{puzzle ? `${puzzle.grid} x ${puzzle.grid} puzzle` : "Getting ready"}</span>
      </header>
      {connectionError || imageError ? <p role="alert" className="error">{connectionError || imageError}</p> : null}
      {!puzzle || !imageAspectRatio ? (
        !imageError ? <p role="status">Loading puzzle from the game server...</p> : null
      ) : (
        <>
      <GameHud round={currentRound || 1} moves={moves} placed={placedPieceIds.length}
        total={puzzle.pieces.length} roundEndsAt={roundEndsAt} completed={completed} />
      <div className="game-layout">
      <div className="clay-panel board-panel">
        <div className="panel-heading"><h2>Your canvas</h2><span className="muted">Build the big picture</span></div>
      <PuzzleBoard
        puzzle={puzzle}
        imageAspectRatio={imageAspectRatio}
        placements={placements}
        activePieceId={activePieceId}
        onPlacePiece={placePiece}
        onPickPiece={pickPiece}
        completed={completed}
        disabled={isMoving}
      />
      {errorMessage ? <p role="alert" className="error">{errorMessage}</p> : null}
      {!completed && placedPieceIds.length === puzzle.pieces.length ? (
        <button type="button" className="submit-round-button" onClick={submitRound}
          disabled={isMoving} aria-busy={isMoving}>Submit round</button>
      ) : null}
      </div>
      <div className="clay-panel tray-panel">
        <div className="panel-heading"><h2>Piece playground</h2><span className="badge badge-peach">{puzzle.pieces.length - placedPieceIds.length} left</span></div>
      <PieceTray
        key={`${eventId}:${currentRound}`}
        puzzle={puzzle}
        imageAspectRatio={imageAspectRatio}
        placedPieceIds={placedPieceIds}
        activePieceId={activePieceId}
        onPickPiece={pickPiece}
        onReturnPiece={(pieceId) => placePiece(pieceId, null)}
        disabled={isMoving || completed}
      />
      <button type="button" className="return-piece-button"
        disabled={isMoving || completed || !placedPieceIds.includes(activePieceId)}
        onClick={() => placePiece(activePieceId, null)}>Return selected piece to playground</button>
      <p className="play-hint">Arrange pieces anywhere on the board. Select a board piece and use Return, or drag it back here. Placing onto an occupied cell returns its old piece here.</p>
      </div>
      </div>
        </>
      )}

      {completed ? (
        <div className="completed-live-wrapper">
          <p className="celebration" role="status">
            Round submitted! Puzzle complete. Your leaderboard is up next.
          </p>
          <LiveSpectatorFeed
            eventId={eventId}
            currentRound={currentRound}
            puzzle={puzzle}
            myPlayerId={playerId}
          />
        </div>
      ) : null}
    </section>
  );
}
