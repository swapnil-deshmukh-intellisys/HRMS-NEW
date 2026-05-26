import "../../test/setup";
import { screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import EmployeeProfilePage from "./EmployeeProfilePage";
import { mockApiRoutes } from "../../test/api";
import { createAttendance, createEmployee, createLeaveBalance, createLeaveRequest } from "../../test/fixtures";
import { renderWithRoute } from "../../test/utils";
import { AppProvider } from "../../context/AppProvider";

describe("EmployeeProfilePage", () => {
  test("hides the payroll tab when the viewer should not access payroll", async () => {
    const employee = createEmployee({ id: 5, firstName: "Ava", lastName: "Stone" });

    mockApiRoutes([
      { path: /\/employees\/5$/, data: employee },
      { path: /\/attendance/, data: [createAttendance({ employeeId: 5, employee })] },
      { path: /\/leave-balances\/me/, data: [createLeaveBalance()] },
      { path: /\/leaves/, data: [createLeaveRequest({ employee })] },
      { path: /\/calendar/, data: { exceptions: [] } },
    ]);

    renderWithRoute(
      <AppProvider token="token" role="EMPLOYEE">
        <EmployeeProfilePage token="token" role="EMPLOYEE" currentEmployeeId={99} />
      </AppProvider>,
      { route: "/employees/5", path: "/employees/:id" },
    );

    expect(await screen.findByText("Ava Stone")).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /payroll/i })).not.toBeInTheDocument();
    expect(await screen.findByText("Employment")).toBeInTheDocument();
    expect(screen.queryByText("Integrations & Connectivity")).not.toBeInTheDocument();
  });

  test("does not show attendance dates before the employee joining date", async () => {
    // Joining date is 2026-05-08 (May 8, 2026)
    const employee = createEmployee({ 
      id: 5, 
      firstName: "Ava", 
      lastName: "Stone",
      joiningDate: "2026-05-08T09:00:00.000Z"
    });

    // Mock API responses
    mockApiRoutes([
      { path: /\/employees\/5$/, data: employee },
      { 
        path: /\/attendance/, 
        data: [
          // Attendance record after joining date (May 11, 2026)
          createAttendance({ 
            id: 10,
            employeeId: 5, 
            employee,
            attendanceDate: "2026-05-11T10:00:00.000Z"
          }),
          // Attendance record before joining date (May 6, 2026)
          createAttendance({ 
            id: 11,
            employeeId: 5, 
            employee,
            attendanceDate: "2026-05-06T10:00:00.000Z"
          })
        ] 
      },
      { path: /\/leave-balances\/me/, data: [createLeaveBalance()] },
      { path: /\/leaves/, data: [createLeaveRequest({ employee })] },
      { path: /\/calendar/, data: { exceptions: [] } },
    ]);

    renderWithRoute(
      <AppProvider token="token" role="EMPLOYEE">
        <EmployeeProfilePage token="token" role="EMPLOYEE" currentEmployeeId={99} />
      </AppProvider>,
      { route: "/employees/5", path: "/employees/:id" },
    );

    expect(await screen.findByText("Ava Stone")).toBeInTheDocument();

    // Switch to Attendance tab
    const attendanceTab = await screen.findByRole("tab", { name: /attendance/i });
    fireEvent.click(attendanceTab);

    // Date on or after joining date should be present
    expect(await screen.findByText("11 May 2026")).toBeInTheDocument();

    // Date before joining date should not be present
    expect(screen.queryByText("6 May 2026")).not.toBeInTheDocument();
  });

  test("only displays available months from the joining month onwards when the joining year is selected", async () => {
    // Joining date is 2026-05-08 (May 8, 2026)
    const employee = createEmployee({ 
      id: 5, 
      firstName: "Ava", 
      lastName: "Stone",
      joiningDate: "2026-05-08T09:00:00.000Z"
    });

    mockApiRoutes([
      { path: /\/employees\/5$/, data: employee },
      { path: /\/attendance/, data: [] },
      { path: /\/leave-balances\/me/, data: [createLeaveBalance()] },
      { path: /\/leaves/, data: [createLeaveRequest({ employee })] },
      { path: /\/calendar/, data: { exceptions: [] } },
    ]);

    const { container } = renderWithRoute(
      <AppProvider token="token" role="EMPLOYEE">
        <EmployeeProfilePage token="token" role="EMPLOYEE" currentEmployeeId={99} />
      </AppProvider>,
      { route: "/employees/5", path: "/employees/:id" },
    );

    expect(await screen.findByText("Ava Stone")).toBeInTheDocument();

    // Switch to Attendance tab
    const attendanceTab = await screen.findByRole("tab", { name: /attendance/i });
    fireEvent.click(attendanceTab);

    // Query dropdowns
    const dropdowns = container.querySelectorAll(".month-selector-dropdown");
    const monthDropdown = dropdowns[0] as HTMLSelectElement;
    expect(monthDropdown).toBeInTheDocument();

    // The options inside the month dropdown
    const options = Array.from(monthDropdown.options).map(opt => opt.text);

    // Should contain May onwards
    expect(options).toContain("May");
    expect(options).toContain("December");

    // Should NOT contain January to April
    expect(options).not.toContain("January");
    expect(options).not.toContain("April");
  });

  test("highlights the employee joining day in the attendance list with a colored row and badge", async () => {
    // Joining date is 2026-05-08 (May 8, 2026)
    const employee = createEmployee({ 
      id: 5, 
      firstName: "Ava", 
      lastName: "Stone",
      joiningDate: "2026-05-08T09:00:00.000Z"
    });

    mockApiRoutes([
      { path: /\/employees\/5$/, data: employee },
      { 
        path: /\/attendance/, 
        data: [
          createAttendance({ 
            id: 10,
            employeeId: 5, 
            employee,
            attendanceDate: "2026-05-08T10:00:00.000Z"
          })
        ] 
      },
      { path: /\/leave-balances\/me/, data: [createLeaveBalance()] },
      { path: /\/leaves/, data: [createLeaveRequest({ employee })] },
      { path: /\/calendar/, data: { exceptions: [] } },
    ]);

    const { container } = renderWithRoute(
      <AppProvider token="token" role="EMPLOYEE">
        <EmployeeProfilePage token="token" role="EMPLOYEE" currentEmployeeId={99} />
      </AppProvider>,
      { route: "/employees/5", path: "/employees/:id" },
    );

    expect(await screen.findByText("Ava Stone")).toBeInTheDocument();

    // Switch to Attendance tab
    const attendanceTab = await screen.findByRole("tab", { name: /attendance/i });
    fireEvent.click(attendanceTab);

    // Verify the row has the 'attendance-row--joining-day' class
    const joiningRow = container.querySelector(".attendance-row--joining-day");
    expect(joiningRow).toBeInTheDocument();
    expect(within(joiningRow as HTMLElement).getByText("Joined")).toBeInTheDocument();
    expect(within(joiningRow as HTMLElement).getByText("8 May 2026")).toBeInTheDocument();
  });

  test("shows attendance records before 1st April 2026 as 'No Data Available' and excludes them from calculations", async () => {
    // Joining date is 2026-03-15 (March 15, 2026)
    const employee = createEmployee({ 
      id: 5, 
      firstName: "Ava", 
      lastName: "Stone",
      joiningDate: "2026-03-15T09:00:00.000Z"
    });

    mockApiRoutes([
      { path: /\/employees\/5$/, data: employee },
      { 
        path: /\/attendance/, 
        data: [
          // Attendance record before April 1st cutoff (e.g. March 20, 2026)
          createAttendance({ 
            id: 12,
            employeeId: 5, 
            employee,
            attendanceDate: "2026-03-20T10:00:00.000Z",
            status: "PRESENT",
            checkInTime: "09:00:00",
            checkOutTime: "18:00:00"
          }),
          // Attendance record after April 1st cutoff (e.g. April 10, 2026)
          createAttendance({ 
            id: 13,
            employeeId: 5, 
            employee,
            attendanceDate: "2026-04-10T10:00:00.000Z",
            status: "PRESENT",
            checkInTime: "09:00:00",
            checkOutTime: "18:00:00"
          })
        ] 
      },
      { path: /\/leave-balances\/me/, data: [createLeaveBalance()] },
      { path: /\/leaves/, data: [createLeaveRequest({ employee })] },
      { path: /\/calendar/, data: { exceptions: [] } },
    ]);

    const { container } = renderWithRoute(
      <AppProvider token="token" role="EMPLOYEE">
        <EmployeeProfilePage token="token" role="EMPLOYEE" currentEmployeeId={99} />
      </AppProvider>,
      { route: "/employees/5", path: "/employees/:id" },
    );

    expect(await screen.findByText("Ava Stone")).toBeInTheDocument();

    // Switch to Attendance tab
    const attendanceTab = await screen.findByRole("tab", { name: /attendance/i });
    fireEvent.click(attendanceTab);

    // Let's change the dropdown month to look at March 2026
    const dropdowns = container.querySelectorAll(".month-selector-dropdown");
    const monthDropdown = dropdowns[0] as HTMLSelectElement;
    expect(monthDropdown).toBeInTheDocument();

    // Select March (value 2, since January is 0, February is 1, March is 2)
    fireEvent.change(monthDropdown, { target: { value: "2" } });

    // Wait for the records in March to load. A date in March (e.g. 20 March 2026) should be shown
    expect(await screen.findByText("20 Mar 2026")).toBeInTheDocument();

    // Verify its status is "No Data Available" instead of "Present" (since it is before April 1st 2026)
    // Find the row containing "20 Mar 2026"
    const rowEl = screen.getByText("20 Mar 2026").closest("tr");
    expect(rowEl).toBeInTheDocument();
    expect(within(rowEl as HTMLElement).getByText("No Data Available")).toBeInTheDocument();

    // The working hours / duration details should be blank or "-" in this row
    expect(within(rowEl as HTMLElement).queryByText("09:00")).not.toBeInTheDocument();

    // Verify monthly summary counts for March are 0 since everything in March is before April 1st
    const summaryContainer = screen.getByText("Working Days").parentElement?.parentElement;
    expect(summaryContainer).toBeInTheDocument();
    expect(within(summaryContainer as HTMLElement).getByText("Working Days").nextSibling?.textContent).toBe("0");
    expect(within(summaryContainer as HTMLElement).getByText("Present").nextSibling?.textContent).toBe("0");
  });
});
