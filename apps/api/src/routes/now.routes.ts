import { Router } from "express";
import {
  listNow
} from "../controllers/now.controller.js";
import {
  requireApiKey
} from "../middlewares/api-key.middleware.js";

export const nowRouter = Router();

nowRouter.get(
  "/now",
  requireApiKey("read:now"),
  listNow
);