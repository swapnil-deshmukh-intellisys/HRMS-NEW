const BASE_STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1a1a1a;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #f9fafb;
`;

const CARD_STYLES = `
  background-color: #ffffff;
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
`;

const HEADER_STYLES = `
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 24px;
  text-align: center;
`;

const BUTTON_STYLES = `
  display: inline-block;
  background-color: #2563eb;
  color: #ffffff;
  text-decoration: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  margin-top: 24px;
`;

function wrapInBaseTemplate(content: string) {
  return `
    <div style="${BASE_STYLES}">
      <div style="${CARD_STYLES}">
        ${content}
      </div>
      <div style="text-align: center; margin-top: 24px; color: #6b7280; font-size: 12px;">
        This is an automated message from the HRMS. Please do not reply.
      </div>
    </div>
  `;
}

export function getGenericNotificationEmail(title: string, message: string, link?: string) {
  const content = `
    <h2 style="${HEADER_STYLES}">${title}</h2>
    <p style="font-size: 16px; margin-bottom: 16px;">Hello,</p>
    <p style="font-size: 16px; margin-bottom: 24px;">${message}</p>
    ${link ? `<div style="text-align: center;"><a href="${link}" style="${BUTTON_STYLES}">View Details</a></div>` : ''}
  `;
  return wrapInBaseTemplate(content);
}

export function getLeaveRequestEmail(employeeName: string, leaveType: string, startDate: string, endDate: string, link: string) {
  const content = `
    <h2 style="${HEADER_STYLES}">New Leave Request</h2>
    <p style="font-size: 16px; margin-bottom: 16px;">Hello Manager,</p>
    <p style="font-size: 16px; margin-bottom: 16px;"><strong>${employeeName}</strong> has submitted a new leave request.</p>
    <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0;"><strong>Type:</strong> ${leaveType}</p>
      <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${startDate}</p>
      <p style="margin: 0 0 0 0;"><strong>To:</strong> ${endDate}</p>
    </div>
    <div style="text-align: center;">
      <a href="${link}" style="${BUTTON_STYLES}">Review Request</a>
    </div>
  `;
  return wrapInBaseTemplate(content);
}

export function getTaskAssignedEmail(taskTitle: string, assignedBy: string, link: string) {
  const content = `
    <h2 style="${HEADER_STYLES}">New Task Assigned</h2>
    <p style="font-size: 16px; margin-bottom: 16px;">Hello,</p>
    <p style="font-size: 16px; margin-bottom: 16px;">You have been assigned a new task by <strong>${assignedBy}</strong>.</p>
    <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
      <p style="margin: 0; font-weight: 600; font-size: 18px;">${taskTitle}</p>
    </div>
    <div style="text-align: center;">
      <a href="${link}" style="${BUTTON_STYLES}">View Task</a>
    </div>
  `;
  return wrapInBaseTemplate(content);
}

export function getAnnouncementEmail(title: string, priority: string, contentStr: string, link: string) {
  const isHighPriority = priority === "HIGH" || priority === "URGENT";
  const content = `
    <h2 style="${HEADER_STYLES}">${isHighPriority ? '🚨 ' : ''}${title}</h2>
    <div style="margin-bottom: 24px; white-space: pre-wrap; font-size: 16px;">
      ${contentStr}
    </div>
    <div style="text-align: center;">
      <a href="${link}" style="${BUTTON_STYLES}">View Announcement</a>
    </div>
  `;
  return wrapInBaseTemplate(content);
}
