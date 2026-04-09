import "../../test/setup";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import DepartmentsPage from "./DepartmentsPage";
import { mockApiRoutes } from "../../test/api";
import { createDepartment } from "../../test/fixtures";

describe("DepartmentsPage", () => {
  test("shows the restriction message for employees", () => {
    render(<DepartmentsPage token="token" role="EMPLOYEE" />);

    expect(screen.getByText("Department management is not available for employees.")).toBeInTheDocument();
  });

  test("renders department data and opens the add department modal for HR", async () => {
    const user = userEvent.setup();

    mockApiRoutes([
      {
        path: "/departments",
        data: [createDepartment(), createDepartment({ id: 2, name: "People", code: "HR" })],
      },
    ]);

    render(<DepartmentsPage token="token" role="HR" />);

    expect(await screen.findByText("Departments")).toBeInTheDocument();
    expect(screen.getByText("Software Development")).toBeInTheDocument();
    expect(screen.getByText("People")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add department/i }));
    expect(screen.getByRole("dialog", { name: /add department/i })).toBeInTheDocument();
  });
});
