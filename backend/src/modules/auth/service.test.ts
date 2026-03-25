import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { AppError } from "../../utils/api.js";
import { loginUser } from "./service.js";

test("loginUser returns token payload for valid active user", async () => {
  const passwordHash = await bcrypt.hash("Password@123", 10);

  const result = await loginUser(
    { email: "admin@hrms.local", password: "Password@123" },
    {
      findUserByEmail: async () => ({
        id: 1,
        email: "admin@hrms.local",
        passwordHash,
        isActive: true,
        role: { name: "ADMIN" },
        employee: { id: 101 },
      }),
    },
  );

  assert.equal(result.user.email, "admin@hrms.local");
  assert.equal(result.user.role, "ADMIN");
  assert.ok(result.token);
});

test("loginUser rejects inactive user", async () => {
  const passwordHash = await bcrypt.hash("Password@123", 10);

  await assert.rejects(
    () =>
      loginUser(
        { email: "inactive@hrms.local", password: "Password@123" },
        {
          findUserByEmail: async () => ({
            id: 2,
            email: "inactive@hrms.local",
            passwordHash,
            isActive: false,
            role: { name: "EMPLOYEE" },
            employee: { id: 202 },
          }),
        },
      ),
    (error: unknown) => error instanceof AppError && error.message === "Invalid credentials",
  );
});
