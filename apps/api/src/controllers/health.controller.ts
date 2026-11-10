import type { RequestHandler } from "express";
import { getHealthStatus } from "../services/health.service.js";

export const getHealth: RequestHandler = async (_req, res) => {
  try {
    const health = await getHealthStatus();

    res.status(health.status === "ok" ? 200 : 503).json(health);
  } catch (error) {
    console.error("Error al consultar el estado del sistema:", error);

    res.status(503).json({
      status: "error",
      service: "reservalab-api",
      database: "down",
      cache: "down"
    });
  }
};