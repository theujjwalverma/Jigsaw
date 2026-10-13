const request = require("supertest");
const { createApp } = require("../../src/app");

describe("player flow", () => {
  it("creates an event and allows a player to join", async () => {
    const app = createApp();

    const createRes = await request(app).post("/api/events").send({
      roundSeconds: 300,
      leaderboardSeconds: 30,
    });
    expect(createRes.statusCode).toBe(201);

    const joinRes = await request(app)
      .post(`/api/events/${createRes.body.id}/join`)
      .send({ name: "Alice" });

    expect(joinRes.statusCode).toBe(201);
    expect(joinRes.body.playerId).toBeTruthy();
  });
});
