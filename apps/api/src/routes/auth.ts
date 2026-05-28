import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { authenticate, findUserById, AuthError } from "../services/auth.service.js";
import { COOKIE_NAME, cookieOptions, signToken, verifyToken } from "../utils/jwt.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await authenticate(email, password);
    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = (req as { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sin sesión" } });
      return;
    }
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Token inválido" } });
      return;
    }
    const user = await findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: { code: "USER_NOT_FOUND", message: "Usuario no existe" } });
      return;
    }
    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
});
