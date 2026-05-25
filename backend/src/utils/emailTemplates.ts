import { emailTemplateService } from "../services/emailTemplateService.js";

export function getGenericNotificationEmail(title: string, message: string, link?: string) {
  const result = emailTemplateService.render("generic_notification", {
    title,
    message,
    link,
  });
  return result.html;
}

export function getLeaveRequestEmail(
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  link: string,
  reason?: string
) {
  const result = emailTemplateService.render("leave_request", {
    employeeName,
    leaveType,
    startDate,
    endDate,
    link,
    reason,
  });
  return result.html;
}

export function getColleagueBirthdayEmail(colleagueName: string, link: string) {
  const result = emailTemplateService.render("colleague_birthday", {
    colleagueName,
    link,
  });
  return result.html;
}

export function getAnnouncementEmail(title: string, priority: string, contentStr: string, link: string) {
  const result = emailTemplateService.render("announcement", {
    title,
    priority,
    contentStr,
    link,
  });
  return result.html;
}

export function getBirthdayWishEmail(recipientName: string, title: string, wishMessage: string, theme: string) {
  const result = emailTemplateService.render("birthday_wish", {
    recipientName,
    title,
    wishMessage,
    theme,
  });
  return result.html;
}

export function getLeaveApprovedEmail(
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  approvedBy: string,
  link: string
) {
  const result = emailTemplateService.render("leave_approved", {
    employeeName,
    leaveType,
    startDate,
    endDate,
    approvedBy,
    link,
  });
  return result.html;
}

export function getLeaveRejectedEmail(
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  rejectedBy: string,
  reason: string,
  link: string
) {
  const result = emailTemplateService.render("leave_rejected", {
    employeeName,
    leaveType,
    startDate,
    endDate,
    rejectedBy,
    reason,
    link,
  });
  return result.html;
}
