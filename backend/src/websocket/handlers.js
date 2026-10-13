const tournament = require("../services/tournament");

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("event:watch", ({ eventId }) => {
      if (!eventId) return;
      const event = tournament.getEvent(eventId);
      if (event) {
        socket.join(event.id);
        if (event.code) socket.join(event.code);
      } else {
        socket.join(eventId);
      }
    });

    socket.on("event:unwatch", ({ eventId }) => {
      if (!eventId) return;
      const event = tournament.getEvent(eventId);
      if (event) {
        socket.leave(event.id);
        if (event.code) socket.leave(event.code);
      } else {
        socket.leave(eventId);
      }
    });

    socket.on("game:join", ({ eventId, playerId }) => {
      const event = tournament.getEvent(eventId);
      if (!event) {
        socket.emit("game:error", { message: "Event not found. Please join an existing event." });
        return;
      }
      const found = tournament.reconnect(event.id, playerId, socket.id);
      if (!found) {
        socket.emit("game:error", { message: "Unable to rejoin event" });
        return;
      }

      socket.join(found.event.id);
      if (found.event.code) socket.join(found.event.code);
      socket.emit("game:player-reconnected", {
        playerId,
        currentRound: found.event.currentRound,
        status: found.player.status,
        roundEndsAt: found.event.roundEndsAt,
        roundState: found.player.rounds[found.event.currentRound] || null,
      });

      io.to(found.event.id).emit("game:player-joined", {
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
