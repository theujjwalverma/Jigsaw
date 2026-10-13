const http = require("node:http");
const { Server } = require("socket.io");
const env = require("./config/env");
const { createApp } = require("./app");
const { registerSocketHandlers } = require("./websocket/handlers");

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.corsOrigin,
    credentials: true,
  },
});

app.set("io", io);
registerSocketHandlers(io);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${env.port}`);
});
