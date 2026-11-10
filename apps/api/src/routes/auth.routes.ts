import { Router } from "express";
import {
  register,
  login,
  getMe
} from "../controllers/auth.controller.js";
import {
  refresh,
  logout
} from "../controllers/sessions.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

export const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", requireAuth, logout);
authRouter.get("/me", requireAuth, getMe);