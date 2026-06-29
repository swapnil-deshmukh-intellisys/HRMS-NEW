import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType,
  BorderStyle, ShadingType, TableLayoutType,
  PageBreak, Header, Footer, PageNumber,
  convertInchesToTwip, VerticalAlign,
  CheckBox,
} from 'docx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const outputPath = path.join(rootDir, 'HRMS_Testing_Guide.docx');

// ─── Color Palette ─────────────────────────────────────────────────────────
const COLORS = {
  navyBlue:    '0D2137',
  cobaltBlue:  '1565C0',
  skyBlue:     '42A5F5',
  lightBlue:   'E3F2FD',
  teal:        '00796B',
  tealLight:   'E0F2F1',
  amber:       'F57F17',
  amberLight:  'FFF8E1',
  red:         'B71C1C',
  redLight:    'FFEBEE',
  green:       '1B5E20',
  greenLight:  'E8F5E9',
  tableHeader: '1E3A5F',
  rowAlt:      'F0F6FF',
  rowWhite:    'FFFFFF',
  grey:        '546E7A',
  lightGrey:   'F5F7FA',
  orange:      'E65100',
  orangeLight: 'FFF3E0',
  purple:      '4A148C',
  purpleLight: 'F3E5F5',
};

const border = (style: any = BorderStyle.SINGLE, size = 4, color = 'CCCCCC') =>
  ({ style, size, color });

function pageTitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 56, color: COLORS.navyBlue, font: 'Calibri' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  });
}

function moduleBanner(title: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `  🧪  ${title}`, bold: true, size: 36, color: COLORS.rowWhite, font: 'Calibri' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 400, after: 200 },
    shading: { type: ShadingType.SOLID, color: COLORS.cobaltBlue, fill: COLORS.cobaltBlue },
    indent: { left: 200 },
  });
}

function sectionSubhead(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `▸  ${text}`, bold: true, size: 24, color: COLORS.cobaltBlue, font: 'Calibri' })],
    spacing: { before: 280, after: 80 },
    indent: { left: 200 },
  });
}

function infoBox(lines: string[], color: string = COLORS.lightBlue, borderColor: string = COLORS.skyBlue): Paragraph[] {
  return lines.map((line, i) => new Paragraph({
    children: [new TextRun({ text: line, size: 18, color: COLORS.navyBlue, font: 'Calibri' })],
    spacing: { before: i === 0 ? 80 : 40, after: i === lines.length - 1 ? 80 : 0 },
    indent: { left: 400, right: 400 },
    shading: { type: ShadingType.SOLID, color, fill: color },
    border: {
      left: { style: BorderStyle.THICK, size: 12, color: borderColor },
    }
  }));
}

function badge(label: string, color: string): TextRun {
  return new TextRun({ text: ` ${label} `, bold: true, size: 16, color: COLORS.rowWhite,
    shading: { type: ShadingType.SOLID, color, fill: color }, font: 'Calibri' });
}

function priorityBadge(p: string): TextRun {
  const map: Record<string, string> = {
    CRITICAL: COLORS.red, HIGH: COLORS.orange, MEDIUM: COLORS.cobaltBlue, LOW: COLORS.grey
  };
  return badge(p, map[p] || COLORS.grey);
}

function severityBadge(s: string): TextRun {
  const map: Record<string, string> = {
    BLOCKER: COLORS.red, MAJOR: COLORS.amber, MINOR: COLORS.teal, TRIVIAL: COLORS.grey
  };
  return badge(s, map[s] || COLORS.grey);
}

interface TC {
  id: string;
  feature: string;
  pre: string;
  steps: string;
  expected: string;
  priority: string;
  severity: string;
  note?: string;
}

function tcCard(tc: TC, index: number): (Paragraph | Table)[] {
  const rowShade = index % 2 === 0 ? COLORS.rowWhite : COLORS.rowAlt;

  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [
            new TextRun({ text: tc.id, bold: true, size: 20, color: COLORS.rowWhite, font: 'Calibri' }),
            new TextRun({ text: '   ' }),
            new TextRun({ text: tc.feature, bold: true, size: 20, color: COLORS.lightBlue, font: 'Calibri' }),
          ],
          spacing: { before: 60, after: 60 },
          indent: { left: 100 },
        })],
        shading: { type: ShadingType.SOLID, color: COLORS.tableHeader, fill: COLORS.tableHeader },
        columnSpan: 2,
        borders: { top: border(BorderStyle.NONE), bottom: border(BorderStyle.SINGLE, 4, COLORS.skyBlue), left: border(BorderStyle.NONE), right: border(BorderStyle.NONE) },
        verticalAlign: VerticalAlign.CENTER,
      })
    ]
  });

  const makeRow = (label: string, content: string, shade: string = rowShade) => {
    const stepLines = content.split('\n').filter(s => s.trim());
    const runs: TextRun[] = [];
    stepLines.forEach((s, i) => {
      if (i > 0) runs.push(new TextRun({ text: '\n', break: 1, font: 'Calibri' } as any));
      runs.push(new TextRun({ text: s.trim(), size: 18, color: COLORS.navyBlue, font: 'Calibri' }));
    });

    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 17, color: COLORS.cobaltBlue, font: 'Calibri' })],
            spacing: { before: 60, after: 60 },
            indent: { left: 80 },
          })],
          width: { size: 22, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.SOLID, color: shade, fill: shade },
          borders: { top: border(), bottom: border(), left: border(BorderStyle.NONE), right: border(BorderStyle.SINGLE, 2, COLORS.skyBlue) },
        }),
        new TableCell({
          children: [new Paragraph({
            children: runs,
            spacing: { before: 60, after: 60 },
            indent: { left: 80 },
          })],
          width: { size: 78, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.SOLID, color: rowShade, fill: rowShade },
          borders: { top: border(), bottom: border(), left: border(BorderStyle.NONE), right: border(BorderStyle.NONE) },
        }),
      ]
    });
  };

  const statusRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'Priority: ', bold: true, size: 17, color: COLORS.cobaltBlue, font: 'Calibri' }),
            priorityBadge(tc.priority),
            new TextRun({ text: '     Severity: ', bold: true, size: 17, color: COLORS.cobaltBlue, font: 'Calibri' }),
            severityBadge(tc.severity),
            new TextRun({ text: '     Result:   ', bold: true, size: 17, color: COLORS.cobaltBlue, font: 'Calibri' }),
            
            // Native CheckBox export from docx
            new CheckBox(),
            new TextRun({ text: ' PASS    ', size: 17, color: COLORS.navyBlue, font: 'Calibri' }),
            new CheckBox(),
            new TextRun({ text: ' FAIL    ', size: 17, color: COLORS.navyBlue, font: 'Calibri' }),
            new CheckBox(),
            new TextRun({ text: ' SKIP', size: 17, color: COLORS.navyBlue, font: 'Calibri' }),
          ],
          spacing: { before: 80, after: 80 },
          indent: { left: 80 },
        })],
        columnSpan: 2,
        shading: { type: ShadingType.SOLID, color: COLORS.lightGrey, fill: COLORS.lightGrey },
        borders: { top: border(BorderStyle.SINGLE, 4, COLORS.skyBlue), bottom: border(BorderStyle.SINGLE, 6, COLORS.cobaltBlue), left: border(BorderStyle.NONE), right: border(BorderStyle.NONE) },
      })
    ]
  });

  const bugRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'Bug ID: ________________     ', size: 17, color: COLORS.grey, font: 'Calibri' }),
            new TextRun({ text: 'Remarks: ________________________________________________', size: 17, color: COLORS.grey, font: 'Calibri' }),
          ],
          spacing: { before: 60, after: 60 },
          indent: { left: 80 },
        })],
        columnSpan: 2,
        shading: { type: ShadingType.SOLID, color: COLORS.rowWhite, fill: COLORS.rowWhite },
        borders: { top: border(BorderStyle.NONE), bottom: border(BorderStyle.DOUBLE, 6, COLORS.cobaltBlue), left: border(BorderStyle.NONE), right: border(BorderStyle.NONE) },
      })
    ]
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: border(BorderStyle.SINGLE, 6, COLORS.cobaltBlue),
      bottom: border(BorderStyle.NONE),
      left: border(BorderStyle.SINGLE, 6, COLORS.cobaltBlue),
      right: border(BorderStyle.SINGLE, 2, COLORS.cobaltBlue),
      insideH: border(BorderStyle.SINGLE, 2, 'DDDDDD'),
      insideV: border(BorderStyle.NONE),
    },
    rows: [
      headerRow,
      makeRow('📋 What to test', tc.feature),
      makeRow('⚙️ Before you start', tc.pre),
      makeRow('👣 Steps to follow', tc.steps),
      makeRow('✅ What should happen', tc.expected),
      statusRow,
      bugRow,
    ],
  });

  return [
    new Paragraph({ spacing: { before: 180, after: 0 } }),
    table,
  ];
}

// ─── Cover Page ────────────────────────────────────────────────────────────
function coverPage(): (Paragraph | Table)[] {
  return [
    new Paragraph({ spacing: { before: 800 } }),
    pageTitle('HRMS Application'),
    new Paragraph({
      children: [new TextRun({ text: 'Manual Testing Guide', bold: true, size: 72, color: COLORS.cobaltBlue, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', size: 28, color: COLORS.skyBlue, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Version 1.0  |  June 2026  |  Pre-Production QA', size: 22, color: COLORS.grey, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 },
    }),
    new Table({
      width: { size: 80, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: { top: border(), bottom: border(), left: border(), right: border(), insideH: border(), insideV: border() },
      rows: [
        new TableRow({ children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'TEST ACCOUNT CREDENTIALS', bold: true, size: 22, color: COLORS.rowWhite, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 } })],
            columnSpan: 2, shading: { type: ShadingType.SOLID, color: COLORS.cobaltBlue, fill: COLORS.cobaltBlue },
            borders: { top: border(BorderStyle.NONE), bottom: border(BorderStyle.SINGLE, 4, COLORS.skyBlue), left: border(BorderStyle.NONE), right: border(BorderStyle.NONE) },
          })
        ]}),
        ...[
          ['Email (Login ID)', 'testuser@intellisys.com'],
          ['Password', 'Test@1234'],
          ['Role', 'Employee (Limited access)'],
          ['Name', 'Test User'],
          ['Employee Code', 'TEST-001'],
          ['Admin Credentials', 'Use your existing Admin login'],
        ].map(([label, val], i) => new TableRow({ children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, color: COLORS.cobaltBlue, font: 'Calibri' })], indent: { left: 120 }, spacing: { before: 60, after: 60 } })],
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? COLORS.lightBlue : COLORS.rowWhite, fill: i % 2 === 0 ? COLORS.lightBlue : COLORS.rowWhite },
            borders: { top: border(), bottom: border(), left: border(BorderStyle.NONE), right: border() },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: val, size: 18, color: COLORS.navyBlue, font: 'Calibri' })], indent: { left: 120 }, spacing: { before: 60, after: 60 } })],
            width: { size: 65, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? COLORS.lightBlue : COLORS.rowWhite, fill: i % 2 === 0 ? COLORS.lightBlue : COLORS.rowWhite },
            borders: { top: border(), bottom: border(), left: border(), right: border(BorderStyle.NONE) },
          }),
        ]})),
      ],
    }),
    new Paragraph({ spacing: { before: 300 } }),
    ...infoBox([
      '📌  How to use this guide:',
      '   1. Open this document in Microsoft Word.',
      '   2. Follow the steps exactly as written — no technical knowledge required.',
      '   3. Double-click on any checkbox shaded box to toggle it checked/unchecked!',
      '   4. If something goes wrong, note the Bug ID and write what happened in Remarks.',
      '   5. A tester with no coding background can fully execute this guide.',
    ], COLORS.tealLight, COLORS.teal),
    new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }),
  ];
}

// ─── MODULE DATA ────────────────────────────────────────────────────────────
const MODULES: { title: string; subtitle?: string; intro?: string; sections: { name: string; tcs: TC[] }[] }[] = [
  {
    title: 'MODULE 1 — Login & Account Access',
    intro: 'These tests check whether users can log in and log out correctly, and whether the app properly protects pages from unauthorized access.',
    sections: [
      {
        name: 'Logging In',
        tcs: [
          { id: 'TC-AUTH-001', feature: 'Correct login works', pre: 'The app is open in your browser (e.g. localhost:5173)', steps: '1. Open the app in your browser.\n2. In the Email field, type: testuser@intellisys.com\n3. In the Password field, type: Test@1234\n4. Click the "Sign In" button.', expected: 'You are taken to the Dashboard page. Your name or avatar appears in the top-right corner.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-AUTH-002', feature: 'Wrong password shows an error', pre: 'The app login page is open', steps: '1. Type the correct email: testuser@intellisys.com\n2. Type any wrong password, e.g. wrongpass\n3. Click "Sign In".', expected: 'A red error message appears saying something like "Invalid credentials". You are NOT logged in.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-AUTH-003', feature: 'Empty email field is blocked', pre: 'The login page is open', steps: '1. Leave the Email field completely empty.\n2. Type any password.\n3. Click "Sign In".', expected: 'A small red warning appears near the email field. The app does NOT try to log in.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-AUTH-004', feature: 'Empty password field is blocked', pre: 'The login page is open', steps: '1. Type a valid email.\n2. Leave the Password field empty.\n3. Click "Sign In".', expected: 'A warning appears near the password field. The app does NOT try to log in.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-AUTH-005', feature: 'Email typed in wrong format is rejected', pre: 'The login page is open', steps: '1. In the Email field, type: notanemail (no @ or .com)\n2. Type any password.\n3. Click "Sign In".', expected: 'The app shows a message like "Please enter a valid email address". It does not proceed.', priority: 'MEDIUM', severity: 'MINOR' },
          { id: 'TC-AUTH-006', feature: 'Non-existent account is rejected', pre: 'The login page is open', steps: '1. Type an email that does not exist: ghost@nobody.com\n2. Type any password.\n3. Click "Sign In".', expected: 'An error message appears. The app does NOT log you in.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-AUTH-007', feature: 'You stay logged in after page refresh', pre: 'You are already logged in', steps: '1. Press F5 or Ctrl+R to refresh the browser page.', expected: 'You remain logged in. The Dashboard appears again. You are NOT sent back to the login page.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-AUTH-008', feature: 'Admin account sees the full menu', pre: 'You have the Admin login credentials', steps: '1. Log in using the Admin email and password.\n2. Look at the left sidebar menu.', expected: 'The sidebar shows all links: Employees, Payroll, Shifts, Departments, Calendar, etc.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-AUTH-011', feature: 'Employee account has a limited menu', pre: 'Logged in as Test User (employee account)', steps: '1. Log in as testuser@intellisys.com / Test@1234.\n2. Look at the sidebar menu.', expected: 'The sidebar does NOT show "Employees Directory" or "Payroll Management". These options are hidden for employees.', priority: 'CRITICAL', severity: 'BLOCKER' },
        ]
      },
      {
        name: 'Logging Out & Security',
        tcs: [
          { id: 'TC-AUTH-012', feature: 'Logging out works correctly', pre: 'You are logged in', steps: '1. Look at the top-right corner of the screen.\n2. Click your avatar or name.\n3. Click "Logout".', expected: 'You are immediately taken back to the login page. Your session is completely closed.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-AUTH-013', feature: 'Visiting a page without logging in is blocked', pre: 'You are NOT logged in', steps: '1. In your browser address bar, manually type: http://localhost:5173/attendance\n2. Press Enter.', expected: 'Instead of seeing the Attendance page, you are automatically redirected to the Login page.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-AUTH-014', feature: 'Session timeout warning appears after long idle time', pre: 'You are logged in and have left the app idle for a while', steps: '1. Open the app and log in.\n2. Do not click anything for a long time (depends on session settings).\n3. Come back and check the screen.', expected: 'A warning banner appears saying your session is about to expire, with a button to continue.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-AUTH-016', feature: 'Back button does not let you in after logout', pre: 'You have just logged out', steps: '1. Log out from the app.\n2. Press the browser\'s Back button (←).\n3. Try to go back to any page.', expected: 'You are sent back to the Login page. Old pages do NOT show up.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 2 — Dashboard (Home Screen)',
    intro: 'The Dashboard is the first thing you see after logging in. It shows a summary of your attendance, leaves, announcements, and quick action buttons.',
    sections: [
      {
        name: 'Dashboard Elements',
        tcs: [
          { id: 'TC-DASH-001', feature: 'Dashboard loads properly after login', pre: 'Logged in as any user', steps: '1. Log in to the app.\n2. You should be taken to the Dashboard automatically.\n3. Wait for the page to fully load.', expected: 'The dashboard page shows: Today\'s attendance status, Quick action buttons (like Check In), Announcements from HR, Leave balance cards.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-DASH-002', feature: 'Check-In button appears on dashboard', pre: 'You have NOT checked in for today', steps: '1. Log in and look at the dashboard.\n2. Find the attendance card or quick action area.', expected: 'A clear "Check In" button is visible and can be clicked.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-DASH-003', feature: 'Attendance summary shows correct numbers', pre: 'Logged in as any user', steps: '1. On the dashboard, look for the Attendance Summary card.\n2. Note the counts shown for: Present, Absent, On Leave.', expected: 'The numbers match the actual attendance records for the current month.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-DASH-004', feature: 'Leave balance card shows remaining leaves', pre: 'Logged in as any user', steps: '1. Find the Leave Balance section on the dashboard.\n2. Check the numbers shown for Casual Leave (CL), Sick Leave (SL), and Earned Leave (EL).', expected: 'The correct remaining balances are displayed for each leave type.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-DASH-007', feature: 'Workday timeline shows today\'s activity', pre: 'You are checked in for today', steps: '1. After checking in, return to the dashboard.\n2. Look for the "Timeline" or "Today\'s Activity" section.', expected: 'A visual timeline shows your check-in time, any breaks taken, and current status (Active/Away).', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-DASH-008', feature: 'Admin dashboard shows company-wide data', pre: 'Logged in as Admin', steps: '1. Log in as Admin.\n2. Look at the dashboard.', expected: 'Admin sees overall company stats: total employees, today\'s attendance count, pending approvals, etc.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-DASH-011', feature: 'All sidebar links navigate correctly', pre: 'Logged in as any user', steps: '1. Click each link in the left sidebar menu one at a time.\n2. After clicking each, check if the correct page opens.', expected: 'Every link opens the correct page. No "Page not found" errors appear.', priority: 'CRITICAL', severity: 'BLOCKER' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 3 — Attendance',
    intro: 'This module covers checking in to start your workday, taking breaks, checking out, and viewing your attendance history. This is one of the most important modules to test thoroughly.',
    sections: [
      {
        name: 'Checking In and Out',
        tcs: [
          { id: 'TC-ATT-001', feature: 'Check In for the day', pre: 'You have NOT checked in today. You are on the Attendance page.', steps: '1. Go to the Attendance page from the sidebar.\n2. Find the big "Check In" button.\n3. Click it.', expected: 'Your status changes to "Active". A timer starts counting your working hours. Your check-in time is recorded.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-ATT-002', feature: 'Cannot check in twice in one day', pre: 'You have already checked in today', steps: '1. Go to the Attendance page.\n2. Try to find and click the Check In button again.', expected: 'The Check In button is gone or greyed out. The page shows you are already checked in.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-ATT-003', feature: 'Check Out at end of day', pre: 'You are currently checked in', steps: '1. Find the "Check Out" button on the Attendance page.\n2. Click it.\n3. A confirmation box appears — click Confirm/Yes.', expected: 'Your session ends. The total hours worked is calculated and shown on screen.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-ATT-004', feature: 'Late arrival penalty is applied', pre: 'Your shift starts at 9:00 AM. You are checking in after the grace period (e.g. 9:20 AM).', steps: '1. Check in after your shift\'s grace period has passed.\n2. After checking in, look at your attendance entry for today.', expected: 'The attendance record shows a "Late" mark. The extra minutes are noted as a penalty.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-005', feature: 'Warning when trying to check out too early', pre: 'You are checked in but have NOT completed your required hours (e.g. 9 hours)', steps: '1. Click the Check Out button before completing your required working hours.', expected: 'A warning box appears showing how many hours are still remaining before you can check out cleanly.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-006', feature: 'Cannot check out while on a break', pre: 'You have started a break and it is still running', steps: '1. Make sure you are on an active break.\n2. Try to click Check Out.', expected: 'The app shows an error or asks you to end your break first.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Breaks During the Day',
        tcs: [
          { id: 'TC-ATT-007', feature: 'Start a Morning Tea break', pre: 'You are checked in and working a Morning Shift', steps: '1. On the Attendance page, find the "Start Break" button.\n2. Click it.\n3. Select "Morning Tea" from the options.', expected: 'Your break starts. A timer shows how long you have been on break. Your status changes to "Away".', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-008', feature: 'End a break', pre: 'You are currently on a break', steps: '1. Find the "End Break" button on the Attendance page.\n2. Click it.', expected: 'Your break ends. Your status goes back to "Active". The break duration is saved.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-010', feature: 'Lunch break is only available for Morning Shift employees', pre: 'You are on a Morning Shift and checked in', steps: '1. Click Start Break.\n2. Look at all the options available.', expected: 'You can see "Lunch" as an option. The "Dinner" option is NOT there for morning shift.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-011', feature: 'Dinner break is only for Night Shift employees', pre: 'A Night Shift employee is checked in', steps: '1. Log in as a Night Shift employee.\n2. Click Start Break.\n3. Look at the options.', expected: '"Dinner" break option is visible. "Lunch" is NOT shown for night shift employees.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-012', feature: 'Cannot start a second break while already on break', pre: 'You are currently on an active break', steps: '1. While on a break, look for the Start Break button again.\n2. Try to click it to start another break.', expected: 'The Start Break button is either hidden or disabled. You can only see "End Break".', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Attendance History',
        tcs: [
          { id: 'TC-ATT-013', feature: 'View attendance records for the month', pre: 'Logged in as any employee', steps: '1. Go to the Attendance page.\n2. Click on the "History" tab.', expected: 'A table appears showing every day of the current month with your attendance status for each day.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-014', feature: 'Switch to a different month', pre: 'You are on the Attendance History tab', steps: '1. Find the month/year selector at the top of the table.\n2. Change it to any previous month (e.g. May 2026).', expected: 'The table refreshes and shows attendance records for the month you selected.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-015', feature: 'Saturdays show as Off Day (not Absent)', pre: 'You are viewing any month in the History tab', steps: '1. In the attendance history table, scroll or look for a row that is a Saturday.\n2. Check what status is shown for that Saturday.', expected: 'It shows "Off Day" — NOT "Absent". Saturdays are your weekly off days.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-ATT-016', feature: 'Sundays show as Off Day (not Absent)', pre: 'You are viewing any month in the History tab', steps: '1. Find a Sunday row in the attendance history table.\n2. Check the status shown.', expected: 'It shows "Off Day" — NOT "Absent". Sundays are always off.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-ATT-017', feature: 'Working Saturdays are marked correctly', pre: 'Switch to April 2026 in History', steps: '1. Change the month to April 2026.\n2. Look at April 11 (Saturday) and April 25 (Saturday).', expected: 'These two Saturdays show "Working Saturday" — because they were specifically marked as working days in the Calendar.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-018', feature: 'Public holidays are labeled correctly', pre: 'Switch to May 2026 in History', steps: '1. Change the month to May 2026.\n2. Look at May 1 (Labour Day).', expected: 'May 1 shows a holiday label like "Maharashtra Day" or "Holiday" — NOT "Absent".', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-019', feature: 'Future dates do not show as Absent', pre: 'You are on the History tab for the current month', steps: '1. Scroll to any future date in this month (e.g. if today is June 10, look at June 20).\n2. Check what status is shown.', expected: 'Future dates show "Scheduled" or are blank — they must NOT show "Absent".', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-020', feature: 'Summary counts are accurate', pre: 'Attendance History tab is open', steps: '1. At the top of the attendance table, look for the summary cards (e.g. "Present: 18, Absent: 2, Off Days: 8").\n2. Manually count a few rows to verify.', expected: 'The numbers match reality. No fake Absents on weekends or holidays are counted.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Regularization Requests (Fixing Attendance)',
        tcs: [
          { id: 'TC-ATT-021', feature: 'Submit a request to fix a missed attendance', pre: 'There is a day in your history showing "Absent" that you were actually present for', steps: '1. Find the Absent day in the History tab.\n2. Look for a "Regularize" or "Fix Attendance" button on that row.\n3. Click it.\n4. Type a reason explaining why you were absent (e.g. "System issue - I was present").\n5. Click Submit.', expected: 'A request is created and shows as "Pending Approval". Your manager or HR will review it.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-022', feature: 'Manager/HR can approve a regularization', pre: 'Logged in as Admin, HR, or Manager. A regularization request is pending.', steps: '1. Go to Attendance → Requests (or Attendance Requests page).\n2. Find the pending request.\n3. Click "Approve".', expected: 'The request is approved. That day\'s attendance is updated to "Present".', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-023', feature: 'Manager/HR can reject a regularization', pre: 'Logged in as Admin/HR/Manager. A regularization request is pending.', steps: '1. Go to Attendance Requests.\n2. Find a pending request.\n3. Click "Reject".', expected: 'The request is rejected. Attendance for that day remains "Absent".', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-024', feature: 'Cannot submit regularization without a reason', pre: 'The regularization form/modal is open', steps: '1. Open the regularization form.\n2. Leave the reason field completely empty.\n3. Click Submit.', expected: 'An error appears: "Please enter a reason". The form does NOT submit.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Overtime',
        tcs: [
          { id: 'TC-ATT-025', feature: 'Request paid overtime before 5 PM', pre: 'It is before 5:00 PM on a working day. You are checked in.', steps: '1. Find the "Request Paid Overtime" option (usually on the Attendance page).\n2. Click it.\n3. Type your reason (e.g. "Urgent project deadline").\n4. Click Submit.', expected: 'Your overtime request is submitted. It shows as "Pending Approval" until your manager approves it.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-ATT-026', feature: 'Cannot request overtime after 5 PM', pre: 'It is after 5:00 PM', steps: '1. Try to submit an overtime pre-approval request after 5 PM.', expected: 'The app shows an error saying the cutoff time has passed for today.', priority: 'MEDIUM', severity: 'MINOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 4 — Leaves',
    intro: 'This module handles applying for leave, getting it approved or rejected, and checking your leave balance. Test all leave types and edge cases carefully.',
    sections: [
      {
        name: 'Applying for Leave',
        tcs: [
          { id: 'TC-LV-001', feature: 'Apply for Casual Leave', pre: 'You are logged in. You have at least 1 day of Casual Leave balance remaining.', steps: '1. Click "Leaves" in the sidebar.\n2. Click the "Apply Leave" button.\n3. Select leave type: Casual Leave (CL).\n4. Pick a start date and end date (choose future dates).\n5. Type a reason (e.g. "Personal work").\n6. Click Submit.', expected: 'Your leave request is submitted. It appears in your list with status "Pending". Your manager/HR will approve or reject it.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-LV-002', feature: 'Cannot apply leave when balance is 0', pre: 'Your Casual Leave balance is 0 days', steps: '1. Click Apply Leave.\n2. Select Casual Leave.\n3. Pick any dates.\n4. Click Submit.', expected: 'An error appears: "Insufficient leave balance". You cannot apply.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-LV-003', feature: 'Weekends are not counted in your leave days', pre: 'You want to apply leave for a week including Saturday and Sunday', steps: '1. Apply a leave from a Monday to the following Friday (5 working days).\n2. Note how many days are counted.', expected: 'Only 5 days are deducted from your balance (Saturday and Sunday are NOT counted as leave days).', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-LV-004', feature: 'Public holidays inside your leave are not counted', pre: 'There is a public holiday within your leave date range', steps: '1. Apply a leave from May 1 to May 5.\n2. Note how many days are counted (May 1 is a holiday).', expected: 'Only 4 working days are counted. May 1 (holiday) is automatically skipped from the leave count.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-LV-005', feature: 'Cannot apply leave on dates already approved for leave', pre: 'You have already an approved leave for, say, July 10-12', steps: '1. Try to apply another leave that includes July 11.\n2. Click Submit.', expected: 'An error appears: "Dates overlap with an existing leave". You cannot double-apply.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-LV-006', feature: 'Cannot apply leave without a reason', pre: 'The Apply Leave form is open', steps: '1. Fill all fields but leave the "Reason" field empty.\n2. Click Submit.', expected: 'An error appears near the Reason field: "Reason is required". Form does not submit.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-LV-007', feature: 'End date cannot be before start date', pre: 'The Apply Leave form is open', steps: '1. Set Start Date to July 20.\n2. Set End Date to July 15 (earlier than start).\n3. Click Submit.', expected: 'An error appears: "End date must be after start date". Form does not submit.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-LV-008', feature: 'Half-day leave counts as 0.5 days', pre: 'You have a leave balance', steps: '1. Click Apply Leave.\n2. Choose the "Half Day" option if available.\n3. Select AM or PM half.\n4. Submit.', expected: 'Only 0.5 days are deducted from your balance.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Leave Approvals',
        tcs: [
          { id: 'TC-LV-009', feature: 'Admin/HR/Manager can approve a leave request', pre: 'Logged in as Admin, HR, or Manager. A leave request is pending.', steps: '1. Go to Leaves in the sidebar.\n2. Click the "Approvals" or "Pending" tab.\n3. Find the pending leave request.\n4. Click "Approve".', expected: 'The leave status changes to "Approved". The employee\'s leave balance is reduced by the number of days taken.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-LV-010', feature: 'Admin/HR/Manager can reject a leave request', pre: 'Logged in as Admin/HR/Manager. A pending leave exists.', steps: '1. Go to Leaves → Approvals.\n2. Find the pending leave.\n3. Click "Reject".', expected: 'The leave is rejected. The employee\'s leave balance is NOT reduced (they still have those days).', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-LV-011', feature: 'Employee cannot approve their own leave', pre: 'Logged in as a regular Employee', steps: '1. Go to the Leaves page.\n2. Look at your own pending leave request.', expected: 'There is NO "Approve" button visible. Employees can only view their own leave requests, not approve them.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-LV-012', feature: 'Employee can cancel a pending leave', pre: 'You have a leave request that is still Pending (not yet approved)', steps: '1. Go to Leaves page.\n2. Find your pending request.\n3. Click "Cancel" or "Delete".', expected: 'The leave request is removed. Your leave balance remains unchanged (nothing was deducted since it was pending).', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-LV-013', feature: 'Leave balance is reduced after approval', pre: 'You can see your current leave balance', steps: '1. Note your current CL balance (e.g. 3 days).\n2. Apply for 1 day CL and get it approved by Admin/HR.\n3. Check your balance again.', expected: 'Your CL balance is now 2 days (reduced by 1). The deduction happened on approval.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-LV-014', feature: 'Leave balance is NOT reduced on rejection', pre: 'A leave request exists and you can see the current balance', steps: '1. Note your current balance.\n2. Submit a leave request.\n3. Have an Admin reject it.\n4. Check your balance again.', expected: 'Your balance has NOT changed. Rejected leaves do not deduct from your balance.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-LV-015', feature: 'Filter leave history by status', pre: 'You are on the Leaves page', steps: '1. Find the status filter (Pending / Approved / Rejected).\n2. Click "Approved".', expected: 'The table shows only your approved leaves. Other statuses are hidden.', priority: 'MEDIUM', severity: 'MINOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 5 — Employee Profiles',
    intro: 'This module tests the employee directory and individual employee profile pages — viewing, editing, and creating employee records.',
    sections: [
      {
        name: 'Viewing Employees',
        tcs: [
          { id: 'TC-EMP-001', feature: 'Admin/HR/Manager can see the full employee list', pre: 'Logged in as Admin, HR, or Manager', steps: '1. Click "Employees" in the sidebar menu.', expected: 'A table appears showing all employees with their Name, Employee Code, Department, and Status.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-EMP-002', feature: 'Search for an employee by name', pre: 'You are on the Employees page', steps: '1. Find the search box on the Employees page.\n2. Type an employee\'s first name (e.g. "Ritesh").\n3. Watch the list update.', expected: 'Only employees whose names match your search text appear in the table. Others disappear.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-EMP-003', feature: 'Filter by department', pre: 'You are on the Employees page', steps: '1. Find the Department filter dropdown.\n2. Select a department (e.g. "Sales").\n3. Look at the table.', expected: 'Only employees from the selected department are shown.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-EMP-004', feature: 'Employee cannot see the full directory', pre: 'Logged in as Test User (employee)', steps: '1. Look at the sidebar menu after logging in as the test employee account.\n2. Try to find an "Employees" link.', expected: 'There is NO "Employees" link in the sidebar. If you type the URL directly, you are blocked or redirected.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-EMP-005', feature: 'View your own profile', pre: 'Logged in as any employee', steps: '1. Look for your name or avatar in the top-right of the page.\n2. Click on it, or find "My Profile" in the menu.', expected: 'Your personal profile page opens showing: Overview, Attendance, Leaves tabs and your personal details.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-EMP-006', feature: 'Attendance month switch works in profile', pre: 'You are viewing an employee\'s Attendance tab', steps: '1. Go to any employee profile → Attendance tab.\n2. Change the month dropdown to April 2026.', expected: 'The attendance history updates to show April 2026 records. Working Saturdays and Holidays in April show correctly.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Editing & Creating Employees',
        tcs: [
          { id: 'TC-EMP-007', feature: 'Admin/HR can edit an employee\'s details', pre: 'Logged in as Admin or HR. You are viewing any employee\'s profile.', steps: '1. Click the "Edit" button on the employee profile page.\n2. Change a field — for example, change the Job Title to "Senior Developer".\n3. Click Save.', expected: 'The change is saved. When you reload the profile, the new Job Title is shown.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-EMP-008', feature: 'Cannot save without required fields', pre: 'The employee edit form is open', steps: '1. Delete the First Name from the form (clear the field).\n2. Click Save.', expected: 'An error message appears saying the First Name is required. The form does NOT save.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-EMP-009', feature: 'Upload a profile photo', pre: 'You are on any employee\'s profile page', steps: '1. Click on the avatar/photo circle at the top of the profile.\n2. Select a valid photo file from your computer (JPG or PNG).\n3. If a cropping tool appears, adjust and confirm.', expected: 'The profile photo is updated and immediately visible on the profile page.', priority: 'MEDIUM', severity: 'MINOR' },
          { id: 'TC-EMP-010', feature: 'Cannot upload a non-image file as a photo', pre: 'The avatar/photo upload window is open', steps: '1. Try to upload a file that is NOT an image — for example, a PDF document or an Excel file.', expected: 'An error message appears: "Only image files (JPG, PNG) are allowed." The upload is blocked.', priority: 'MEDIUM', severity: 'MINOR' },
          { id: 'TC-EMP-011', feature: 'Deactivate an employee', pre: 'Logged in as Admin. Viewing an active employee\'s profile.', steps: '1. Find the "Deactivate" or "Disable Account" button on the profile.\n2. Click it.\n3. Confirm the action in the popup that appears.', expected: 'The employee\'s status changes to "Inactive". They can no longer log in to the app.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-EMP-012', feature: 'Create a new employee account', pre: 'Logged in as Admin or HR', steps: '1. On the Employees page, click "Add Employee" or "+ New".\n2. Fill in all required details: Name, Email, Employee Code, Department, Join Date, etc.\n3. Click Save/Submit.', expected: 'The new employee is created and appears in the employee list. They can now log in with their email.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-EMP-013', feature: 'Cannot create an employee with an email that already exists', pre: 'You are on the Add Employee form', steps: '1. Fill in all details.\n2. For the Email field, type an email that already belongs to another employee.\n3. Click Save.', expected: 'An error appears: "This email is already in use." The employee is NOT created.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-EMP-014', feature: 'Required fields cannot be left blank when creating', pre: 'The Add Employee form is open', steps: '1. Leave the First Name field blank.\n2. Fill all other fields correctly.\n3. Click Save.', expected: 'An error highlights the First Name field: "This field is required." The form does NOT submit.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 6 — Payroll & Incentives',
    intro: 'Payroll is a sensitive module. It involves generating salary records, publishing payslips, and adding incentives. Only Admins and HR can manage payroll. Employees can only view their own published payslips.',
    sections: [
      {
        name: 'Payroll Management',
        tcs: [
          { id: 'TC-PAY-001', feature: 'Admin/HR can view the Payroll page', pre: 'Logged in as Admin or HR', steps: '1. Click "Payroll" in the sidebar.', expected: 'The Payroll page loads with a table showing salary records and a month/year selector at the top.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-PAY-002', feature: 'Generate payroll for all employees', pre: 'Logged in as Admin or HR. At or near end of month.', steps: '1. On the Payroll page, select the month and year (e.g. June 2026).\n2. Click the "Generate Payroll" button.', expected: 'Draft salary records are created for all employees. They appear in the list with status "Draft".', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-PAY-003', feature: 'View detailed salary breakdown', pre: 'At least one draft payroll record exists', steps: '1. Click on any payroll record in the list.\n2. A detailed view opens.', expected: 'You see the full salary breakdown: Basic Pay, HRA, Allowances, Deductions, Loss of Pay (if any), and Net Pay.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-PAY-004', feature: 'Publish (lock) the payroll', pre: 'A draft payroll exists', steps: '1. On a draft payroll record, click the "Publish" or "Lock" button.\n2. Confirm the action.', expected: 'The payroll status changes to "Published". Employees can now see their payslip.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-PAY-005', feature: 'Employee can view their own payslip after publishing', pre: 'Payroll has been published. Logged in as the Employee.', steps: '1. Log in as the test employee (testuser@intellisys.com).\n2. Go to your profile.\n3. Click the "Payroll" tab.', expected: 'Your published payslip is visible showing your salary details for the month.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-PAY-006', feature: 'Employee CANNOT see draft payroll', pre: 'Payroll has been generated but NOT yet published (still in Draft). Logged in as Employee.', steps: '1. Log in as the test employee.\n2. Go to your profile → Payroll tab.\n3. Check if any draft record is visible.', expected: 'Draft records are NOT visible to employees. The payroll tab either shows nothing or only published records.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-PAY-007', feature: 'Absent days reduce salary (LOP)', pre: 'An employee has Absent records for the month. Payroll is generated.', steps: '1. Generate payroll for an employee who had some absent days.\n2. Open the payroll detail for that employee.', expected: 'The payslip shows a "Loss of Pay" deduction for the absent days. Net pay is reduced accordingly.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Incentives',
        tcs: [
          { id: 'TC-PAY-008', feature: 'Add a performance incentive for an employee', pre: 'Logged in as Admin or HR', steps: '1. Click "Incentives" in the sidebar (or go to /incentives).\n2. Select an employee from the dropdown.\n3. Enter the incentive amount (e.g. 5000).\n4. Enter the reason (e.g. "Best performer this month").\n5. Click Add/Save.', expected: 'The incentive is saved and appears in the incentives list for that employee.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-PAY-009', feature: 'Incentive is included in the monthly payslip', pre: 'An incentive has been added for an employee. Payroll has been generated for that month.', steps: '1. Generate or view payroll for the month the incentive was added.\n2. Open the employee\'s payslip.', expected: 'The incentive amount is listed as a separate item in the payslip. Net pay is increased by the incentive amount.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 7 — Shift Management',
    intro: 'Shifts define when employees start and end work. This section tests creating shifts, configuring breaks, and assigning employees to shifts. Only Admins can manage shifts.',
    sections: [
      {
        name: 'Shift Access & Setup',
        tcs: [
          { id: 'TC-SH-001', feature: 'Admin can see the Shifts page', pre: 'Logged in as Admin', steps: '1. Look for "Shifts" in the sidebar.\n2. Click on it.', expected: 'The Shifts page opens and shows all existing shift profiles with their timings and break settings.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-SH-002', feature: 'Regular employees cannot access Shifts', pre: 'Logged in as Test User (employee)', steps: '1. Check if "Shifts" appears in the sidebar menu.\n2. Try typing the shifts URL directly in the browser.', expected: '"Shifts" is NOT in the sidebar. If you type the URL manually, you are blocked or redirected.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-SH-003', feature: 'Create a new shift', pre: 'Logged in as Admin. On the Shifts page.', steps: '1. Click "Add Shift" or the + button.\n2. Enter a shift name (e.g. "Afternoon Shift").\n3. Set Start Time (e.g. 2:00 PM) and End Time (e.g. 11:00 PM).\n4. Click Save.', expected: 'The new shift appears in the list with its name and timings.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-SH-004', feature: 'Edit an existing shift', pre: 'At least one shift exists. Logged in as Admin.', steps: '1. Click the Edit icon/button next to any shift.\n2. Change the start or end time.\n3. Click Save.', expected: 'The shift is updated. All employees assigned to this shift will now follow the new timings.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-SH-005', feature: 'Cannot save a shift without a name', pre: 'The Add Shift form is open', steps: '1. Leave the Shift Name field empty.\n2. Fill in the times.\n3. Click Save.', expected: 'An error appears: "Shift name is required." The shift is NOT created.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Break Configuration',
        tcs: [
          { id: 'TC-SH-006', feature: 'Turning breaks OFF hides all break options for employees', pre: 'Logged in as Admin. Editing or creating a shift.', steps: '1. Find the "Enable Breaks" main toggle switch.\n2. Turn it OFF.\n3. Save the shift.', expected: 'Employees assigned to this shift will NOT see any break options when they are checked in.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-SH-007', feature: 'Set a custom time window for Morning Tea break', pre: 'You are editing a shift that has breaks enabled', steps: '1. Enable the "Morning Tea" break checkbox.\n2. Set custom Start Time (e.g. 10:30 AM) and End Time (e.g. 11:00 AM).\n3. Save the shift.', expected: 'The custom Morning Tea window (10:30–11:00) is saved and shown on the shift\'s profile card.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-SH-008', feature: 'Lunch is only available in Morning Shifts', pre: 'You are editing a Morning Shift (starts before 12 PM)', steps: '1. Look at the break options available.\n2. Check if both "Lunch" and "Dinner" checkboxes are visible.', expected: '"Lunch" is available as an option. "Dinner" is either hidden or disabled for morning shifts.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-SH-009', feature: 'Dinner is only available in Night Shifts', pre: 'You are editing a Night Shift (starts at or after 12 PM)', steps: '1. Look at the break options available.\n2. Check if "Dinner" is shown.', expected: '"Dinner" is available. "Lunch" is either hidden or disabled for night shifts.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-SH-010', feature: 'Assign a different shift to an employee', pre: 'Logged in as Admin. On the Shifts page.', steps: '1. Find the "Employee Shift Switcher" or similar section.\n2. Search for an employee.\n3. Select a different shift from the dropdown.\n4. Click Assign/Save.', expected: 'The employee\'s shift is updated. From now on, their check-in grace period, required hours, and break types follow the new shift rules.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 8 — Calendar',
    intro: 'The Calendar page shows the company\'s working and non-working days. Admins can mark specific Saturdays as working days or declare public holidays here.',
    sections: [
      {
        name: 'Calendar View & Management',
        tcs: [
          { id: 'TC-CAL-001', feature: 'View the Calendar page', pre: 'Logged in as any user', steps: '1. Click "Calendar" in the sidebar.', expected: 'A monthly calendar appears for the current month. Public holidays and working Saturdays are highlighted.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-CAL-002', feature: 'Public holidays are highlighted on the calendar', pre: 'On the Calendar page. View May 2026.', steps: '1. Navigate to May 2026 on the calendar.\n2. Look at May 1.', expected: 'May 1 is highlighted/marked as "Maharashtra Day" (or the holiday name set by admin).', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-CAL-003', feature: 'Working Saturdays are marked differently', pre: 'On the Calendar page. Navigate to April 2026.', steps: '1. Go to April 2026.\n2. Look at April 11 and April 25 (both are Saturdays).', expected: 'These Saturdays are marked as "Working Saturday" — distinct from regular off Saturdays.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-CAL-004', feature: 'Admin can mark a Saturday as a working day', pre: 'Logged in as Admin. On the Calendar page.', steps: '1. Click on any upcoming Saturday on the calendar.\n2. Select the option to mark it as a Working Saturday.\n3. Save/Confirm.', expected: 'The Saturday is highlighted as a working day. Employees who check in on that day will be marked Present.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-CAL-005', feature: 'Admin can add a public holiday', pre: 'Logged in as Admin. On the Calendar page.', steps: '1. Click on any weekday (Monday–Friday).\n2. Choose "Add Holiday".\n3. Type the holiday name (e.g. "Company Anniversary").\n4. Save.', expected: 'The day is marked as a holiday on the calendar. Employees do NOT need to come in on that day.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-CAL-006', feature: 'Regular employees cannot edit the calendar', pre: 'Logged in as Test User (employee)', steps: '1. Go to the Calendar page.\n2. Try clicking on any day.', expected: 'Nothing happens when you click — there is no edit option. Employees can only VIEW the calendar, not change it.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-CAL-007', feature: 'Navigating between months works', pre: 'On the Calendar page', steps: '1. Click the arrow (>) to go to the next month.\n2. Click the arrow (<) to go back.', expected: 'The calendar navigates to the correct month. The holidays and working Saturdays for that month load correctly.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 9 — Team, Tasks & Notifications',
    intro: 'This module covers the team workspace, task management, and the notification system.',
    sections: [
      {
        name: 'Team & Tasks',
        tcs: [
          { id: 'TC-TEAM-001', feature: 'View the Team page', pre: 'Logged in as any user', steps: '1. Click "Team" in the sidebar.', expected: 'The Team page loads showing ongoing projects and team information under the company (TSP).', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-TEAM-002', feature: 'Leaderboard shows employee rankings', pre: 'Logged in as any user', steps: '1. From the Team page, click "Leaderboard".\n   (Or navigate to /team/leaderboard)', expected: 'A ranking table appears showing employees ordered by their attendance or performance score.', priority: 'MEDIUM', severity: 'MINOR' },
          { id: 'TC-TEAM-003', feature: 'Manager can assign a task to an employee', pre: 'Logged in as Manager or Admin', steps: '1. Go to Tasks → Manage Tasks (or /tasks/manage).\n2. Find the option to assign a new task.\n3. Select the employee.\n4. Type the task name and details.\n5. Click Assign.', expected: 'The task is saved and appears in the employee\'s task list. The employee will receive a notification.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-TEAM-004', feature: 'Employee can mark an assigned task as done', pre: 'Logged in as Test User (employee). A task has been assigned to this account.', steps: '1. Go to Tasks → My Todos (or /tasks/employee-todos).\n2. Find the assigned task.\n3. Click "Mark Complete" or the checkmark.', expected: 'The task is marked as done. The manager is notified that the task was completed.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Notifications',
        tcs: [
          { id: 'TC-NOT-001', feature: 'Notification badge shows unread count', pre: 'Logged in as any user who has unread notifications', steps: '1. Look at the bell icon (🔔) in the top navigation bar.', expected: 'A small red or blue badge with a number appears on the bell showing how many unread notifications you have.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-NOT-002', feature: 'View all notifications', pre: 'Logged in as any user', steps: '1. Click the bell icon or go to the Notifications page.\n2. (Or go to /notifications)', expected: 'A list of all notifications appears with the message and the date/time they were received.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-NOT-003', feature: 'Notification appears when leave is approved', pre: 'You (as employee) have submitted a leave request. Admin has approved it.', steps: '1. Log in as the test employee (testuser@intellisys.com).\n2. Check the bell icon / Notifications page.', expected: 'A notification is visible saying something like: "Your leave request has been approved." The badge count updates.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-NOT-004', feature: 'Mark all notifications as read', pre: 'You have multiple unread notifications', steps: '1. Go to the Notifications page.\n2. Click "Mark All as Read".', expected: 'All notifications are marked as read. The badge counter on the bell icon disappears or shows 0.', priority: 'MEDIUM', severity: 'MINOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 10 — Departments',
    intro: 'Departments are used to group employees into teams (e.g. Sales, Development, HR). Only Admins can create or delete departments.',
    sections: [
      {
        name: 'Department Management',
        tcs: [
          { id: 'TC-DEPT-001', feature: 'Admin/HR can view departments', pre: 'Logged in as Admin or HR', steps: '1. Click "Departments" in the sidebar.', expected: 'A list of all departments appears with their names, codes, and how many employees are in each.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-DEPT-002', feature: 'Add a new department', pre: 'Logged in as Admin. On the Departments page.', steps: '1. Click "Add" or "+ New Department".\n2. Enter a department name (e.g. "Finance").\n3. Enter a short code (e.g. "FIN").\n4. Click Save.', expected: 'The new department is created and appears in the list.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-DEPT-003', feature: 'Cannot add a department with a duplicate code', pre: 'The Add Department form is open', steps: '1. Enter a code that already exists (e.g. "SD" if Software Development already uses it).\n2. Click Save.', expected: 'An error appears: "This department code is already in use." The department is NOT created.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-DEPT-004', feature: 'Cannot delete a department that has employees', pre: 'A department exists that has at least one employee assigned to it', steps: '1. Find that department in the list.\n2. Click "Delete".\n3. Confirm.', expected: 'An error appears saying the department cannot be deleted because it still has employees. Move or reassign employees first.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-DEPT-005', feature: 'Employees cannot access Departments', pre: 'Logged in as Test User (employee)', steps: '1. Look for "Departments" in the sidebar.\n2. Try visiting the page directly.', expected: '"Departments" is NOT in the sidebar. Accessing the URL directly is blocked.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 11 — Permissions & Security',
    intro: 'These tests make sure that users can ONLY access what their role allows. No employee should be able to see admin features, and no one should be able to break in without logging in.',
    sections: [
      {
        name: 'Role-Based Access',
        tcs: [
          { id: 'TC-RBAC-001', feature: 'Employee cannot access the Shifts page', pre: 'Logged in as Test User (employee)', steps: '1. In the browser address bar, type: http://localhost:5173/shifts and press Enter.', expected: 'You are blocked. Either redirected to login or shown a "Not authorized" message. Shifts management is for Admins only.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-RBAC-002', feature: 'Employee cannot manage payroll for others', pre: 'Logged in as Test User (employee)', steps: '1. Go to the Payroll section.\n2. Look for "Generate Payroll" or "Publish" buttons.', expected: 'These buttons do NOT appear. You can only see your own published payslip — nothing else.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-RBAC-003', feature: 'HR can approve leaves', pre: 'Logged in as HR', steps: '1. Go to Leaves → Approvals tab.\n2. Check if Approve/Reject buttons are visible.', expected: 'The Approve and Reject buttons are visible and working for HR role.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-RBAC-004', feature: 'Admin has access to everything', pre: 'Logged in as Admin', steps: '1. Click through every section in the sidebar: Dashboard, Attendance, Leaves, Employees, Payroll, Shifts, Calendar, Departments, Team, etc.', expected: 'All pages open successfully. No access denied messages appear.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-RBAC-005', feature: 'Employee cannot edit another person\'s profile', pre: 'Logged in as Test User (employee)', steps: '1. Navigate to any other employee\'s profile page (if accessible).\n2. Look for an "Edit" button.', expected: 'There is NO "Edit" button. Employees can only view profiles, not edit them.', priority: 'CRITICAL', severity: 'BLOCKER' },
        ]
      },
      {
        name: 'Basic Security Checks',
        tcs: [
          { id: 'TC-DATA-001', feature: 'Times are correct for Indian timezone (IST)', pre: 'Any attendance record exists', steps: '1. Check in at a known time (e.g. at exactly 9:00 AM Indian time).\n2. Look at the attendance record created.', expected: 'The check-in time shows 9:00 AM IST — NOT a UTC time (which would be 3:30 AM). Dates must match Indian time.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-DATA-002', feature: 'Entering a harmful script in a text field does nothing', pre: 'Any form with a text input is open (e.g. reason for leave)', steps: '1. In a text box, type exactly this: <script>alert(\'test\')</script>\n2. Submit the form.', expected: 'The text is saved as plain text OR blocked — a pop-up alert does NOT appear. The app is protected against scripting attacks.', priority: 'CRITICAL', severity: 'BLOCKER' },
          { id: 'TC-DATA-003', feature: 'Cancelled approved leave restores your balance', pre: 'You have an approved leave. Your balance has been reduced.', steps: '1. Cancel the approved leave (if the app allows it).\n2. Check your leave balance again.', expected: 'Your leave balance is restored to what it was before the leave was approved.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-DATA-004', feature: 'Cannot check in from two browser windows at the same time', pre: 'You are logged in', steps: '1. Open the app in two different browser tabs.\n2. Try to click Check In in both tabs very quickly.', expected: 'Only one check-in is recorded. The second tab either shows an error or shows you as already checked in.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      }
    ]
  },
  {
    title: 'MODULE 12 — Visual Quality & General Behaviour',
    intro: 'These tests make sure the app looks correct, behaves predictably, and handles unexpected situations gracefully — without crashing or showing confusing blank pages.',
    sections: [
      {
        name: 'Look & Feel',
        tcs: [
          { id: 'TC-UI-001', feature: 'All pages use the same colour theme', pre: 'Logged in and navigating the app', steps: '1. Open each page: Dashboard, Attendance, Leaves, Employees, Payroll, Shifts, Calendar.\n2. Look at the overall colour scheme and style.', expected: 'All pages use the same dark/blue professional colour theme. Fonts are consistent. Nothing looks out of place or misaligned.', priority: 'MEDIUM', severity: 'MINOR' },
          { id: 'TC-UI-002', feature: 'Pages show a loading animation while fetching data', pre: 'Open the app on a slow network (use browser DevTools to throttle to Slow 3G)', steps: '1. Open Chrome DevTools (F12) → Network tab → Set throttle to "Slow 3G".\n2. Navigate between pages.', expected: 'While a page is loading, a spinner or loading animation is shown. The page does NOT appear blank or frozen.', priority: 'MEDIUM', severity: 'MINOR' },
          { id: 'TC-UI-003', feature: 'Helpful error message when server is down', pre: 'The backend server is stopped/offline', steps: '1. Stop the backend server.\n2. Open the app and navigate to the Dashboard.', expected: 'Instead of a blank page or raw error code, a friendly message appears like "Unable to connect. Please try again." or similar.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-UI-004', feature: 'Success/error messages (toasts) disappear on their own', pre: 'Logged in and on any page', steps: '1. Perform any save action (e.g. edit and save an employee name).\n2. Watch the notification that appears.', expected: 'A coloured notification/toast appears ("Saved successfully!" etc.) and automatically disappears after a few seconds.', priority: 'MEDIUM', severity: 'MINOR' },
          { id: 'TC-UI-005', feature: 'Confirmation box appears before deleting anything', pre: 'Logged in as Admin or HR', steps: '1. Try to delete any item (e.g. a department, an incentive record).\n2. Click the Delete button.', expected: 'A confirmation pop-up appears asking "Are you sure?". The deletion only happens AFTER you confirm. Clicking Cancel does nothing.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-UI-006', feature: 'Empty lists show a friendly message', pre: 'Navigate to any list/table that currently has no records', steps: '1. Go to any page where the list is currently empty.\n2. Look at what is shown.', expected: 'A friendly message appears like "No records found" or "Nothing here yet." The page does NOT appear as a blank, confusing white space.', priority: 'MEDIUM', severity: 'MINOR' },
          { id: 'TC-UI-007', feature: 'Cancelling an edit form resets the values', pre: 'You are editing an employee or a form', steps: '1. Open any Edit form.\n2. Change a few fields (but do NOT save).\n3. Click "Cancel" or close the popup.', expected: 'All the fields you changed go back to their original values. Your edits are discarded without saving anything.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      },
      {
        name: 'Browser Compatibility',
        tcs: [
          { id: 'TC-BROWSER-001', feature: 'App works in Google Chrome', pre: 'Google Chrome browser (latest version) is installed', steps: '1. Open the app in Google Chrome.\n2. Log in and navigate through all main sections.', expected: 'All pages load and all features work without any visual glitches or broken elements.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-BROWSER-002', feature: 'App works in Mozilla Firefox', pre: 'Firefox browser installed', steps: '1. Open the app in Firefox.\n2. Test login, attendance, and leave pages.', expected: 'All features work correctly with no layout issues.', priority: 'HIGH', severity: 'MAJOR' },
          { id: 'TC-BROWSER-003', feature: 'App works in Microsoft Edge', pre: 'Microsoft Edge browser installed', steps: '1. Open the app in Microsoft Edge.\n2. Run core user flows.', expected: 'App works correctly in Edge with no broken layouts or functionality.', priority: 'HIGH', severity: 'MAJOR' },
        ]
      }
    ]
  },
];

// ─── Build Document ─────────────────────────────────────────────────────────
const docSections: (Paragraph | Table)[] = [...coverPage()];

MODULES.forEach((mod, modIdx) => {
  docSections.push(moduleBanner(mod.title));

  if (mod.intro) {
    docSections.push(new Paragraph({
      children: [new TextRun({ text: mod.intro, size: 20, color: COLORS.navyBlue, font: 'Calibri', italics: true })],
      spacing: { before: 100, after: 200 },
      indent: { left: 200, right: 200 },
    }));
  }

  let tcIndex = 0;
  mod.sections.forEach(section => {
    docSections.push(sectionSubhead(section.name));
    section.tcs.forEach(tc => {
      const card = tcCard(tc, tcIndex++);
      card.forEach(el => docSections.push(el));
    });
  });

  if (modIdx < MODULES.length - 1) {
    docSections.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));
  }
});

// ─── Regression Checklist ──────────────────────────────────────────────────
docSections.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));
docSections.push(moduleBanner('REGRESSION CHECKLIST — Run After Every Update'));
docSections.push(new Paragraph({
  children: [new TextRun({ text: 'After every new release or bug fix, quickly check these items off to make sure nothing is broken:', size: 20, color: COLORS.navyBlue, font: 'Calibri', italics: true })],
  spacing: { before: 160, after: 160 },
  indent: { left: 200 },
}));

const checks = [
  'Login works for all roles: Employee, Manager, HR, and Admin',
  'Dashboard loads correctly after login for each role',
  'Check-In and Check-Out work from start to finish',
  'Breaks can be started and ended; status updates to "Away"',
  'Saturdays and Sundays show "Off Day" — not "Absent"',
  'Switching months in Attendance History loads correct data',
  'Leave application and approval flow works end-to-end',
  'Leave balance is deducted on approval; restored on cancellation',
  'Payroll draft is hidden from employees; visible after publishing',
  'Creating and editing employees works without errors',
  'Shift assignment updates clocking rules for that employee',
  'Notifications appear for leave approvals and task assignments',
  'Employees cannot access Admin-only pages',
  'All confirmation popups appear before any delete action',
  'No blank pages or raw error messages shown to users',
];

checks.forEach(c => {
  docSections.push(new Paragraph({
    children: [
      new CheckBox(),
      new TextRun({ text: `   ${c}`, size: 20, color: COLORS.navyBlue, font: 'Calibri' }),
    ],
    spacing: { before: 100, after: 40 },
    indent: { left: 400 },
    shading: checks.indexOf(c) % 2 === 0
      ? { type: ShadingType.SOLID, color: COLORS.lightBlue, fill: COLORS.lightBlue }
      : { type: ShadingType.SOLID, color: COLORS.rowWhite, fill: COLORS.rowWhite },
    border: { left: { style: BorderStyle.THICK, size: 8, color: COLORS.teal } },
  }));
});

docSections.push(new Paragraph({ spacing: { before: 400 } }));
docSections.push(new Paragraph({
  children: [new TextRun({ text: 'HRMS Manual Testing Guide  |  v1.0  |  Prepared for Pre-Production QA  |  June 2026', size: 16, color: COLORS.grey, font: 'Calibri', italics: true })],
  alignment: AlignmentType.CENTER,
  spacing: { before: 200 },
}));

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 20, color: COLORS.navyBlue },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(0.75),
          bottom: convertInchesToTwip(0.75),
          left: convertInchesToTwip(0.85),
          right: convertInchesToTwip(0.85),
        },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'HRMS Application — Manual Testing Guide', size: 16, color: COLORS.grey, font: 'Calibri' }),
            new TextRun({ text: '                                                              ', font: 'Calibri' }),
            new TextRun({ text: 'Confidential | Internal Use Only', size: 16, color: COLORS.grey, font: 'Calibri', italics: true }),
          ],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.skyBlue } },
          spacing: { before: 100, after: 100 },
        })]
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'Page ', size: 16, color: COLORS.grey, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.grey, font: 'Calibri' }),
            new TextRun({ text: ' of ', size: 16, color: COLORS.grey, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: COLORS.grey, font: 'Calibri' }),
            new TextRun({ text: '          Intellisys HRMS  |  QA Testing Document  |  testuser@intellisys.com / Test@1234', size: 16, color: COLORS.grey, font: 'Calibri', italics: true }),
          ],
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.skyBlue } },
          spacing: { before: 100 },
        })]
      }),
    },
    children: docSections,
  }],
});

const finalBuffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, finalBuffer);
console.log(`\n✅ Generated beautiful clean printable guide with native checkboxes!`);
