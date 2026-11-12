import express from "express";
import cors from "cors";
import { postgresRouter } from "./routes/postgres.routes.js";
import { mongoRouter } from "./routes/mongo.routes.js";
import { productsRouter } from "./routes/products.routes.js";
import { TimingRecorder, timingMiddleware } from "./middleware/timing.js";

export function createApp() {
  const app = express();
  const recorder = new TimingRecorder();

  app.use(cors());
  app.use(express.json());
  app.use(timingMiddleware(recorder));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "express-ts-api" });
  });

  app.get("/metrics", (_req, res) => {
    res.json({ unit: "ms", routes: recorder.snapshot() });
  });

  app.use("/api/postgres", postgresRouter);
  app.use("/api/mongo", mongoRouter);
  app.use("/api/products", productsRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found", code: "NOT_FOUND" });
  });

  return app;
}
