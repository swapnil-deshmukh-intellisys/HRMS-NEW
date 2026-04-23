# Integrate Google Workspace into HRMS Dashboard

The goal is to deeply integrate Google Workspace into the existing HRMS architecture to transform the application into a unified Collaboration Hub. This means enabling automated Meeting generation, automated Calendar blocks, and proactive Google Chat notifications.

## User Review Required

> [!CAUTION]
> Integrating Google Workspace requires creating a **Google Cloud Project**. You will need to obtain an **OAuth Client ID** and **Client Secret**, and enable the Google Calendar, Meet, and Chat APIs in your Google Developer Console before we can fully test the backend.

> [!WARNING]
> We will need to store `Refresh Tokens` in the database to sync events on behalf of the user when they are offline (e.g., when HR approves a leave request at 2 PM, it should push to the employee's calendar even if the employee is not logged into the HRMS).

## Proposed Changes

### Phase 1: Identity & Authentication Foundation
We need to securely link internal user accounts with their corporate Google identities.

#### [MODIFY] `backend/prisma/schema.prisma`
- Add `googleId`, `googleEmail`, `googleRefreshToken`, and `isGoogleLinked` to the `User` model.

#### [NEW] `backend/src/modules/google/`
- Create a dedicated Google module containing OAuth callbacks, authentication handlers, and utility functions wrapping `googleapis`.

#### [MODIFY] `frontend/src/features/employees/EmployeeOverviewTab.tsx`
- Add a new "Integrations" section to the UI with a "Connect Google Workspace" button. This button will trigger the backend OAuth flow.


---

### Phase 2: The Unified Calendar & Meetings
Automate meeting creation and keep schedules perfectly synchronized.

#### [NEW] `backend/src/modules/google/calendar-service.ts`
- Implement push synchronization for Corporate Holidays.
- When HR approves a `LeaveRequest`, automatically create an "Out of Office (O0O)" block on the employee's Google Calendar.

#### [MODIFY] `frontend/src/features/dashboard/EmployeeDashboard.tsx`
- Implement a "Quick Meet" button that uses the backend integration to generate a Google Meet link dynamically for instant syncs.

---

### Phase 3: Proactive Chat Communication
Bring the HRMS to where the users are.

#### [NEW] `backend/src/modules/google/chat-service.ts`
- Implement Webhooks/API calls to send alerts.
- **Trigger**: When an employee submits a `LeaveRequest`, ping the manager directly in Google Chat.
- **Trigger**: Send Friday payroll notifications directly via Chat bot.

#### [MODIFY] `frontend/src/features/employees/EmployeeProfileHeader.tsx`
- Add a "Message on Chat" deep-link button next to the employee's contact details to instantly open a 1-on-1 Google Chat window with them.


## Open Questions

> [!IMPORTANT]
> 1. **Do you currently have a Google Cloud Project set up** for this organization, or would you like me to walk you through how to generate the OAuth credentials?
> 2. For Phase 3, do you want the system to send messages using a **Service Account / Chat Bot** (which requires organizational approval), or using the **User's own account** (which requires heavier OAuth scopes)?

## Verification Plan

### Automated Tests
- Test Google OAuth routing token exchange.
- Test Prisma schema migration.

### Manual Verification
- A user can click "Connect Google Workspace", go through the Google consent screen, and successfully return to the HRMS with their account linked.
- Generating a "Quick Meet" successfully returns a `meet.google.com/...` link.
