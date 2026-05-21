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

export function getBirthdayWishEmail(recipientName: string, title: string, wishMessage: string, theme: string) {
  let cardStyles = "";
  let titleStyles = "";
  let iconHtml = "🎁";
  
  if (theme === "gold") {
    cardStyles = `
      background: radial-gradient(circle, #222228 0%, #0d0d10 100%);
      border: 2px solid #bf953f;
      color: #e2e8f0;
      padding: 32px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(191, 149, 63, 0.2);
    `;
    titleStyles = `
      color: #fcf6ba;
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 20px;
    `;
    iconHtml = "👑";
  } else if (theme === "neon") {
    cardStyles = `
      background-color: #0c0a0f;
      border: 2px solid #a855f7;
      color: #e4e4e7;
      padding: 32px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(168, 85, 247, 0.2);
    `;
    titleStyles = `
      color: #c084fc;
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 20px;
    `;
    iconHtml = "⚡";
  } else if (theme === "cozy") {
    cardStyles = `
      background: linear-gradient(135deg, #fffaf3 0%, #fff6ea 100%);
      border: 1px solid #f97316;
      color: #451a03;
      padding: 32px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(249, 115, 22, 0.1);
    `;
    titleStyles = `
      color: #ea580c;
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 20px;
    `;
    iconHtml = "🎂";
  } else {
    // Default or Confetti theme
    cardStyles = `
      background: linear-gradient(135deg, #fff5f7 0%, #ffedf1 100%);
      border: 2px solid #fecdd3;
      color: #1e293b;
      padding: 32px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(244, 114, 182, 0.15);
    `;
    titleStyles = `
      color: #be185d;
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 20px;
    `;
    iconHtml = "🎈";
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
      <div style="${cardStyles}">
        <div style="font-size: 40px; margin-bottom: 16px;">${iconHtml}</div>
        <h2 style="${titleStyles}">${title}</h2>
        
        <div style="margin: 24px 0;">
          <div style="display: inline-block; width: 64px; height: 64px; border-radius: 50%; background: #2563eb; color: #ffffff; line-height: 64px; font-size: 22px; font-weight: 700; text-align: center; margin-bottom: 12px;">
            ${recipientName.charAt(0)}
          </div>
          <h3 style="font-size: 18px; font-weight: 700; margin: 0 0 4px 0;">Dear ${recipientName},</h3>
          <p style="font-size: 14px; margin: 0; opacity: 0.85;">A Very Special Member of Our Family</p>
        </div>

        <p style="font-size: 16px; line-height: 1.6; font-style: italic; margin-bottom: 24px;">
          “ ${wishMessage} ”
        </p>

        <div style="border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6;">
          Best Wishes From Team HRMS
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; color: #94a3b8; font-size: 12px;">
        Sent via HRMS Birthday Greeter Studio.
      </div>
    </div>
  `;
}

export function getLeaveApprovedEmail(employeeName: string, leaveType: string, startDate: string, endDate: string, approvedBy: string, link: string) {
  const content = `
    <h2 style="${HEADER_STYLES}">Leave Approved! ✅</h2>
    <p style="font-size: 16px; margin-bottom: 16px;">Hello ${employeeName},</p>
    <p style="font-size: 16px; margin-bottom: 16px;">Your leave request has been approved by <strong>${approvedBy}</strong>.</p>
    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; color: #14532d;"><strong>Type:</strong> ${leaveType}</p>
      <p style="margin: 0 0 8px 0; color: #14532d;"><strong>From:</strong> ${startDate}</p>
      <p style="margin: 0 0 0 0; color: #14532d;"><strong>To:</strong> ${endDate}</p>
    </div>
    <div style="text-align: center;">
      <a href="${link}" style="${BUTTON_STYLES}">View Details</a>
    </div>
  `;
  return wrapInBaseTemplate(content);
}

export function getLeaveRejectedEmail(employeeName: string, leaveType: string, startDate: string, endDate: string, rejectedBy: string, reason: string, link: string) {
  const content = `
    <h2 style="${HEADER_STYLES}">Leave Request Rejected ❌</h2>
    <p style="font-size: 16px; margin-bottom: 16px;">Hello ${employeeName},</p>
    <p style="font-size: 16px; margin-bottom: 16px;">We regret to inform you that your leave request has been rejected by <strong>${rejectedBy}</strong>.</p>
    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; color: #7f1d1d;"><strong>Type:</strong> ${leaveType}</p>
      <p style="margin: 0 0 8px 0; color: #7f1d1d;"><strong>From:</strong> ${startDate}</p>
      <p style="margin: 0 0 8px 0; color: #7f1d1d;"><strong>To:</strong> ${endDate}</p>
      <p style="margin: 8px 0 0 0; color: #7f1d1d; font-style: italic;"><strong>Reason:</strong> ${reason || "No reason provided"}</p>
    </div>
    <div style="text-align: center;">
      <a href="${link}" style="${BUTTON_STYLES}">View Details</a>
    </div>
  `;
  return wrapInBaseTemplate(content);
}
