import { Router } from "express";
import {
  create,
  listMine,
  remove
} from "../controllers/reservations.controller.js";
import {
  requireAuth
} from "../middlewares/auth.middleware.js";
import {
  requireRoles
} from "../middlewares/roles.middleware.js";

export const reservationsRouter = Router();

reservationsRouter.use(requireAuth);

reservationsRouter.post(
  "/",
  requireRoles("administrador", "docente"),
  create
);

reservationsRouter.get("/me", listMine);

reservationsRouter.delete("/:id", remove);