using System;
using System.Collections.Generic;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace HRMS_Agent
{
    public class DashboardForm : Form
    {
        [DllImport("Gdi32.dll", EntryPoint = "CreateRoundRectRgn")]
        private static extern IntPtr CreateRoundRectRgn(
            int nLeftRect,
            int nTopRect,
            int nRightRect,
            int nBottomRect,
            int nWidthEllipse,
            int nHeightEllipse
        );

        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);

        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;

        // UI Controls
        private readonly Panel _pnlHeader;
        private readonly Label _lblHeaderTitle;
        private readonly Button _btnMinimize;
        private readonly Button _btnMaximize;
        private readonly Button _btnClose;

        private readonly Panel _pnlActions;
        private readonly Label _lblStatusTitle;
        private readonly Label _lblStatusText;
        private readonly Label _lblTimerTitle;
        private readonly Label _lblTimerText;

        private readonly Button _btnCheckIn;
        private readonly Button _btnLunch;
        private readonly Button _btnTea;
        private readonly Button _btnCheckOut;

        private readonly Panel _pnlLog;
        private readonly Label _lblLogTitle;
        private readonly ListBox _lstEvents;

        private readonly Label _lblAccount;
        private readonly Button _btnSync;
        private readonly Button _btnDisconnect;

        // Timer for elapsed shift/break counters
        private readonly System.Windows.Forms.Timer _secondsTimer;

        // State tracking
        private AttendanceRecord? _currentAttendance;
        private List<BreakSessionRecord> _currentBreaks = new List<BreakSessionRecord>();
        private readonly Action _onSyncRequested;
        private readonly Action _onLogoutRequested;

        // Custom log entry container to carry type-specific colors
        private class LogEntry
        {
            public string Message { get; set; } = "";
            public Color Color { get; set; } = Color.White;
            public override string ToString() => Message;
        }

        public DashboardForm(Action onSyncRequested, Action onLogoutRequested)
        {
            _onSyncRequested = onSyncRequested;
            _onLogoutRequested = onLogoutRequested;

            // Form Configurations - Doubled and made spacious (800 x 520)
            Size = new Size(800, 520);
            MinimumSize = new Size(700, 450); // Prevent resizing too small
            FormBorderStyle = FormBorderStyle.None;
            BackColor = Color.FromArgb(24, 24, 32); // Modern Dark Slate
            StartPosition = FormStartPosition.CenterScreen;
            Text = "IntelliHrHub Agent Dashboard";
            Icon = SystemIcons.Shield;

            // Apply GDI Rounded Corners
            Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 16, 16));

            // Re-apply or remove rounded corners dynamically on resize (no rounded corners when maximized)
            Resize += (s, e) =>
            {
                if (WindowState == FormWindowState.Maximized)
                {
                    Region = null;
                    _btnMaximize.Text = "\uE923";
                }
                else
                {
                    Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 16, 16));
                    _btnMaximize.Text = "\uE922";
                }
                LayoutControls();
            };

            // 1. Header Panel (Draggable & Double-Click to Maximize)
            _pnlHeader = new Panel
            {
                Size = new Size(Width, 50),
                Location = new Point(0, 0),
                BackColor = Color.FromArgb(33, 33, 44),
                Cursor = Cursors.SizeAll
            };
            _pnlHeader.MouseDown += HeaderPanel_MouseDown;
            _pnlHeader.DoubleClick += (s, e) => ToggleMaximize();

            _lblHeaderTitle = new Label
            {
                Text = "🛡️ IntelliHrHub Desktop Agent",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                ForeColor = Color.FromArgb(245, 246, 250),
                Location = new Point(20, 0),
                Size = new Size(500, 50), // Widened to 500px to fully accommodate text without clipping
                TextAlign = ContentAlignment.MiddleLeft,
                Cursor = Cursors.SizeAll
            };
            _lblHeaderTitle.MouseDown += HeaderPanel_MouseDown;
            _lblHeaderTitle.DoubleClick += (s, e) => ToggleMaximize();

            // Minimize Button - Height matches Titlebar, styled like native Win11 control
            _btnMinimize = new Button
            {
                Text = "\uE921",
                Font = new Font("Segoe MDL2 Assets", 9),
                Location = new Point(Width - 135, 0),
                Size = new Size(45, 50),
                BackColor = Color.Transparent,
                ForeColor = Color.FromArgb(220, 221, 230),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            _btnMinimize.FlatAppearance.BorderSize = 0;
            _btnMinimize.FlatAppearance.MouseOverBackColor = Color.FromArgb(53, 53, 64);
            _btnMinimize.FlatAppearance.MouseDownBackColor = Color.FromArgb(63, 63, 74);
            _btnMinimize.Click += (s, e) => WindowState = FormWindowState.Minimized;

            // Maximize / Restore Button - Height matches Titlebar, styled like native Win11 control
            _btnMaximize = new Button
            {
                Text = "\uE922",
                Font = new Font("Segoe MDL2 Assets", 9),
                Location = new Point(Width - 90, 0),
                Size = new Size(45, 50),
                BackColor = Color.Transparent,
                ForeColor = Color.FromArgb(220, 221, 230),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            _btnMaximize.FlatAppearance.BorderSize = 0;
            _btnMaximize.FlatAppearance.MouseOverBackColor = Color.FromArgb(53, 53, 64);
            _btnMaximize.FlatAppearance.MouseDownBackColor = Color.FromArgb(63, 63, 74);
            _btnMaximize.Click += (s, e) => ToggleMaximize();

            // Close Button - Height matches Titlebar, turns Red on hover like native Win11 control
            _btnClose = new Button
            {
                Text = "\uE8BB",
                Font = new Font("Segoe MDL2 Assets", 9),
                Location = new Point(Width - 45, 0),
                Size = new Size(45, 50),
                BackColor = Color.Transparent,
                ForeColor = Color.FromArgb(220, 221, 230),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            _btnClose.FlatAppearance.BorderSize = 0;
            _btnClose.FlatAppearance.MouseOverBackColor = Color.FromArgb(232, 17, 35); // Native Close Red
            _btnClose.FlatAppearance.MouseDownBackColor = Color.FromArgb(241, 112, 122);
            _btnClose.Click += (s, e) => Hide(); // Hides instead of closing the app

            _pnlHeader.Controls.AddRange(new Control[] { _lblHeaderTitle, _btnMinimize, _btnMaximize, _btnClose });

            // 2. Left Panel: Quick Actions
            _pnlActions = new Panel
            {
                Location = new Point(20, 70),
                Size = new Size(360, 380),
                BackColor = Color.FromArgb(33, 33, 44)
            };

            _lblStatusTitle = new Label
            {
                Text = "CURRENT STATE",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                ForeColor = Color.FromArgb(9, 132, 227), // Accent Blue
                Location = new Point(25, 30), // Y shifted to 30 for top breathing room
                Size = new Size(310, 18)
            };

            _lblStatusText = new Label
            {
                Text = "Not Connected",
                Font = new Font("Segoe UI", 14, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(25, 53), // Y shifted to 53
                Size = new Size(310, 35),
                TextAlign = ContentAlignment.MiddleLeft
            };

            _lblTimerTitle = new Label
            {
                Text = "TIME TRACKING",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                ForeColor = Color.FromArgb(127, 140, 141),
                Location = new Point(25, 115), // Y shifted to 115
                Size = new Size(310, 18)
            };

            _lblTimerText = new Label
            {
                Text = "--h --m --s",
                Font = new Font("Consolas", 15, FontStyle.Bold),
                ForeColor = Color.FromArgb(220, 221, 230),
                Location = new Point(25, 138), // Y shifted to 138
                Size = new Size(310, 35),
                TextAlign = ContentAlignment.MiddleLeft
            };

            // Grid of Buttons (Large, spacious, and 0% text truncation)
            _btnCheckIn = new Button
            {
                Text = "Check In",
                Location = new Point(25, 210), // Y shifted to 210 for perfect spacing
                Size = new Size(150, 50),
                BackColor = Color.FromArgb(46, 204, 113), // Solid Green
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnCheckIn.FlatAppearance.BorderSize = 0;
            _btnCheckIn.Click += async (s, e) => await TriggerAction(ApiSync.CheckInAsync, "Checked in successfully!");

            _btnLunch = new Button
            {
                Text = "Lunch",
                Location = new Point(185, 210), // Y shifted to 210
                Size = new Size(150, 50),
                BackColor = Color.FromArgb(9, 132, 227),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnLunch.FlatAppearance.BorderSize = 0;
            _btnLunch.Click += async (s, e) => await TriggerBreakAction("Lunch Break");

            _btnTea = new Button
            {
                Text = "Tea Break",
                Location = new Point(25, 275), // Y shifted to 275
                Size = new Size(150, 50),
                BackColor = Color.FromArgb(9, 132, 227),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnTea.FlatAppearance.BorderSize = 0;
            _btnTea.Click += async (s, e) => {
                string breakType = "Tea Break";
                if (_btnTea.Text == "Evening Tea")
                    breakType = "Evening Tea Break";
                else if (DateTime.Now.Hour < 12)
                    breakType = "Morning Tea Break";
                else
                    breakType = "Evening Tea Break";
                await TriggerBreakAction(breakType);
            };

            _btnCheckOut = new Button
            {
                Text = "Check Out",
                Location = new Point(185, 275), // Y shifted to 275
                Size = new Size(150, 50),
                BackColor = Color.FromArgb(231, 76, 60), // Red
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnCheckOut.FlatAppearance.BorderSize = 0;
            _btnCheckOut.Click += async (s, e) => {
                var confirmResult = MessageBox.Show(
                    "Are you sure you want to check out? This will end your workday.",
                    "Confirm Check Out",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );
                if (confirmResult == DialogResult.Yes)
                {
                    await TriggerAction(ApiSync.CheckOutAsync, "Checked out successfully!");
                }
            };

            _pnlActions.Controls.AddRange(new Control[] {
                _lblStatusTitle, _lblStatusText, _lblTimerTitle, _lblTimerText,
                _btnCheckIn, _btnLunch, _btnTea, _btnCheckOut
            });

            // 3. Right Panel: Telemetry Activity Log
            _pnlLog = new Panel
            {
                Location = new Point(400, 70),
                Size = new Size(380, 380),
                BackColor = Color.FromArgb(33, 33, 44)
            };

            _lblLogTitle = new Label
            {
                Text = "📋 TELEMETRY ACTIVITY LOG",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                ForeColor = Color.FromArgb(127, 140, 141),
                Location = new Point(25, 30), // Y shifted to 30
                Size = new Size(330, 20)
            };

            // Custom Owner-Drawn ListBox to support state-specific colors
            _lstEvents = new ListBox
            {
                Location = new Point(25, 65), // Y shifted to 65
                Size = new Size(330, 290), // Height adjusted to 290 to maintain balanced Y layout
                BackColor = Color.FromArgb(20, 20, 26),
                ForeColor = Color.FromArgb(220, 221, 230),
                Font = new Font("Consolas", 9.5f),
                BorderStyle = BorderStyle.None,
                SelectionMode = SelectionMode.None,
                DrawMode = DrawMode.OwnerDrawFixed,
                ItemHeight = 22 // Spacious line heights
            };
            _lstEvents.DrawItem += ListEvents_DrawItem;

            _pnlLog.Controls.AddRange(new Control[] { _lblLogTitle, _lstEvents });

            // 4. Footer Panel
            _lblAccount = new Label
            {
                Text = "Account: Disconnected",
                Font = new Font("Segoe UI", 9.5f),
                ForeColor = Color.FromArgb(127, 140, 141),
                Location = new Point(20, 470),
                Size = new Size(400, 30),
                TextAlign = ContentAlignment.MiddleLeft
            };

            _btnSync = new Button
            {
                Text = "Sync Now",
                Location = new Point(540, 466),
                Size = new Size(110, 34),
                BackColor = Color.FromArgb(47, 54, 64),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnSync.FlatAppearance.BorderSize = 0;
            _btnSync.Click += (s, e) => _onSyncRequested();

            _btnDisconnect = new Button
            {
                Text = "Disconnect",
                Location = new Point(670, 466),
                Size = new Size(110, 34),
                BackColor = Color.FromArgb(192, 57, 43), // Muted red
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnDisconnect.FlatAppearance.BorderSize = 0;
            _btnDisconnect.Click += (s, e) => _onLogoutRequested();

            // Setup Seconds Timer (Ticks every 1 second to count active timers)
            _secondsTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            _secondsTimer.Tick += OnSecondsTimerTick;
            _secondsTimer.Start();

            // Add all layout panels to Form
            Controls.AddRange(new Control[] {
                _pnlHeader, _pnlActions, _pnlLog, _lblAccount, _btnSync, _btnDisconnect
            });

            // Set up initial layout coordinates
            LayoutControls();

            // Subscribe to Telemetry events
            ApiSync.OnEventLogged += OnEventLogged;
        }

        // Layout controls dynamically based on the form's current size
        private void LayoutControls()
        {
            var formWidth = ClientSize.Width;
            var formHeight = ClientSize.Height;

            // 1. Header Panel
            if (_pnlHeader != null)
            {
                _pnlHeader.Location = new Point(0, 0);
                _pnlHeader.Size = new Size(formWidth, 50);

                if (_lblHeaderTitle != null)
                {
                    _lblHeaderTitle.Location = new Point(20, 0);
                    _lblHeaderTitle.Size = new Size(Math.Max(200, formWidth - 160), 50);
                }

                if (_btnMinimize != null)
                {
                    _btnMinimize.Location = new Point(formWidth - 135, 0);
                    _btnMinimize.Size = new Size(45, 50);
                }

                if (_btnMaximize != null)
                {
                    _btnMaximize.Location = new Point(formWidth - 90, 0);
                    _btnMaximize.Size = new Size(45, 50);
                }

                if (_btnClose != null)
                {
                    _btnClose.Location = new Point(formWidth - 45, 0);
                    _btnClose.Size = new Size(45, 50);
                }
            }

            // 2. Main Panels
            var topY = 70;
            var bottomMargin = 65;
            var contentHeight = formHeight - topY - bottomMargin;
            var availableWidth = formWidth - 20 - 20 - 20; // margins & gap

            var leftWidth = (int)(availableWidth * 0.45);
            var rightWidth = availableWidth - leftWidth;

            if (_pnlActions != null)
            {
                _pnlActions.Location = new Point(20, topY);
                _pnlActions.Size = new Size(leftWidth, contentHeight);

                // Position Action controls
                if (_lblStatusTitle != null)
                {
                    _lblStatusTitle.Location = new Point(25, 30);
                    _lblStatusTitle.Size = new Size(leftWidth - 50, 18);
                }
                if (_lblStatusText != null)
                {
                    _lblStatusText.Location = new Point(25, 53);
                    _lblStatusText.Size = new Size(leftWidth - 50, 35);
                }
                if (_lblTimerTitle != null)
                {
                    _lblTimerTitle.Location = new Point(25, 115);
                    _lblTimerTitle.Size = new Size(leftWidth - 50, 18);
                }
                if (_lblTimerText != null)
                {
                    _lblTimerText.Location = new Point(25, 138);
                    _lblTimerText.Size = new Size(leftWidth - 50, 35);
                }

                var btnWidth = (leftWidth - 50 - 15) / 2;
                var buttonY1 = Math.Max(210, contentHeight - 170);
                var buttonY2 = buttonY1 + 65;

                if (_btnCheckIn != null)
                {
                    _btnCheckIn.Location = new Point(25, buttonY1);
                    _btnCheckIn.Size = new Size(btnWidth, 50);
                }
                if (_btnLunch != null)
                {
                    _btnLunch.Location = new Point(25 + btnWidth + 15, buttonY1);
                    _btnLunch.Size = new Size(btnWidth, 50);
                }
                if (_btnTea != null)
                {
                    _btnTea.Location = new Point(25, buttonY2);
                    _btnTea.Size = new Size(btnWidth, 50);
                }
                if (_btnCheckOut != null)
                {
                    _btnCheckOut.Location = new Point(25 + btnWidth + 15, buttonY2);
                    _btnCheckOut.Size = new Size(btnWidth, 50);
                }
            }

            if (_pnlLog != null)
            {
                _pnlLog.Location = new Point(20 + leftWidth + 20, topY);
                _pnlLog.Size = new Size(rightWidth, contentHeight);

                if (_lblLogTitle != null)
                {
                    _lblLogTitle.Location = new Point(25, 30);
                    _lblLogTitle.Size = new Size(rightWidth - 50, 20);
                }

                if (_lstEvents != null)
                {
                    _lstEvents.Location = new Point(25, 65);
                    _lstEvents.Size = new Size(rightWidth - 50, contentHeight - 65 - 25);
                }
            }

            // 3. Footer Controls
            if (_lblAccount != null)
            {
                _lblAccount.Location = new Point(20, formHeight - 50);
                _lblAccount.Size = new Size(Math.Max(150, formWidth / 2), 30);
            }

            if (_btnDisconnect != null)
            {
                _btnDisconnect.Location = new Point(formWidth - 20 - 110, formHeight - 54);
                _btnDisconnect.Size = new Size(110, 34);
            }

            if (_btnSync != null && _btnDisconnect != null)
            {
                _btnSync.Location = new Point(_btnDisconnect.Left - 15 - 110, formHeight - 54);
                _btnSync.Size = new Size(110, 34);
            }
        }

        // Custom rendering for ListBox items to apply type-specific colors
        private void ListEvents_DrawItem(object? sender, DrawItemEventArgs e)
        {
            if (e.Index < 0 || e.Index >= _lstEvents.Items.Count) return;

            // Paint dark background for all items
            using (var backBrush = new SolidBrush(Color.FromArgb(20, 20, 26)))
            {
                e.Graphics.FillRectangle(backBrush, e.Bounds);
            }

            var entry = _lstEvents.Items[e.Index] as LogEntry;
            if (entry != null)
            {
                using (var foreBrush = new SolidBrush(entry.Color))
                {
                    // Draw text centered vertically inside the spacious item height
                    e.Graphics.DrawString(entry.Message, e.Font ?? _lstEvents.Font, foreBrush, e.Bounds.X + 5, e.Bounds.Y + 3);
                }
            }
        }

        // Maximize/Restore Toggle
        private void ToggleMaximize()
        {
            if (WindowState == FormWindowState.Maximized)
            {
                WindowState = FormWindowState.Normal;
            }
            else
            {
                WindowState = FormWindowState.Maximized;
            }
        }

        // Enable custom resizing from window borders in borderless mode
        protected override void WndProc(ref Message m)
        {
            const int WM_NCHITTEST = 0x84;
            const int HTLEFT = 10;
            const int HTRIGHT = 11;
            const int HTTOP = 12;
            const int HTTOPLEFT = 13;
            const int HTTOPRIGHT = 14;
            const int HTBOTTOM = 15;
            const int HTBOTTOMLEFT = 16;
            const int HTBOTTOMRIGHT = 17;

            if (m.Msg == WM_NCHITTEST)
            {
                base.WndProc(ref m);
                if (m.Result.ToInt32() == 1) // HTCLIENT
                {
                    Point screenPoint = new Point(m.LParam.ToInt32() & 0xffff, m.LParam.ToInt32() >> 16);
                    Point clientPoint = PointToClient(screenPoint);

                    const int borderThickness = 8; // Resize zone width

                    if (clientPoint.Y <= borderThickness)
                    {
                        if (clientPoint.X <= borderThickness) m.Result = (IntPtr)HTTOPLEFT;
                        else if (clientPoint.X >= ClientSize.Width - borderThickness) m.Result = (IntPtr)HTTOPRIGHT;
                        else m.Result = (IntPtr)HTTOP;
                    }
                    else if (clientPoint.Y >= ClientSize.Height - borderThickness)
                    {
                        if (clientPoint.X <= borderThickness) m.Result = (IntPtr)HTBOTTOMLEFT;
                        else if (clientPoint.X >= ClientSize.Width - borderThickness) m.Result = (IntPtr)HTBOTTOMRIGHT;
                        else m.Result = (IntPtr)HTBOTTOM;
                    }
                    else
                    {
                        if (clientPoint.X <= borderThickness) m.Result = (IntPtr)HTLEFT;
                        else if (clientPoint.X >= ClientSize.Width - borderThickness) m.Result = (IntPtr)HTRIGHT;
                    }
                }
                return;
            }
            base.WndProc(ref m);
        }

        private void HeaderPanel_MouseDown(object? sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left && WindowState != FormWindowState.Maximized)
            {
                ReleaseCapture();
                SendMessage(Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
            }
        }

        private void SetButtonState(Button btn, bool enabled, Color activeBackColor)
        {
            btn.Enabled = enabled;
            if (enabled)
            {
                btn.BackColor = activeBackColor;
                btn.ForeColor = Color.White;
            }
            else
            {
                btn.BackColor = Color.FromArgb(45, 45, 60); // Dark muted slate
                btn.ForeColor = Color.FromArgb(100, 100, 120); // Muted low-contrast gray
            }
        }

        public void UpdateState(AttendanceRecord? attendance, List<BreakSessionRecord> breaks)
        {
            _currentAttendance = attendance;
            _currentBreaks = breaks;

            if (InvokeRequired)
            {
                Invoke(new Action(() => UpdateState(attendance, breaks)));
                return;
            }

            // Update header title with user name
            _lblHeaderTitle.Text = ApiSync.IsLoggedIn && !string.IsNullOrEmpty(ApiSync.CurrentName)
                ? $"🛡️ IntelliHrHub Desktop Agent | {ApiSync.CurrentName}"
                : "🛡️ IntelliHrHub Desktop Agent";

            // Update footer email
            _lblAccount.Text = ApiSync.IsLoggedIn ? $"Linked: {ApiSync.CurrentEmail}" : "Account: Disconnected";

            // Default State
            bool hasCheckedIn = attendance?.CheckInTime != null;
            bool hasCheckedOut = attendance?.CheckOutTime != null;
            bool isOnBreak = breaks.Exists(b => b.EndTime == null);

            // Set default disabled states
            SetButtonState(_btnCheckIn, false, Color.FromArgb(46, 204, 113));
            SetButtonState(_btnLunch, false, Color.FromArgb(9, 132, 227));
            SetButtonState(_btnTea, false, Color.FromArgb(9, 132, 227));
            SetButtonState(_btnCheckOut, false, Color.FromArgb(231, 76, 60));

            // Clear dynamic text overrides
            _btnCheckIn.Text = "Check In";
            _btnLunch.Text = "Lunch";
            _btnTea.Text = "Tea Break";
            _btnCheckOut.Text = "Check Out";

            if (!ApiSync.IsLoggedIn)
            {
                _lblStatusText.Text = "Disconnected";
                _lblStatusText.ForeColor = Color.FromArgb(231, 76, 60);
                return;
            }

            if (!hasCheckedIn)
            {
                _lblStatusText.Text = "Ready to Check-In";
                _lblStatusText.ForeColor = Color.FromArgb(46, 204, 113);
                SetButtonState(_btnCheckIn, true, Color.FromArgb(46, 204, 113));
            }
            else if (isOnBreak)
            {
                var activeBreak = breaks.Find(b => b.EndTime == null);
                string breakName = "Break";
                if (activeBreak != null && DateTimeOffset.TryParse(activeBreak.StartTime, out var startOffset))
                {
                    var localStart = startOffset.LocalDateTime;
                    if (localStart.Hour == 10 || (localStart.Hour == 11 && localStart.Minute <= 15))
                    {
                        breakName = "Morning Tea";
                        _btnTea.Text = "End Tea";
                        SetButtonState(_btnTea, true, Color.FromArgb(231, 76, 60));
                    }
                    else if (localStart.Hour == 12 || localStart.Hour == 13) // Replaced Hour 14 (Lunch ends by 2:00 PM)
                    {
                        breakName = "Lunch";
                        _btnLunch.Text = "End Lunch";
                        SetButtonState(_btnLunch, true, Color.FromArgb(231, 76, 60));
                    }
                    else
                    {
                        breakName = "Evening Tea";
                        _btnTea.Text = "End Tea";
                        SetButtonState(_btnTea, true, Color.FromArgb(231, 76, 60));
                    }
                }
                _lblStatusText.Text = $"On {breakName}";
                _lblStatusText.ForeColor = Color.FromArgb(230, 126, 34); // Orange
            }
            else if (!hasCheckedOut)
            {
                _lblStatusText.Text = "Active / Working";
                _lblStatusText.ForeColor = Color.FromArgb(9, 132, 227); // Blue

                // Check which breaks were already taken today to hide/disable them
                bool tookMorningTea = breaks.Exists(b => {
                    if (DateTimeOffset.TryParse(b.StartTime, out var startOffset))
                    {
                        var localStart = startOffset.LocalDateTime;
                        return localStart.Hour == 10 || (localStart.Hour == 11 && localStart.Minute <= 15);
                    }
                    return false;
                });

                bool tookLunch = breaks.Exists(b => {
                    if (DateTimeOffset.TryParse(b.StartTime, out var startOffset))
                    {
                        var localStart = startOffset.LocalDateTime;
                        return localStart.Hour == 12 || localStart.Hour == 13; // Replaced Hour 14
                    }
                    return false;
                });

                bool tookEveningTea = breaks.Exists(b => {
                    if (DateTimeOffset.TryParse(b.StartTime, out var startOffset))
                    {
                        var localStart = startOffset.LocalDateTime;
                        return localStart.Hour == 14 || localStart.Hour == 15 || localStart.Hour == 16 || localStart.Hour == 17; // Added Hour 14 (2:00 PM - 5:59 PM)
                    }
                    return false;
                });

                // Enable buttons if they haven't taken the break yet
                SetButtonState(_btnLunch, !tookLunch, Color.FromArgb(9, 132, 227));
                SetButtonState(_btnTea, !tookMorningTea || !tookEveningTea, Color.FromArgb(9, 132, 227));
                
                // Set button labels dynamically
                if (DateTime.Now.Hour < 12)
                {
                    if (!tookMorningTea)
                    {
                        _btnTea.Text = "Morning Tea";
                        SetButtonState(_btnTea, true, Color.FromArgb(9, 132, 227));
                    }
                    else
                    {
                        _btnTea.Text = "Morning Tea Done";
                        SetButtonState(_btnTea, false, Color.FromArgb(9, 132, 227));
                    }
                }
                else
                {
                    if (!tookEveningTea)
                    {
                        _btnTea.Text = "Evening Tea";
                        SetButtonState(_btnTea, true, Color.FromArgb(9, 132, 227));
                    }
                    else
                    {
                        _btnTea.Text = "Tea Done";
                        SetButtonState(_btnTea, false, Color.FromArgb(9, 132, 227));
                    }
                }

                if (tookLunch)
                {
                    _btnLunch.Text = "Lunch Done";
                }

                SetButtonState(_btnCheckOut, true, Color.FromArgb(231, 76, 60));
            }
            else
            {
                _lblStatusText.Text = "Shift Completed";
                _lblStatusText.ForeColor = Color.FromArgb(127, 140, 141); // Gray
            }
        }

        private async Task TriggerAction(Func<Task<bool>> apiCall, string successMsg)
        {
            SetButtonState(_btnCheckIn, false, Color.FromArgb(46, 204, 113));
            SetButtonState(_btnLunch, false, Color.FromArgb(9, 132, 227));
            SetButtonState(_btnTea, false, Color.FromArgb(9, 132, 227));
            SetButtonState(_btnCheckOut, false, Color.FromArgb(231, 76, 60));

            _lblStatusText.Text = "Syncing...";

            try
            {
                bool success = await apiCall();
                if (success)
                {
                    MessageBox.Show(successMsg, "IntelliHrHub", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                else
                {
                    MessageBox.Show("Sync failed. Check your network connection.", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                _onSyncRequested(); // Triggers a status refresh
            }
        }

        private async Task TriggerBreakAction(string breakType)
        {
            bool isOnBreak = _currentBreaks.Exists(b => b.EndTime == null);
            if (isOnBreak)
            {
                var activeBreak = _currentBreaks.Find(b => b.EndTime == null);
                string breakName = "Break";
                if (activeBreak != null && DateTimeOffset.TryParse(activeBreak.StartTime, out var startOffset))
                {
                    var localStart = startOffset.LocalDateTime;
                    if (localStart.Hour == 10 || (localStart.Hour == 11 && localStart.Minute <= 15))
                        breakName = "Morning Tea Break";
                    else if (localStart.Hour == 12 || localStart.Hour == 13)
                        breakName = "Lunch Break";
                    else
                        breakName = "Evening Tea Break";
                }
                var confirmResult = MessageBox.Show(
                    $"Are you sure you want to end your {breakName} and return to work?",
                    "Confirm End Break",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );
                if (confirmResult == DialogResult.Yes)
                {
                    await TriggerAction(ApiSync.EndBreakAsync, $"{breakName} ended successfully!");
                }
            }
            else
            {
                var confirmResult = MessageBox.Show(
                    $"Are you sure you want to start your {breakType}?",
                    "Confirm Start Break",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );
                if (confirmResult == DialogResult.Yes)
                {
                    await TriggerAction(ApiSync.StartBreakAsync, $"{breakType} started successfully!");
                }
            }
        }

        private void OnSecondsTimerTick(object? sender, EventArgs e)
        {
            if (!ApiSync.IsLoggedIn || _currentAttendance == null)
            {
                _lblTimerText.Text = "--h --m --s";
                return;
            }

            bool hasCheckedIn = _currentAttendance.CheckInTime != null;
            bool hasCheckedOut = _currentAttendance.CheckOutTime != null;
            bool isOnBreak = _currentBreaks.Exists(b => b.EndTime == null);

            if (!hasCheckedIn)
            {
                _lblTimerText.Text = "Shift not started";
                return;
            }

            if (isOnBreak)
            {
                _lblTimerTitle.Text = "ACTIVE BREAK DURATION";
                var activeBreak = _currentBreaks.Find(b => b.EndTime == null);
                if (activeBreak != null && DateTimeOffset.TryParse(activeBreak.StartTime, out var startOffset))
                {
                    var elapsed = DateTimeOffset.UtcNow - startOffset;
                    if (elapsed < TimeSpan.Zero) elapsed = TimeSpan.Zero;
                    _lblTimerText.Text = string.Format("{0:00}h {1:00}m {2:00}s", elapsed.Hours, elapsed.Minutes, elapsed.Seconds);
                    _lblTimerText.ForeColor = Color.FromArgb(230, 126, 34); // Orange
                }
            }
            else if (!hasCheckedOut)
            {
                _lblTimerTitle.Text = "ACTIVE SHIFT ELAPSED TIME";
                if (DateTimeOffset.TryParse(_currentAttendance.CheckInTime, out var checkInOffset))
                {
                    var elapsed = DateTimeOffset.UtcNow - checkInOffset;
                    if (elapsed < TimeSpan.Zero) elapsed = TimeSpan.Zero;
                    _lblTimerText.Text = string.Format("{0:00}h {1:00}m {2:00}s", elapsed.Hours, elapsed.Minutes, elapsed.Seconds);
                    _lblTimerText.ForeColor = Color.FromArgb(46, 204, 113); // Green
                }
            }
            else
            {
                _lblTimerTitle.Text = "SHIFT TOTAL WORKED TIME";
                if (DateTimeOffset.TryParse(_currentAttendance.CheckInTime, out var checkInOffset) && DateTimeOffset.TryParse(_currentAttendance.CheckOutTime, out var checkOutOffset))
                {
                    var elapsed = checkOutOffset - checkInOffset;
                    if (elapsed < TimeSpan.Zero) elapsed = TimeSpan.Zero;
                    _lblTimerText.Text = string.Format("{0:00}h {1:00}m {2:00}s (Done)", elapsed.Hours, elapsed.Minutes, elapsed.Seconds);
                    _lblTimerText.ForeColor = Color.FromArgb(127, 140, 141); // Gray
                }
            }
        }

        private void OnEventLogged(string eventType, DateTime timestamp)
        {
            if (InvokeRequired)
            {
                Invoke(new Action(() => OnEventLogged(eventType, timestamp)));
                return;
            }

            string timeStr = timestamp.ToString("hh:mm:ss tt");
            string eventDesc = eventType;
            Color eventColor = Color.FromArgb(220, 221, 230); // Default silver/white

            // Translate technical telemetry triggers to beautiful readable text and assign colors
            switch (eventType)
            {
                case "IDLE_START":
                    eventDesc = "Idle State (User away from desk)";
                    eventColor = Color.FromArgb(230, 126, 34); // Orange
                    break;
                case "IDLE_END":
                    eventDesc = "Active State (User returned to desk)";
                    eventColor = Color.FromArgb(46, 204, 113); // Green
                    break;
                case "LOCK":
                    eventDesc = "Workstation Locked";
                    eventColor = Color.FromArgb(231, 76, 60); // Red
                    break;
                case "UNLOCK":
                    eventDesc = "Workstation Unlocked";
                    eventColor = Color.FromArgb(46, 204, 113); // Green
                    break;
                case "WAKE":
                    eventDesc = "System Awake from sleep";
                    eventColor = Color.FromArgb(52, 152, 219); // Blue
                    break;
                case "SUSPEND":
                    eventDesc = "System Suspend / Sleep Mode";
                    eventColor = Color.FromArgb(155, 89, 182); // Purple
                    break;
            }

            _lstEvents.Items.Add(new LogEntry { Message = $"[{timeStr}] {eventDesc}", Color = eventColor });

            // Auto scroll ListBox
            _lstEvents.TopIndex = _lstEvents.Items.Count - 1;
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                Hide(); // Minimize to tray instead of quitting the application
            }
            else
            {
                base.OnFormClosing(e);
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                ApiSync.OnEventLogged -= OnEventLogged;
                _secondsTimer?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
