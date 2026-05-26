import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.resolve(__dirname, "../../uploads");
const STORAGE_FILE = path.join(STORAGE_DIR, "email-templates.json");

export interface GlobalStyles {
  BASE_STYLES: string;
  CARD_STYLES: string;
  HEADER_STYLES: string;
  BUTTON_STYLES: string;
}

export interface EmailTemplateConfig {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
  raw?: boolean;
}

export interface TemplatesData {
  globalStyles: GlobalStyles;
  templates: Record<string, EmailTemplateConfig>;
}

// Factory Default Global Styles
const DEFAULT_GLOBAL_STYLES: GlobalStyles = {
  BASE_STYLES: `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
color: #1a1a1a;
line-height: 1.6;
max-width: 600px;
margin: 0 auto;
padding: 20px;
background-color: #f9fafb;`,
  CARD_STYLES: `background-color: #ffffff;
border-radius: 8px;
padding: 32px;
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);`,
  HEADER_STYLES: `font-size: 24px;
font-weight: 700;
color: #111827;
margin-bottom: 24px;
text-align: center;`,
  BUTTON_STYLES: `display: inline-block;
background-color: #2563eb;
color: #ffffff;
text-decoration: none;
padding: 12px 24px;
border-radius: 6px;
font-weight: 600;
margin-top: 24px;`,
};

// Factory Default Templates
const DEFAULT_TEMPLATES: Record<string, EmailTemplateConfig> = {
  generic_notification: {
    id: "generic_notification",
    name: "Generic Notification",
    description: "Used for general system alerts and generic notifications.",
    subject: "{{title}}",
    variables: ["title", "message", "link"],
    raw: true,
    body: `<h2 style="{{HEADER_STYLES}}">{{title}}</h2>
<p style="font-size: 16px; margin-bottom: 16px;">Hello,</p>
<p style="font-size: 16px; margin-bottom: 24px;">{{message}}</p>
{{#if link}}
<div style="text-align: center;">
  <a href="{{link}}" style="{{BUTTON_STYLES}}">View Details</a>
</div>
{{/if}}`,
  },
  leave_request: {
    id: "leave_request",
    name: "New Leave Request",
    description: "Dispatched to managers/HR when an employee submits a leave request.",
    subject: "New Leave Request 📅",
    variables: ["employeeName", "leaveType", "startDate", "endDate", "link", "reason", "durationDays", "formattedRange", "isSingleDay"],
    raw: true,
    body: `<style>
  @media only screen and (max-width: 600px) {
    .mob-bg-container {
      padding: 0 !important;
    }
    .mob-outer-wrapper {
      border-radius: 0 !important;
      border-left: none !important;
      border-right: none !important;
      border-top: none !important;
      border-bottom: none !important;
    }
  }
  @media only screen and (max-width: 480px) {
    .mob-header-div {
      padding: 12px 14px !important;
    }
    .mob-icon-box {
      width: 36px !important;
      height: 36px !important;
      font-size: 18px !important;
      line-height: 36px !important;
      border-radius: 8px !important;
    }
    .mob-icon-td {
      width: 36px !important;
    }
    .mob-header-text {
      padding-left: 8px !important;
    }
    .mob-header-h2 {
      font-size: 15px !important;
    }
    .mob-header-sub {
      font-size: 10px !important;
    }
    .mob-badge-td {
      display: none !important;
    }
    .mob-card-body {
      padding: 16px 14px !important;
    }
    .mob-greeting {
      font-size: 14px !important;
    }
    .mob-intro {
      font-size: 13px !important;
      margin-bottom: 16px !important;
    }
    .mob-info-card {
      padding: 14px 12px !important;
      border-radius: 10px !important;
      margin-bottom: 16px !important;
    }
    .mob-label {
      font-size: 9px !important;
    }
    .mob-type-badge {
      font-size: 11px !important;
      padding: 3px 8px !important;
    }
    .mob-date-val {
      font-size: 12px !important;
    }
    .mob-reason-text {
      font-size: 12px !important;
    }
    .mob-duration-strip {
      padding: 10px 12px !important;
      margin-bottom: 16px !important;
    }
    .mob-duration-text {
      font-size: 11.5px !important;
      white-space: normal !important;
      word-break: break-word !important;
    }
    .mob-cta-btn {
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
      padding: 12px 16px !important;
      font-size: 13px !important;
      border-radius: 10px !important;
    }
    .mob-footer-div {
      padding: 10px 14px !important;
    }
    .mob-footer-text {
      font-size: 10px !important;
    }
    .mob-footer-link a {
      font-size: 10px !important;
    }
  }
</style>

<div class="mob-bg-container" style="background-color: #e8ede9; padding: 24px 16px; min-height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; box-sizing: border-box;">
  <div class="mob-outer-wrapper" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #d4dbd5; box-sizing: border-box;">

    <!-- Header -->
    <div class="mob-header-div" style="background-color: #0f291e; padding: 16px 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="mob-icon-td" style="width: 40px; vertical-align: middle;">
            <div class="mob-icon-box" style="background-color: rgba(255,255,255,0.08); width: 40px; height: 40px; border-radius: 10px; line-height: 40px; text-align: center; font-size: 20px;">📄</div>
          </td>
          <td class="mob-header-text" style="padding-left: 10px; vertical-align: middle;">
            <h2 class="mob-header-h2" style="margin: 0; font-size: 18px; color: #ffffff; font-weight: 700; line-height: 1.2;">Leave Request</h2>
            <p class="mob-header-sub" style="margin: 3px 0 0 0; font-size: 11px; color: #a3b899; line-height: 1; font-weight: 500;">Requires your review</p>
          </td>
          <td class="mob-badge-td" style="text-align: right; vertical-align: middle; width: 80px;">
            <span style="background-color: rgba(16,185,129,0.1); color: #34d399; font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; border: 1px solid rgba(16,185,129,0.3); white-space: nowrap;">PENDING</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div class="mob-card-body" style="padding: 24px 20px 20px 20px;">
      <p class="mob-greeting" style="margin: 0 0 10px 0; font-size: 15px; color: #1e2a22; font-weight: 600; line-height: 1.3;">Hello,</p>
      <p class="mob-intro" style="margin: 0 0 20px 0; font-size: 14px; color: #2e3d33; line-height: 1.6;">
        <strong>{{employeeName}}</strong> has submitted a new leave request and is awaiting your approval.
      </p>

      <!-- Info Card -->
      <div class="mob-info-card" style="background-color: #f7faf8; border: 1px solid #e1eae4; border-radius: 14px; padding: 16px; margin-bottom: 20px;">
        {{#if isSingleDay}}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 6px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #3a5f4b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">TYPE</span>
              <span class="mob-type-badge" style="background-color: #e6f7ed; color: #11693c; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; border: 1px solid #c2edd5; display: inline-block; white-space: nowrap;">📅 {{leaveType}}</span>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 6px; padding-top: 2px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #3a5f4b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">DATE</span>
              <span class="mob-date-val" style="font-size: 13px; font-weight: 600; color: #1a2b21;">{{startDate}}</span>
            </td>
          </tr>
        </table>
        {{/if}}
        {{#unless isSingleDay}}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <tr>
            <td colspan="2" style="vertical-align: top; padding-bottom: 14px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #3a5f4b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">TYPE</span>
              <span class="mob-type-badge" style="background-color: #e6f7ed; color: #11693c; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; border: 1px solid #c2edd5; display: inline-block; white-space: nowrap;">📅 {{leaveType}}</span>
            </td>
          </tr>
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 6px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #3a5f4b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">FROM</span>
              <span class="mob-date-val" style="font-size: 13px; font-weight: 600; color: #1a2b21;">{{startDate}}</span>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 6px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #3a5f4b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">TO</span>
              <span class="mob-date-val" style="font-size: 13px; font-weight: 600; color: #1a2b21;">{{endDate}}</span>
            </td>
          </tr>
        </table>
        {{/unless}}
        <div style="border-top: 1px solid #e1eae4; margin-bottom: 14px;"></div>
        <div>
          <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #3a5f4b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 7px;">REASON FOR LEAVE</span>
          <div style="border-left: 3px solid #11693c; padding-left: 10px;">
            <p class="mob-reason-text" style="margin: 0; font-size: 13px; color: #3a4e43; font-style: italic; line-height: 1.5;">{{#if reason}}{{reason}}{{/if}}{{#unless reason}}No reason specified.{{/unless}}</p>
          </div>
        </div>
      </div>

      <!-- Duration Strip -->
      <div class="mob-duration-strip" style="background-color: #fff9f0; border: 1px solid #fcebcf; border-radius: 10px; padding: 10px 14px; margin-bottom: 20px;">
        <span class="mob-duration-text" style="font-size: 13px; font-weight: 600; color: #a26b23;">🕒 Duration: {{durationDays}} days &nbsp;&middot;&nbsp; {{formattedRange}}</span>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a class="mob-cta-btn" href="{{link}}" style="display: inline-block; background-color: #11693c; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(17,105,60,0.2);">Review Request</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="mob-footer-div" style="background-color: #f9fafb; border-top: 1px solid #e1eae4; padding: 14px 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="mob-footer-text" style="font-size: 11px; color: #6e7d75; font-weight: 500; vertical-align: middle;">🛡️ Sent via <strong>IntelliHRMS Portal</strong></td>
        </tr>
      </table>
    </div>

  </div>
</div>`,
  },
  leave_approved: {
    id: "leave_approved",
    name: "Leave Approved",
    description: "Sent to employees notifying them that their leave request has been fully approved (both manager & HR sign-off complete).",
    subject: "Leave Approved! ✅",
    variables: ["employeeName", "leaveType", "startDate", "endDate", "approvedBy", "link", "durationDays", "formattedRange", "isSingleDay"],
    raw: true,
    body: `<style>
  @media only screen and (max-width: 600px) {
    .mob-bg-container {
      padding: 0 !important;
    }
    .mob-outer-wrapper {
      border-radius: 0 !important;
      border-left: none !important;
      border-right: none !important;
      border-top: none !important;
      border-bottom: none !important;
    }
  }
  @media only screen and (max-width: 480px) {
    .mob-header-div {
      padding: 12px 14px !important;
    }
    .mob-icon-box {
      width: 36px !important;
      height: 36px !important;
      font-size: 18px !important;
      line-height: 36px !important;
      border-radius: 8px !important;
    }
    .mob-icon-td {
      width: 36px !important;
    }
    .mob-header-text {
      padding-left: 8px !important;
    }
    .mob-header-h2 {
      font-size: 15px !important;
    }
    .mob-header-sub {
      font-size: 10px !important;
    }
    .mob-badge-td {
      display: none !important;
    }
    .mob-card-body {
      padding: 16px 14px !important;
    }
    .mob-greeting {
      font-size: 14px !important;
    }
    .mob-intro {
      font-size: 13px !important;
      margin-bottom: 16px !important;
    }
    .mob-info-card {
      padding: 14px 12px !important;
      border-radius: 10px !important;
      margin-bottom: 16px !important;
    }
    .mob-label {
      font-size: 9px !important;
    }
    .mob-type-badge {
      font-size: 11px !important;
      padding: 3px 8px !important;
    }
    .mob-date-val {
      font-size: 12px !important;
    }
    .mob-cta-btn {
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
      padding: 12px 16px !important;
      font-size: 13px !important;
      border-radius: 10px !important;
    }
    .mob-footer-div {
      padding: 10px 14px !important;
    }
    .mob-footer-text {
      font-size: 10px !important;
    }
    .mob-footer-link a {
      font-size: 10px !important;
    }
  }
</style>

<div class="mob-bg-container" style="background-color: #e8ede9; padding: 24px 16px; min-height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; box-sizing: border-box;">
  <div class="mob-outer-wrapper" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #d4dbd5; box-sizing: border-box;">

    <!-- Header -->
    <div class="mob-header-div" style="background-color: #11693c; padding: 16px 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="mob-icon-td" style="width: 40px; vertical-align: middle;">
            <div class="mob-icon-box" style="background-color: rgba(255,255,255,0.08); width: 40px; height: 40px; border-radius: 10px; line-height: 40px; text-align: center; font-size: 20px;">✅</div>
          </td>
          <td class="mob-header-text" style="padding-left: 10px; vertical-align: middle;">
            <h2 class="mob-header-h2" style="margin: 0; font-size: 18px; color: #ffffff; font-weight: 700; line-height: 1.2;">Leave Approved</h2>
            <p class="mob-header-sub" style="margin: 3px 0 0 0; font-size: 11px; color: #a7f3d0; line-height: 1; font-weight: 500;">Your leave is confirmed</p>
          </td>
          <td class="mob-badge-td" style="text-align: right; vertical-align: middle; width: 80px;">
            <span style="background-color: rgba(16,185,129,0.1); color: #34d399; font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; border: 1px solid rgba(16,185,129,0.3); white-space: nowrap;">APPROVED</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div class="mob-card-body" style="padding: 24px 20px 20px 20px;">
      <p class="mob-greeting" style="margin: 0 0 10px 0; font-size: 15px; color: #1e2a22; font-weight: 600; line-height: 1.3;">Hello {{employeeName}},</p>
      <p class="mob-intro" style="margin: 0 0 20px 0; font-size: 14px; color: #2e3d33; line-height: 1.6;">Your leave request has been fully approved. Enjoy your time off! 🎉</p>

      <!-- Info Card -->
      <div class="mob-info-card" style="background-color: #f2faf5; border: 1px solid #d2e7db; border-radius: 14px; padding: 16px; margin-bottom: 20px;">
        {{#if isSingleDay}}
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 6px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #2b5c43; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">TYPE</span>
              <span class="mob-type-badge" style="background-color: #e2f4ea; color: #0f7642; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; border: 1px solid #c2e8d3; display: inline-block; white-space: nowrap;">📅 {{leaveType}}</span>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 6px; padding-top: 2px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #2b5c43; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">DATE</span>
              <span class="mob-date-val" style="font-size: 13px; font-weight: 600; color: #0e291b;">{{startDate}}</span>
            </td>
          </tr>
        </table>
        {{/if}}
        {{#unless isSingleDay}}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <tr>
            <td colspan="2" style="vertical-align: top; padding-bottom: 14px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #2b5c43; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">TYPE</span>
              <span class="mob-type-badge" style="background-color: #e2f4ea; color: #0f7642; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; border: 1px solid #c2e8d3; display: inline-block; white-space: nowrap;">📅 {{leaveType}}</span>
            </td>
          </tr>
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 6px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #2b5c43; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">FROM</span>
              <span class="mob-date-val" style="font-size: 13px; font-weight: 600; color: #0e291b;">{{startDate}}</span>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 6px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #2b5c43; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">TO</span>
              <span class="mob-date-val" style="font-size: 13px; font-weight: 600; color: #0e291b;">{{endDate}}</span>
            </td>
          </tr>
        </table>
        {{/unless}}
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a class="mob-cta-btn" href="{{link}}" style="display: inline-block; background-color: #11693c; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(17,105,60,0.2);">View Details</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="mob-footer-div" style="background-color: #f9fafb; border-top: 1px solid #e1eae4; padding: 14px 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="mob-footer-text" style="font-size: 11px; color: #6e7d75; font-weight: 500; vertical-align: middle;">🛡️ Sent via <strong>IntelliHRMS Portal</strong></td>
        </tr>
      </table>
    </div>

  </div>
</div>`,
  },
  leave_rejected: {
    id: "leave_rejected",
    name: "Leave Rejected",
    description: "Sent to employees notifying them that their leave request has been rejected.",
    subject: "Leave Request Rejected ❌",
    variables: ["employeeName", "leaveType", "startDate", "endDate", "rejectedBy", "reason", "link", "durationDays", "formattedRange", "isSingleDay"],
    raw: true,
    body: `<style>
  @media only screen and (max-width: 600px) {
    .mob-bg-container {
      padding: 0 !important;
    }
    .mob-outer-wrapper {
      border-radius: 0 !important;
      border-left: none !important;
      border-right: none !important;
      border-top: none !important;
      border-bottom: none !important;
    }
  }
  @media only screen and (max-width: 480px) {
    .mob-header-div {
      padding: 12px 14px !important;
    }
    .mob-icon-box {
      width: 36px !important;
      height: 36px !important;
      font-size: 18px !important;
      line-height: 36px !important;
      border-radius: 8px !important;
    }
    .mob-icon-td {
      width: 36px !important;
    }
    .mob-header-text {
      padding-left: 8px !important;
    }
    .mob-header-h2 {
      font-size: 15px !important;
    }
    .mob-header-sub {
      font-size: 10px !important;
    }
    .mob-badge-td {
      display: none !important;
    }
    .mob-card-body {
      padding: 16px 14px !important;
    }
    .mob-greeting {
      font-size: 14px !important;
    }
    .mob-intro {
      font-size: 13px !important;
      margin-bottom: 16px !important;
    }
    .mob-info-card {
      padding: 14px 12px !important;
      border-radius: 10px !important;
      margin-bottom: 16px !important;
    }
    .mob-label {
      font-size: 9px !important;
    }
    .mob-type-badge {
      font-size: 11px !important;
      padding: 3px 8px !important;
    }
    .mob-date-val {
      font-size: 12px !important;
    }
    .mob-reason-text {
      font-size: 12px !important;
    }
    .mob-cta-btn {
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
      padding: 12px 16px !important;
      font-size: 13px !important;
      border-radius: 10px !important;
    }
    .mob-footer-div {
      padding: 10px 14px !important;
    }
    .mob-footer-text {
      font-size: 10px !important;
    }
    .mob-footer-link a {
      font-size: 10px !important;
    }
  }
</style>

<div class="mob-bg-container" style="background-color: #e8ede9; padding: 24px 16px; min-height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; box-sizing: border-box;">
  <div class="mob-outer-wrapper" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #d4dbd5; box-sizing: border-box;">

    <!-- Header -->
    <div class="mob-header-div" style="background-color: #991b1b; padding: 16px 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="mob-icon-td" style="width: 40px; vertical-align: middle;">
            <div class="mob-icon-box" style="background-color: rgba(255,255,255,0.08); width: 40px; height: 40px; border-radius: 10px; line-height: 40px; text-align: center; font-size: 20px;">❌</div>
          </td>
          <td class="mob-header-text" style="padding-left: 10px; vertical-align: middle;">
            <h2 class="mob-header-h2" style="margin: 0; font-size: 18px; color: #ffffff; font-weight: 700; line-height: 1.2;">Leave Rejected</h2>
            <p class="mob-header-sub" style="margin: 3px 0 0 0; font-size: 11px; color: #fecdd3; line-height: 1; font-weight: 500;">Rejected by {{rejectedBy}}</p>
          </td>
          <td class="mob-badge-td" style="text-align: right; vertical-align: middle; width: 80px;">
            <span style="background-color: rgba(239,68,68,0.1); color: #f87171; font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; border: 1px solid rgba(239,68,68,0.3); white-space: nowrap;">REJECTED</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div class="mob-card-body" style="padding: 24px 20px 20px 20px;">
      <p class="mob-greeting" style="margin: 0 0 10px 0; font-size: 15px; color: #1e2a22; font-weight: 600; line-height: 1.3;">Hello {{employeeName}},</p>
      <p class="mob-intro" style="margin: 0 0 20px 0; font-size: 14px; color: #2e3d33; line-height: 1.6;">We regret to inform you that your leave request has been rejected by <strong>{{rejectedBy}}</strong>.</p>

      <!-- Info Card -->
      <div class="mob-info-card" style="background-color: #fff5f5; border: 1px solid #fee2e2; border-radius: 14px; padding: 16px; margin-bottom: 20px;">
        {{#if isSingleDay}}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 6px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">TYPE</span>
              <span class="mob-type-badge" style="background-color: #ffe4e6; color: #b91c1c; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; border: 1px solid #fecdd3; display: inline-block; white-space: nowrap;">📅 {{leaveType}}</span>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 6px; padding-top: 2px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">DATE</span>
              <span class="mob-date-val" style="font-size: 13px; font-weight: 600; color: #7f1d1d;">{{startDate}}</span>
            </td>
          </tr>
        </table>
        {{/if}}
        {{#unless isSingleDay}}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
          <tr>
            <td colspan="2" style="vertical-align: top; padding-bottom: 14px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">TYPE</span>
              <span class="mob-type-badge" style="background-color: #ffe4e6; color: #b91c1c; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px; border: 1px solid #fecdd3; display: inline-block; white-space: nowrap;">📅 {{leaveType}}</span>
            </td>
          </tr>
          <tr>
            <td style="width: 50%; vertical-align: top; padding-right: 6px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">FROM</span>
              <span class="mob-date-val" style="font-size: 13px; font-weight: 600; color: #7f1d1d;">{{startDate}}</span>
            </td>
            <td style="width: 50%; vertical-align: top; padding-left: 6px;">
              <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">TO</span>
              <span class="mob-date-val" style="font-size: 13px; font-weight: 600; color: #7f1d1d;">{{endDate}}</span>
            </td>
          </tr>
        </table>
        {{/unless}}
        <div style="border-top: 1px solid #fee2e2; margin-bottom: 14px;"></div>
        <div>
          <span class="mob-label" style="display: block; font-size: 9.5px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 7px;">REASON FOR REJECTION</span>
          <div style="border-left: 3px solid #991b1b; padding-left: 10px;">
            <p class="mob-reason-text" style="margin: 0; font-size: 13px; color: #7f1d1d; font-style: italic; line-height: 1.5;">{{#if reason}}{{reason}}{{/if}}{{#unless reason}}No reason specified.{{/unless}}</p>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a class="mob-cta-btn" href="{{link}}" style="display: inline-block; background-color: #991b1b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(153,27,27,0.2);">View Details</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="mob-footer-div" style="background-color: #f9fafb; border-top: 1px solid #e1eae4; padding: 14px 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="mob-footer-text" style="font-size: 11px; color: #6e7d75; font-weight: 500; vertical-align: middle;">🛡️ Sent via <strong>IntelliHRMS Portal</strong></td>
        </tr>
      </table>
    </div>

  </div>
</div>`,
  },
  colleague_birthday: {
    id: "colleague_birthday",
    name: "Colleague Birthday Announcement",
    description: "Sent to team members announcing a colleague's birthday to encourage them to share wishes.",
    subject: "Today is {{colleagueName}}'s birthday! 🎂🎉",
    variables: ["colleagueName", "employeeName", "link"],
    raw: true,
    body: `<style>
  @media only screen and (max-width: 600px) {
    .mob-bg-container {
      padding: 0 !important;
    }
    .mob-outer-wrapper {
      border-radius: 0 !important;
      border-left: none !important;
      border-right: none !important;
      border-top: none !important;
      border-bottom: none !important;
    }
  }
  @media only screen and (max-width: 480px) {
    .mob-header-div {
      padding: 16px 14px !important;
    }
    .mob-icon-box {
      width: 36px !important;
      height: 36px !important;
      font-size: 18px !important;
      line-height: 36px !important;
      border-radius: 8px !important;
    }
    .mob-icon-td {
      width: 36px !important;
    }
    .mob-header-text {
      padding-left: 8px !important;
    }
    .mob-header-h2 {
      font-size: 15px !important;
    }
    .mob-header-sub {
      font-size: 10px !important;
    }
    .mob-card-body {
      padding: 16px 14px !important;
    }
    .mob-greeting {
      font-size: 14px !important;
    }
    .mob-intro {
      font-size: 13px !important;
      margin-bottom: 16px !important;
    }
    .mob-info-card {
      padding: 14px 12px !important;
      border-radius: 10px !important;
      margin-bottom: 16px !important;
    }
    .mob-label {
      font-size: 9px !important;
    }
    .mob-colleague-badge {
      font-size: 13px !important;
      padding: 4px 10px !important;
    }
    .mob-duration-strip {
      padding: 10px 12px !important;
      margin-bottom: 16px !important;
    }
    .mob-duration-text {
      font-size: 11.5px !important;
    }
    .mob-cta-btn {
      display: block !important;
      width: 100% !important;
      box-sizing: border-box !important;
      padding: 12px 16px !important;
      font-size: 13px !important;
      border-radius: 10px !important;
    }
    .mob-footer-div {
      padding: 10px 14px !important;
    }
    .mob-footer-text {
      font-size: 10px !important;
    }
  }
</style>

<div class="mob-bg-container" style="background-color: #e8ede9; padding: 24px 16px; min-height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; box-sizing: border-box;">
  <div class="mob-outer-wrapper" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #d4dbd5; box-sizing: border-box;">

    <!-- Header -->
    <div class="mob-header-div" style="background-color: #0f291e; padding: 18px 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="mob-icon-td" style="width: 40px; vertical-align: middle;">
            <div class="mob-icon-box" style="background-color: rgba(255,255,255,0.08); width: 40px; height: 40px; border-radius: 10px; line-height: 40px; text-align: center; font-size: 20px;">🎉</div>
          </td>
          <td class="mob-header-text" style="padding-left: 10px; vertical-align: middle;">
            <h2 class="mob-header-h2" style="margin: 0; font-size: 18px; color: #ffffff; font-weight: 700; line-height: 1.2;">Colleague's Birthday!</h2>
            <p class="mob-header-sub" style="margin: 3px 0 0 0; font-size: 11px; color: #a3b899; line-height: 1; font-weight: 500;">Join the celebration</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div class="mob-card-body" style="padding: 24px 20px 20px 20px;">
      <p class="mob-greeting" style="margin: 0 0 10px 0; font-size: 15px; color: #1e2a22; font-weight: 600; line-height: 1.3;">Hello Team,</p>
      <p class="mob-intro" style="margin: 0 0 20px 0; font-size: 14px; color: #2e3d33; line-height: 1.6;">
        Today is a very special day! Let's celebrate our wonderful colleague's birthday.
      </p>

      <!-- Colleague Card -->
      <div class="mob-info-card" style="background-color: #f7faf8; border: 1px solid #e1eae4; border-radius: 14px; padding: 20px; margin-bottom: 20px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 12px;">🎂</div>
        <span class="mob-colleague-badge" style="background-color: #e6f7ed; color: #11693c; font-size: 16px; font-weight: 700; padding: 6px 14px; border-radius: 10px; border: 1px solid #c2edd5; display: inline-block;">
          {{colleagueName}}
        </span>
        <p style="margin: 10px 0 0 0; font-size: 13px; color: #4b5d52; font-weight: 500;">Wishing them a fantastic year ahead! 🎈</p>
      </div>

      <!-- Wishes strip -->
      <div class="mob-duration-strip" style="background-color: #fff9f0; border: 1px solid #fcebcf; border-radius: 10px; padding: 12px 14px; margin-bottom: 20px; text-align: center;">
        <span class="mob-duration-text" style="font-size: 13px; font-weight: 600; color: #a26b23;">💬 Drop a warm note to say Happy Birthday!</span>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center;">
        <a class="mob-cta-btn" href="{{link}}" style="display: inline-block; background-color: #11693c; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(17,105,60,0.2);">Write Wishes</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="mob-footer-div" style="background-color: #f9fafb; border-top: 1px solid #e1eae4; padding: 14px 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td class="mob-footer-text" style="font-size: 11px; color: #6e7d75; font-weight: 500; vertical-align: middle;">🛡️ Sent via <strong>IntelliHRMS Portal</strong></td>
        </tr>
      </table>
    </div>

  </div>
</div>`,
  },
  announcement: {
    id: "announcement",
    name: "Announcement",
    description: "Sent to all employees when a priority announcement is published.",
    subject: "{{title}}",
    variables: ["title", "priority", "contentStr", "link", "isHighPriority"],
    body: `<h2 style="{{HEADER_STYLES}}">{{#if isHighPriority}}🚨 {{/if}}{{title}}</h2>
<div style="margin-bottom: 24px; white-space: pre-wrap; font-size: 16px;">
  {{contentStr}}
</div>
<div style="text-align: center;">
  <a href="{{link}}" style="{{BUTTON_STYLES}}">View Announcement</a>
</div>`,
  },
  birthday_wish: {
    id: "birthday_wish",
    name: "Birthday Wishes",
    description: "Sent to employees on their birthday with visual styling based on their selected theme.",
    subject: "[Preview Test] Birthday Wishes for {{recipientName}}! 🎂",
    variables: ["recipientName", "title", "wishMessage", "theme", "recipientInitials", "cardStyles", "titleStyles", "iconHtml"],
    raw: true,
    body: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc;">
  <div style="{{cardStyles}}">
    <div style="font-size: 40px; margin-bottom: 16px;">{{iconHtml}}</div>
    <h2 style="{{titleStyles}}">{{title}}</h2>
    
    <div style="margin: 24px 0;">
      <div style="display: inline-block; width: 64px; height: 64px; border-radius: 50%; background: #2563eb; color: #ffffff; line-height: 64px; font-size: 22px; font-weight: 700; text-align: center; margin-bottom: 12px;">
        {{recipientInitials}}
      </div>
      <h3 style="font-size: 18px; font-weight: 700; margin: 0 0 4px 0;">Dear {{recipientName}},</h3>
      <p style="font-size: 14px; margin: 0; opacity: 0.85;">A Very Special Member of Our Family</p>
    </div>

    <p style="font-size: 16px; line-height: 1.6; font-style: italic; margin-bottom: 24px;">
      “ {{wishMessage}} ”
    </p>

    <div style="border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6;">
      Best Wishes From Team Intellisys
    </div>
  </div>
  <div style="text-align: center; margin-top: 24px; color: #94a3b8; font-size: 12px;">
    Sent via IntelliHRMS
  </div>
</div>`,
  },
};

class EmailTemplateService {
  private cache: TemplatesData = {
    globalStyles: { ...DEFAULT_GLOBAL_STYLES },
    templates: {},
  };

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      // Create directories if they do not exist
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      }

      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        
        this.cache.globalStyles = {
          ...DEFAULT_GLOBAL_STYLES,
          ...(parsed.globalStyles || {}),
        };

        this.cache.templates = {};
        let changed = false;
        for (const [key, value] of Object.entries(DEFAULT_TEMPLATES)) {
          const custom = parsed.templates?.[key] || {};
          this.cache.templates[key] = {
            ...value,
            ...custom,
            id: key, // Ensure ID cannot be overridden incorrectly
          };

          // Auto-migration: if the hardcoded default in DEFAULT_TEMPLATES is different from what's stored on disk,
          // automatically overwrite with the new code default for primary templates to enable rapid tweaking.
          if (custom.body !== value.body && (key === "leave_request" || key === "leave_approved" || key === "leave_rejected" || key === "colleague_birthday")) {
            this.cache.templates[key].body = value.body;
            changed = true;
          }
          if (custom.subject !== value.subject && (key === "colleague_birthday")) {
            this.cache.templates[key].subject = value.subject;
            changed = true;
          }
          if (JSON.stringify(custom.variables) !== JSON.stringify(value.variables)) {
            this.cache.templates[key].variables = value.variables;
            changed = true;
          }
          if (custom.raw !== value.raw) {
            this.cache.templates[key].raw = value.raw;
            changed = true;
          }
        }
        if (changed) {
          this.saveToDisk();
        }
      } else {
        // First run, populate cache with defaults and write to disk
        this.cache.globalStyles = { ...DEFAULT_GLOBAL_STYLES };
        this.cache.templates = { ...DEFAULT_TEMPLATES };
        this.saveToDisk();
      }
    } catch (error) {
      console.error("Failed to initialize EmailTemplateService:", error);
      // Fallback in-memory
      this.cache.globalStyles = { ...DEFAULT_GLOBAL_STYLES };
      this.cache.templates = { ...DEFAULT_TEMPLATES };
    }
  }

  private saveToDisk() {
    try {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(this.cache, null, 2), "utf-8");
    } catch (error) {
      console.error("Failed to write email-templates.json to disk:", error);
    }
  }

  public getTemplates(): TemplatesData {
    return this.cache;
  }

  public getTemplate(id: string): EmailTemplateConfig | undefined {
    return this.cache.templates[id];
  }

  public getGlobalStyles(): GlobalStyles {
    return this.cache.globalStyles;
  }

  public updateGlobalStyles(styles: Partial<GlobalStyles>) {
    this.cache.globalStyles = {
      ...this.cache.globalStyles,
      ...styles,
    };
    this.saveToDisk();
    return this.cache.globalStyles;
  }

  public updateTemplate(id: string, updates: { subject?: string; body?: string }) {
    const template = this.cache.templates[id];
    if (!template) {
      throw new Error(`Template with id ${id} not found.`);
    }

    if (updates.subject !== undefined) {
      template.subject = updates.subject;
    }
    if (updates.body !== undefined) {
      template.body = updates.body;
    }

    this.saveToDisk();
    return template;
  }

  public resetTemplate(id: string) {
    const defaultTemplate = DEFAULT_TEMPLATES[id];
    if (!defaultTemplate) {
      throw new Error(`Template with id ${id} not found.`);
    }

    this.cache.templates[id] = { ...defaultTemplate };
    this.saveToDisk();
    return this.cache.templates[id];
  }

  public resetGlobalStyles() {
    this.cache.globalStyles = { ...DEFAULT_GLOBAL_STYLES };
    this.saveToDisk();
    return this.cache.globalStyles;
  }

  /**
   * Helper that wraps custom body content inside the global template HTML skeleton
   */
  public wrapInBaseTemplate(content: string): string {
    const { BASE_STYLES, CARD_STYLES } = this.cache.globalStyles;
    return `
      <div style="${BASE_STYLES}">
        <div style="${CARD_STYLES}">
          ${content}
        </div>
        <div style="text-align: center; margin-top: 24px; color: #6b7280; font-size: 12px;">
          This is an automated message from IntelliHRMS. Please do not reply.
        </div>
      </div>
    `;
  }

  /**
   * Compiles and renders a specific template by resolving variables, conditionals, and global styles
   */
  public render(id: string, variables: Record<string, any>): { subject: string; html: string } {
    const template = this.cache.templates[id];
    if (!template) {
      throw new Error(`Template ${id} does not exist.`);
    }

    // 1. Prepare rendering variables (inject CSS variables and pre-computed fields)
    const { BASE_STYLES, CARD_STYLES, HEADER_STYLES, BUTTON_STYLES } = this.cache.globalStyles;
    
    // Merge standard style vars so they can be injected easily
    const renderVars: Record<string, any> = {
      ...variables,
      BASE_STYLES,
      CARD_STYLES,
      HEADER_STYLES,
      BUTTON_STYLES,
    };

    // Special pre-computing for Birthday wishes if not supplied
    if (id === "birthday_wish" && variables.theme) {
      const theme = variables.theme;
      const recipientName = variables.recipientName || "Valued Employee";
      if (!renderVars.recipientInitials) {
        renderVars.recipientInitials = recipientName.charAt(0).toUpperCase();
      }

      if (theme === "gold") {
        renderVars.cardStyles = `background: radial-gradient(circle, #222228 0%, #0d0d10 100%); border: 2px solid #bf953f; color: #e2e8f0; padding: 32px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(191, 149, 63, 0.2);`;
        renderVars.titleStyles = `color: #fcf6ba; font-size: 26px; font-weight: 800; margin-bottom: 20px;`;
        renderVars.iconHtml = "👑";
      } else if (theme === "neon") {
        renderVars.cardStyles = `background-color: #0c0a0f; border: 2px solid #a855f7; color: #e4e4e7; padding: 32px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(168, 85, 247, 0.2);`;
        renderVars.titleStyles = `color: #c084fc; font-size: 26px; font-weight: 800; margin-bottom: 20px;`;
        renderVars.iconHtml = "⚡";
      } else if (theme === "cozy") {
        renderVars.cardStyles = `background: linear-gradient(135deg, #fffaf3 0%, #fff6ea 100%); border: 1px solid #f97316; color: #451a03; padding: 32px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(249, 115, 22, 0.1);`;
        renderVars.titleStyles = `color: #ea580c; font-size: 26px; font-weight: 800; margin-bottom: 20px;`;
        renderVars.iconHtml = "🎂";
      } else {
        // default pink / confetti
        renderVars.cardStyles = `background: linear-gradient(135deg, #fff5f7 0%, #ffedf1 100%); border: 2px solid #fecdd3; color: #1e293b; padding: 32px; border-radius: 12px; text-align: center; box-shadow: 0 10px 25px rgba(244, 114, 182, 0.15);`;
        renderVars.titleStyles = `color: #be185d; font-size: 26px; font-weight: 800; margin-bottom: 20px;`;
        renderVars.iconHtml = "🎈";
      }
    }

    // Special pre-computing for Announcements
    if (id === "announcement" && variables.priority) {
      const priority = variables.priority;
      renderVars.isHighPriority = priority === "HIGH" || priority === "URGENT";
    }

    // Special pre-computing for Leave Request, Leave Approved, and Leave Rejected
    if (id === "leave_request" || id === "leave_approved" || id === "leave_rejected") {
      try {
        const start = new Date(variables.startDate || "2026-05-23");
        const end = new Date(variables.endDate || "2026-05-24");
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        renderVars.durationDays = diffDays;
        renderVars.isSingleDay = (variables.startDate === variables.endDate) || (diffDays === 1);

        const formatOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
        const startStr = start.toLocaleDateString('en-US', formatOptions);
        const endStr = end.toLocaleDateString('en-US', formatOptions);
        
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();
        let range = "";
        if (startYear === endYear) {
          const startMonthDay = start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          range = `${startMonthDay} – ${endStr}`;
        } else {
          range = `${startStr} – ${endStr}`;
        }
        renderVars.formattedRange = range;
      } catch (err) {
        renderVars.durationDays = 2;
        renderVars.isSingleDay = false;
        renderVars.formattedRange = "May 23 – May 24, 2026";
      }
    }

    // Special pre-computing / aliasing for colleague_birthday to support both colleagueName and employeeName
    if (id === "colleague_birthday") {
      const name = variables.colleagueName || variables.employeeName || "Colleague";
      renderVars.colleagueName = name;
      renderVars.employeeName = name;
    }

    // 2. Compile subject & body HTML
    const renderedSubject = this.parseTemplateTokens(template.subject, renderVars);
    const bodyHtml = this.parseTemplateTokens(template.body, renderVars);

    // 3. Wrap in global styles layout skeleton (except raw templates, which provide their own full wrappers)
    const finalHtml = template.raw ? bodyHtml : this.wrapInBaseTemplate(bodyHtml);

    return {
      subject: renderedSubject,
      html: finalHtml,
    };
  }

  /**
   * Extremely lightweight, ultra-reliable regex-based mustache template engine
   */
  private parseTemplateTokens(rawString: string, variables: Record<string, any>): string {
    let rendered = rawString;

    // 1. Parse Block Conditionals {{#if key}} content {{/if}}
    // Supports matching whitespace inside if
    const ifRegex = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    rendered = rendered.replace(ifRegex, (match, key, content) => {
      const value = this.resolveObjectPath(variables, key);
      return value ? content : "";
    });

    // 2. Parse Block Negative Conditionals {{#unless key}} content {{/unless}}
    const unlessRegex = /\{\{#unless\s+([\w.]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;
    rendered = rendered.replace(unlessRegex, (match, key, content) => {
      const value = this.resolveObjectPath(variables, key);
      return !value ? content : "";
    });

    // 3. Parse Standard Token Placeholders {{key}}
    const tokenRegex = /\{\{([\w.]+)\}\}/g;
    rendered = rendered.replace(tokenRegex, (match, key) => {
      const value = this.resolveObjectPath(variables, key);
      return value !== undefined ? String(value) : "";
    });

    return rendered;
  }

  /**
   * Resolves nested dot-notation object paths securely (e.g. user.firstName)
   */
  private resolveObjectPath(obj: Record<string, any>, pathStr: string): any {
    return pathStr.split(".").reduce((acc, part) => {
      if (acc && typeof acc === "object") {
        return acc[part];
      }
      return undefined;
    }, obj);
  }
}

export const emailTemplateService = new EmailTemplateService();
