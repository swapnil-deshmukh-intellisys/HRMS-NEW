import "../../test/setup";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import LoginPage from "./LoginPage";
import { mockApiRoutes } from "../../test/api";
import { createSessionUser } from "../../test/fixtures";

describe("LoginPage", () => {
  test("submits credentials and calls onLogin on success", async () => {
    const onLogin = vi.fn();
    const user = userEvent.setup();

    mockApiRoutes([
      {
        path: "/auth/login",
        method: "POST",
        data: {
          token: "token-123",
          user: createSessionUser(),
        },
      },
    ]);

    render(<LoginPage onLogin={onLogin} />);

    await user.type(screen.getByLabelText(/work email/i), "taylor@example.com");
    await user.type(screen.getByLabelText(/^password/i), "Password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(
        "token-123",
        expect.objectContaining({ email: "taylor@example.com" }),
      );
    });
  });

  test("shows an API error message when login fails", async () => {
    const user = userEvent.setup();

    mockApiRoutes([
      {
        path: "/auth/login",
        method: "POST",
        status: 401,
        message: "Invalid credentials",
      },
    ]);

    render(<LoginPage onLogin={vi.fn()} />);

    await user.type(screen.getByLabelText(/work email/i), "taylor@example.com");
    await user.type(screen.getByLabelText(/^password/i), "bad-password");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  });

  test("toggles password visibility", async () => {
    const user = userEvent.setup();

    render(<LoginPage onLogin={vi.fn()} />);

    const passwordInput = screen.getByLabelText(/^password/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(passwordInput).toHaveAttribute("type", "text");
  });
});
