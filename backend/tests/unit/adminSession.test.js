const jwt = require("jsonwebtoken");
const env = require("../../src/config/env");
const authRoutes = require("../../src/routes/auth");

describe("admin session", () => {
  function checkSession(token) {
    const route = authRoutes.stack.find((layer) => layer.route?.path === "/session").route;
    const req = { headers: {}, cookies: token ? { adminToken: token } : {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    route.stack[0].handle(req, res, () => route.stack[1].handle(req, res));
    return res;
  }

  it("restores a valid cookie session", () => {
    const res = checkSession(jwt.sign({ role: "admin" }, env.jwtSecret));
    expect(res.json).toHaveBeenCalledWith({ authenticated: true });
  });

  it.each([undefined, "invalid", jwt.sign({ role: "admin" }, env.jwtSecret, { expiresIn: -1 })])(
    "rejects missing, invalid, or expired cookies",
    (token) => {
      const res = checkSession(token);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).not.toHaveBeenCalledWith({ authenticated: true });
    },
  );
});
