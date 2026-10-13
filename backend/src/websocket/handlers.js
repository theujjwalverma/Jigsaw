const tournament = require("../services/tournament");

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("event:watch", ({ eventId }) => {
      if (!eventId) return;
      const event = tournament.getEvent(eventId);
      const targetId = event ? event.id : eventId;
      socket.join(targetId);
    });

    socket.on("event:unwatch", ({ eventId }) => {
      if (!eventId) return;
      const event = tournament.getEvent(eventId);
      const targetId = event ? event.id : eventId;
      socket.leave(targetId);
    });

    socket.on("game:join", ({ eventId, playerId }) => {
      if (!tournament.getEvent(eventId)) {
        socket.emit("game:error", { message: "Event not found. Please join an existing event." });
        return;
      }
      const found = tournament.reconnect(eventId, playerId, socket.id);
      if (!found) {
        socket.emit("game:error", { message: "Unable to rejoin event" });
        return;
      }

      socket.join(eventId);
      socket.emit("game:player-reconnected", {
        playerId,
        currentRound: found.event.currentRound,
        status: found.player.status,
        roundEndsAt: found.event.roundEndsAt,
        roundState: found.player.rounds[found.event.currentRound] || null,
      });

      io.to(eventId).emit("game:player-joined", {
        playerId,
        name: found.player.name,
      });
    });

    socket.on("disconnect", () => {
      const found = tournament.setDisconnectedBySocket(socket.id);
      if (!found) return;

      io.to(found.event.id).emit("game:player-disconnected", {
        playerId: found.player.id,
        name: found.player.name,
      });
    });
  });
}

module.exports = {
  registerSocketHandlers,
};
