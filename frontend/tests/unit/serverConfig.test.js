import { expect, it } from "vitest";
import config from "../../vite.config";

it("serves LAN players and proxies HTTP and WebSocket traffic to the backend", () => {
  expect(config.server.host).toBe("0.0.0.0");
  expect(config.server.port).toBe(5173);
  expect(config.server.strictPort).toBe(true);
  expect(config.server.proxy["/api"]).toEqual({
    target: "http://127.0.0.1:5000",
    changeOrigin: true,
  });
  expect(config.server.proxy["/socket.io"]).toEqual({
    target: "http://127.0.0.1:5000",
    changeOrigin: true,
    ws: true,
  });
});
