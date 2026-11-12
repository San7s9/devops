import type { NextFunction, Request, RequestHandler, Response } from "express";

export type RouteStats = {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
};

export type RouteMetrics = RouteStats & { route: string; avgMs: number };

/**
 * Trazabilidad de tiempos: mide cuánto tarda cada servicio (método + ruta).
 * - Registra una línea en el log por petición.
 * - Agrega la cabecera X-Response-Time.
 * - Acumula estadísticas en memoria para consultarlas en GET /metrics.
 */
export class TimingRecorder {
  private readonly stats = new Map<string, RouteStats>();

  record(route: string, durationMs: number): void {
    const current = this.stats.get(route);
    if (!current) {
      this.stats.set(route, {
        count: 1,
        totalMs: durationMs,
        minMs: durationMs,
        maxMs: durationMs,
        lastMs: durationMs,
      });
      return;
    }
    current.count += 1;
    current.totalMs += durationMs;
    current.minMs = Math.min(current.minMs, durationMs);
    current.maxMs = Math.max(current.maxMs, durationMs);
    current.lastMs = durationMs;
  }

  snapshot(): RouteMetrics[] {
    const round = (value: number) => Math.round(value * 100) / 100;
    return [...this.stats.entries()]
      .map(([route, s]) => ({
        route,
        count: s.count,
        totalMs: round(s.totalMs),
        avgMs: round(s.totalMs / s.count),
        minMs: round(s.minMs),
        maxMs: round(s.maxMs),
        lastMs: round(s.lastMs),
      }))
      .sort((a, b) => a.route.localeCompare(b.route));
  }
}

export function timingMiddleware(
  recorder: TimingRecorder,
  log: (line: string) => void = console.log,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    const elapsedMs = () => Number(process.hrtime.bigint() - start) / 1e6;

    // La cabecera debe ponerse antes de enviar la respuesta.
    const originalWriteHead = res.writeHead;
    res.writeHead = function (this: Response, ...args: Parameters<Response["writeHead"]>) {
      if (!res.headersSent) {
        res.setHeader("X-Response-Time", `${elapsedMs().toFixed(2)}ms`);
      }
      return originalWriteHead.apply(this, args);
    } as Response["writeHead"];

    res.once("finish", () => {
      const durationMs = elapsedMs();
      // Se agrupa por la ruta declarada (p. ej. /api/products/:id), no por la URL real.
      const path = req.route ? `${req.baseUrl}${String(req.route.path)}` : req.baseUrl || req.path;
      const route = `${req.method} ${path}`;
      if (route !== "GET /metrics") recorder.record(route, durationMs);
      log(`[timing] ${route} ${res.statusCode} ${durationMs.toFixed(2)}ms`);
    });

    next();
  };
}
