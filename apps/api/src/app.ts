import express from "express";
import swaggerUi from "swagger-ui-express";

import { openApiDocument } from "./docs/openapi.js";
import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { spacesRouter } from "./routes/spaces.routes.js";
import {
  reservationsRouter
} from "./routes/reservations.routes.js";
import {
  apiKeysRouter
} from "./routes/api-keys.routes.js";
import { nowRouter } from "./routes/now.routes.js";

export const app = express();

app.use(express.json());

app.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "ReservaLab | Documentación API",
    swaggerOptions: {
      persistAuthorization: false
    }
  })
);

app.use("/api/v1/api-keys", apiKeysRouter);
app.use("/api/v1/reservations", reservationsRouter);
app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1", nowRouter);
app.use("/api/v1/spaces", spacesRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada"
  });
});