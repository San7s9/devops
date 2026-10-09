import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const { mongoInsertOne } = vi.hoisted(() => ({
  mongoInsertOne: vi.fn(),
}));

vi.mock("../src/db/postgres.js", () => ({
  pgPool: { query: vi.fn() },
}));

vi.mock("../src/db/mongo.js", () => ({
  getMongoDb: () => ({
    collection: () => ({ insertOne: mongoInsertOne }),
  }),
}));

import { createApp } from "../src/app.js";
const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Products endpoints", () => {
  it("POST /api/products crea un producto y responde 201", async () => {
    mongoInsertOne.mockResolvedValueOnce({ insertedId: "p1" });
    const res = await request(app)
      .post("/api/products")
      .send({ name: "Teclado", price: 120000 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ _id: "p1", name: "Teclado", price: 120000 });
    expect(mongoInsertOne).toHaveBeenCalledOnce();
  });

  it("POST /api/products sin precio responde 400", async () => {
    const res = await request(app).post("/api/products").send({ name: "Teclado" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "name and a positive price are required" });
    expect(mongoInsertOne).not.toHaveBeenCalled();
  });
});