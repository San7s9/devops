import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/db/postgres.js", () => ({ pgPool: { query: vi.fn() } }));
vi.mock("../src/db/mongo.js", () => ({
  getMongoDb: () => ({ collection: () => ({ insertOne: vi.fn() }) }),
}));

import { createApp } from "../src/app.js";
import { TimingRecorder, timingMiddleware } from "../src/middleware/timing.js";

describe("TimingRecorder", () => {
  it("calcula conteo, promedio, mínimo y máximo por ruta", () => {
    const recorder = new TimingRecorder();
    recorder.record("GET /a", 10);
    recorder.record("GET /a", 30);
    recorder.record("GET /b", 5);

    expect(recorder.snapshot()).toEqual([
      { route: "GET /a", count: 2, totalMs: 40, avgMs: 20, minMs: 10, maxMs: 30, lastMs: 30 },
      { route: "GET /b", count: 1, totalMs: 5, avgMs: 5, minMs: 5, maxMs: 5, lastMs: 5 },
    ]);
  });
});

describe("timingMiddleware", () => {
  it("agrega X-Response-Time y escribe una línea de log", async () => {
    const lines: string[] = [];
    const app = express();
    app.use(timingMiddleware(new TimingRecorder(), (line) => lines.push(line)));
    app.get("/ping", (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app).get("/ping");

    expect(res.status).toBe(200);
    expect(res.headers["x-response-time"]).toMatch(/^\d+\.\d{2}ms$/);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[timing\] GET \/ping 200 \d+\.\d{2}ms$/);
  });
});

describe("GET /metrics", () => {
  it("devuelve la medición de los servicios ya ejecutados", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const app = createApp();

    await request(app).get("/health");
    await request(app).get("/health");
    await request(app).get("/ruta-inexistente");
    const res = await request(app).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.body.unit).toBe("ms");
    const health = res.body.routes.find((r: { route: string }) => r.route === "GET /health");
    expect(health.count).toBe(2);
    expect(health.avgMs).toBeGreaterThanOrEqual(0);
    expect(health.maxMs).toBeGreaterThanOrEqual(health.minMs);
    expect(res.body.routes.some((r: { route: string }) => r.route === "GET /metrics")).toBe(false);
  });
});
