import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({ default: { create: vi.fn() } }));
vi.mock("socket.io-client", () => ({ io: vi.fn() }));

describe("player connections", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ["", "", "/api"],
    ["https://game.example.com", "https://game.example.com", "https://game.example.com/api"],
    ["https://game.example.com/", "https://game.example.com", "https://game.example.com/api"],
  ])("uses the same endpoint for API and sockets with override %s", async (override, base, apiUrl) => {
    vi.stubEnv("VITE_API_URL", override);
    const { API_BASE } = await import("../../src/services/api");
    await import("../../src/services/socket");
    const { default: axios } = await import("axios");
    const { io } = await import("socket.io-client");

    expect(API_BASE).toBe(base);
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: apiUrl,
      withCredentials: true,
    });
    expect(io).toHaveBeenCalledWith(base || undefined, {
      autoConnect: false,
      transports: ["websocket"],
    });
  });
});
