import "../../test/setup";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import LeavesPage from "./LeavesPage";
import { mockApiRoutes } from "../../test/api";
import { createLeaveBalance, createLeaveRequest, createLeaveType, createEmployee } from "../../test/fixtures";

// Exactly 26 words to pass validation
const validLeaveReason = "I am requesting a planned leave to attend to important family responsibilities and complete necessary personal documentation tasks. I will ensure all my work is properly handed over.";

describe("LeavesPage", () => {
  test("renders leave requests with manager and HR approval bars", async () => {
    const leave = createLeaveRequest({
      managerApprovalStatus: "PENDING",
      hrApprovalStatus: "REJECTED",
      hrRejectionReason: "Need clarification",
      employee: createEmployee({ id: 1 }),
      status: "PENDING"
    });

    mockApiRoutes([
      { path: "/leave-balances/me", data: [createLeaveBalance()] },
      { path: "/leaves", data: [leave], method: "GET" },
      { path: "/leave-types", data: [createLeaveType()] },
    ]);

    const { container } = render(
      <MemoryRouter>
        <LeavesPage
          token="token"
          role="EMPLOYEE"
          currentEmployeeId={1}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Leave requests")).toBeInTheDocument();
    const progress = container.querySelector('.leave-status-progress[title="Manager: PENDING, HR: REJECTED"]');
    expect(progress).not.toBeNull();
    expect(progress?.querySelectorAll(".leave-status-progress__step")).toHaveLength(2);
    expect(within(progress as HTMLElement).getByText("Mgr / HR")).toBeInTheDocument();
  });

  test("surfaces duplicate overlap errors from leave submission", async () => {
    const user = userEvent.setup();
    mockApiRoutes([
      { path: "/leave-balances/me", data: [createLeaveBalance()] },
      { path: "/leaves", data: [], method: "GET" },
      { path: "/leave-types", data: [createLeaveType()] },
      {
        path: "/leaves",
        method: "POST",
        status: 400,
        message: "Overlapping leave request already exists",
      },
    ]);

    render(
      <MemoryRouter>
        <Toaster />
        <LeavesPage
          token="token"
          role="EMPLOYEE"
          currentEmployeeId={1}
        />
      </MemoryRouter>,
    );

    await screen.findByText("Leave requests");
    fireEvent.click(screen.getByRole("button", { name: /apply for leave/i }));
    
    const typeBtn = await screen.findByRole("button", { name: /select leave type/i });
    fireEvent.click(typeBtn);
    fireEvent.click(await screen.findByRole("option", { name: /casual leave/i }));
    
    const reasonInput = screen.getByLabelText(/reason/i);
    fireEvent.change(reasonInput, { target: { value: validLeaveReason } });
    
    const submitBtn = screen.getByRole("button", { name: /submit leave request/i });
    // Ensure the button is not disabled (meaning validation passed)
    expect(submitBtn).not.toBeDisabled();
    
    await user.click(submitBtn);

    // With Toaster present, the error message from toast.error should appear in the DOM
    expect(await screen.findByText("Overlapping leave request already exists", {}, { timeout: 8000 })).toBeInTheDocument();
  });

  test("shows medical proof actions for approved long sick leave", async () => {
    const leave = createLeaveRequest({
      status: "APPROVED",
      leaveType: createLeaveType({ code: "SL", name: "Sick Leave" }),
      medicalProofRequired: true,
      medicalProofStatus: "PENDING_UPLOAD",
      medicalProofDueAt: "2026-04-12T10:00:00.000Z",
      employee: createEmployee({ id: 1 })
    });

    mockApiRoutes([
      { path: "/leave-balances/me", data: [createLeaveBalance()] },
      { path: "/leaves", data: [leave], method: "GET" },
      { path: "/leave-types", data: [createLeaveType()] },
    ]);

    render(
      <MemoryRouter>
        <LeavesPage
          token="token"
          role="EMPLOYEE"
          currentEmployeeId={1}
        />
      </MemoryRouter>,
    );

    await screen.findByText("Leave requests");
    
    const allTab = await screen.findByRole("button", { name: /all/i });
    fireEvent.click(allTab);

    const viewBtn = await screen.findByRole("button", { name: /^view$/i });
    fireEvent.click(viewBtn);

    expect(await screen.findByText(/proof upload pending/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /upload proof/i })[0]).toBeInTheDocument();
  });

  test("retains multiple days leave tab when changing start date to match end date", async () => {
    mockApiRoutes([
      { path: "/leave-balances/me", data: [createLeaveBalance()] },
      { path: "/leaves", data: [], method: "GET" },
      { path: "/leave-types", data: [createLeaveType()] },
    ]);

    render(
      <MemoryRouter>
        <LeavesPage
          token="token"
          role="EMPLOYEE"
          currentEmployeeId={1}
        />
      </MemoryRouter>,
    );

    await screen.findByText("Leave requests");
    fireEvent.click(screen.getByRole("button", { name: /apply for leave/i }));

    // Click on Multiple Days Leave tab
    const multiDaysTab = await screen.findByRole("button", { name: /multiple days leave/i });
    fireEvent.click(multiDaysTab);

    // Verify Start date and End date fields are rendered
    const startDateInput = screen.getByLabelText(/start date/i) as HTMLInputElement;
    const endDateInput = screen.getByLabelText(/end date/i) as HTMLInputElement;
    expect(startDateInput).toBeInTheDocument();
    expect(endDateInput).toBeInTheDocument();

    // Change start date to some date equal to or after the current end date
    const initialEndDate = endDateInput.value;
    fireEvent.change(startDateInput, { target: { value: initialEndDate } });

    // Verify we are still on Multiple Days Leave tab (both fields are still present)
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/leave date/i)).not.toBeInTheDocument();
  });
});
