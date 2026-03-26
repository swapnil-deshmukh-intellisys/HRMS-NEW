import { comparePassword, signToken } from "../../utils/auth.js";
import { AppError } from "../../utils/api.js";

type LoginInput = {
  email: string;
  password: string;
};

type LoginDeps = {
  findUserByEmail: (email: string) => Promise<{
    id: number;
    email: string;
    passwordHash: string;
    isActive: boolean;
    role: { name: string };
    employee?: Record<string, unknown> & { id: number } | null;
  } | null>;
};

export async function loginUser(input: LoginInput, deps: LoginDeps) {
  const user = await deps.findUserByEmail(input.email);

  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials", 401);
  }

  const isValid = await comparePassword(input.password, user.passwordHash);

  if (!isValid) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = signToken({
    userId: user.id,
    role: user.role.name,
    employeeId: user.employee?.id,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role.name,
      employee: user.employee ?? null,
    },
  };
}
