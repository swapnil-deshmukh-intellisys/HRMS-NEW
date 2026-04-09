import "../../test/setup";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import LeavesPage from "./LeavesPage";
import { mockApiRoutes } from "../../test/api";
import { createEmployee, createLeaveBalance, createLeaveRequest, createLeaveType } from "../../test/fixtures";

describe("LeavesPage", () => {
  test("renders leave requests with manager and HR approval bars", async () => {
    const leave = createLeaveRequest({
      managerApprovalStatus: "PENDING",
      hrApprovalStatus: "REJECTED",
      hrRejectionReason: "Need clarification",
    });

    mockApiRoutes([
      { path: "/leave-balances/me", data: [createLeaveBalance()] },
      { path: "/leaves", data: [leave] },
      { path: "/leave-types", data: [createLeaveType()] },
    ]);

    const { container } = render(
      <LeavesPage
        token="token"
        role="EMPLOYEE"
        currentEmployeeId={1}
        currentEmployee={createEmployee()}
      />,
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
      { path: "/leaves", data: [] },
      { path: "/leave-types", data: [createLeaveType()] },
      {
        path: "/leaves",
        method: "POST",
        status: 400,
        message: "Overlapping leave request already exists",
      },
    ]);

    render(
      <LeavesPage
        token="token"
        role="EMPLOYEE"
        currentEmployeeId={1}
        currentEmployee={createEmployee()}
      />,
    );

    await screen.findByText("Leave requests");
    await user.click(screen.getByRole("button", { name: /apply for leave/i }));
    await user.selectOptions(screen.getByLabelText(/leave type/i), "1");
    await user.type(screen.getByLabelText(/reason/i), "Need a day off");
    await user.click(screen.getByRole("button", { name: /submit leave request/i }));

    expect(await screen.findByText("Overlapping leave request already exists")).toBeInTheDocument();
  });
});
