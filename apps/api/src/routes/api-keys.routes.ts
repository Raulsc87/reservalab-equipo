import { Router } from "express";
import {
  create,
  list,
  remove
} from "../controllers/api-keys.controller.js";
import {
  requireAuth
} from "../middlewares/auth.middleware.js";
import {
  requireRoles
} from "../middlewares/roles.middleware.js";

export const apiKeysRouter = Router();

apiKeysRouter.use(
  requireAuth,
  requireRoles("administrador")
);

apiKeysRouter.post("/", create);
apiKeysRouter.get("/", list);
apiKeysRouter.delete("/:id", remove);