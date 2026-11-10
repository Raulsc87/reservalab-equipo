import { Router } from "express";
import {
  list,
  create,
  update,
  remove
} from "../controllers/spaces.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { requireRoles } from "../middlewares/roles.middleware.js";
import {
  availability
} from "../controllers/availability.controller.js";
import {
  requireUserOrApiKey
} from "../middlewares/api-key.middleware.js";

export const spacesRouter = Router();
spacesRouter.get(
  "/:id/availability",
  requireUserOrApiKey("read:spaces"),
  availability
);

spacesRouter.get(
  "/",
  requireUserOrApiKey("read:spaces"),
  list
);
spacesRouter.post(
  "/",
  requireAuth,
  requireRoles("administrador"),
  create
);

spacesRouter.patch(
  "/:id",
  requireAuth,
  requireRoles("administrador"),
  update
);

spacesRouter.delete(
  "/:id",
  requireAuth,
  requireRoles("administrador"),
  remove
);  