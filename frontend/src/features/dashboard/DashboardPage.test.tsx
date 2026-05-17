import "../../test/setup";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import DashboardPage from "./DashboardPage";
import { mockApiRoutes } from "../../test/api";
import { AppProvider } from "../../context/AppProvider";

describe("DashboardPage", () => {
  test("renders welcome message and dashboard widgets for employees", async () => {
    mockApiRoutes([
      {
        path: "/system/bootstrap",
        data: {
          summary: {
            currentEmployee: { firstName: "Taylor", department: { name: "Engineering" } },
            attendanceToday: { status: "PRESENT" },
            employees: 1,
            pendingLeaves: 0,
            teamPresentToday: 1,
            scopedTeamCount: 5,
          },
          notifications: [],
          announcements: [
            {
              id: 1,
              title: "System Update",
              content: "The new dashboard is live.",
              priority: "NORMAL",
              createdAt: new Date().toISOString(),
              createdBy: { firstName: "Admin", lastName: "User", jobTitle: "HR" }
            }
          ],
          exceptions: [],
        },
      },
      { path: "/todos", data: [] },
      { path: "/employees/birthdays/upcoming", data: [] }
    ]);

    render(
      <AppProvider token="token" role="EMPLOYEE">
        <MemoryRouter>
          <DashboardPage token="token" role="EMPLOYEE" />
        </MemoryRouter>
      </AppProvider>
    );

    // Wait for hydration by checking for the welcome greeting
    expect(await screen.findByText(/Taylor/i)).toBeInTheDocument();
    
    // Check for core dashboard elements using stable labels
    expect(screen.getByText(/System Update/i)).toBeInTheDocument();
    expect(screen.getByText(/My Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Engineering Team/i)).toBeInTheDocument();
  });

  test("renders HR dashboard view with stats", async () => {
    mockApiRoutes([
      {
        path: "/system/bootstrap",
        data: {
          summary: {
            currentEmployee: { firstName: "Admin" },
            employees: 50,
            payrollCount: 12,
            pendingLeaves: 5,
            departments: 4,
          },
          notifications: [],
          announcements: [],
          exceptions: [],
        },
      },
      { path: "/todos", data: [] },
      { path: "/employees/birthdays/upcoming", data: [] }
    ]);

    render(
      <AppProvider token="token" role="HR">
        <MemoryRouter>
          <DashboardPage token="token" role="HR" />
        </MemoryRouter>
      </AppProvider>
    );

    // HR dashboard specific banner content
    expect(await screen.findByText(/HR operations/i)).toBeInTheDocument();
    expect(screen.getByText(/Workforce in motion/i)).toBeInTheDocument();
    
    // Check for stats in the dashboard grid
    expect(await screen.findByText("50")).toBeInTheDocument();
    expect(screen.getByText("Employees")).toBeInTheDocument();
    
    // Use specific selector for "12" to avoid collision with analog clock numbers
    const payrollValue = screen.getAllByText("12").find(el => el.tagName === "STRONG");
    expect(payrollValue).toBeInTheDocument();
    expect(screen.getByText("Payroll records")).toBeInTheDocument();
  });
});
