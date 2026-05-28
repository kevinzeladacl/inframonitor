import bcrypt from "bcrypt";
import { UserModel, type IUser } from "@inframonitor/database";

export class AuthError extends Error {
  status = 401;
  code = "AUTH_FAILED";
  constructor(message = "Credenciales inválidas") {
    super(message);
  }
}

export async function authenticate(
  email: string,
  password: string
): Promise<IUser> {
  const user = await UserModel.findOne({ email: email.toLowerCase(), deletedAt: null });
  if (!user) throw new AuthError();
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AuthError();
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function findUserById(id: string): Promise<IUser | null> {
  return UserModel.findOne({ id, deletedAt: null });
}
