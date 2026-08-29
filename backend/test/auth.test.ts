import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnvironment } from "../src/config/environment.js";
import { AuthService } from "../src/identity/auth/AuthService.js";
import { createAuthRouter } from "../src/identity/auth/authRouter.js";
import {
  InMemoryAuthRepository,
  InMemorySessionStore,
} from "./support/InMemoryAuth.js";

const environment = loadEnvironment({ NODE_ENV: "test" });

function createTestApp() {
  const repository = new InMemoryAuthRepository();
  const sessions = new InMemorySessionStore();
  const service = new AuthService(repository, sessions);
  const app = createApp({
    environment,
    readinessCheck: async () => undefined,
    routers: [createAuthRouter({ environment, service, sessions })],
    sessionStore: sessions,
  });
  return { app, repository, sessions };
}

describe("authentication API", () => {
  it("registers, creates a secure session cookie, and exposes /me", async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);

    const registration = await agent.post("/api/v1/auth/register").send({
      name: "Nadia Putri",
      email: "Nadia@Example.com",
      phone: "+628123456789",
      password: "aman-sekali-123",
    });
    const currentUser = await agent.get("/api/v1/me");

    expect(registration.status).toBe(201);
    expect(registration.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.user.email).toBe("nadia@example.com");
    expect(currentUser.body.platformAdmin).toBe(false);
  });

  it("does not reveal whether an invalid email or password caused login failure", async () => {
    const { app } = createTestApp();

    const response = await request(app).post("/api/v1/auth/login").send({
      email: "unknown@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_CREDENTIALS");
  });

  it.each([
    { field: "name", value: "N".repeat(51) },
    { field: "phone", value: "+" + "6".repeat(16) },
  ])(
    "rejects a registration when $field exceeds the database limit",
    async ({ field, value }) => {
      const { app } = createTestApp();
      const payload = {
        name: "Nadia Putri",
        email: "nadia@example.com",
        phone: "+628123456789",
        password: "aman-sekali-123",
        [field]: value,
      };

      const response = await request(app).post("/api/v1/auth/register").send(payload);

      expect(response.status).toBe(422);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    },
  );
});
