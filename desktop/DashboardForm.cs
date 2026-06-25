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

        public DashboardForm(Action onSyncRequested, Action onLogoutRequested)
        {
            _onSyncRequested = onSyncRequested;
            _onLogoutRequested = onLogoutRequested;

            // Form Configurations
            Size = new Size(570, 395);
            FormBorderStyle = FormBorderStyle.None;
            BackColor = Color.FromArgb(24, 24, 32); // Modern Dark Slate
            StartPosition = FormStartPosition.CenterScreen;
            Text = "IntelliHrHub Agent Dashboard";
            Icon = SystemIcons.Shield;

            // Apply GDI Rounded Corners
            Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 16, 16));

            // 1. Header Panel (Draggable)
            _pnlHeader = new Panel
            {
                Size = new Size(Width, 40),
                Location = new Point(0, 0),
                BackColor = Color.FromArgb(33, 33, 44),
                Cursor = Cursors.SizeAll
            };
            _pnlHeader.MouseDown += HeaderPanel_MouseDown;

            _lblHeaderTitle = new Label
            {
                Text = "🛡️ IntelliHrHub Desktop Agent",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(245, 246, 250),
                Location = new Point(15, 0),
                Size = new Size(250, 40),
                TextAlign = ContentAlignment.MiddleLeft,
                Cursor = Cursors.SizeAll
            };
            _lblHeaderTitle.MouseDown += HeaderPanel_MouseDown;

            _btnMinimize = new Button
            {
                Text = "—",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(Width - 75, 5),
                Size = new Size(30, 30),
                BackColor = Color.Transparent,
                ForeColor = Color.FromArgb(127, 140, 141),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            _btnMinimize.FlatAppearance.BorderSize = 0;
            _btnMinimize.Click += (s, e) => WindowState = FormWindowState.Minimized;

            _btnClose = new Button
            {
                Text = "✕",
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Location = new Point(Width - 40, 5),
                Size = new Size(30, 30),
                BackColor = Color.Transparent,
                ForeColor = Color.FromArgb(127, 140, 141),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            _btnClose.FlatAppearance.BorderSize = 0;
            _btnClose.Click += (s, e) => Hide(); // Hides instead of closing the app

            _pnlHeader.Controls.AddRange(new Control[] { _lblHeaderTitle, _btnMinimize, _btnClose });

            // 2. Left Panel: Quick Actions
            _pnlActions = new Panel
            {
                Location = new Point(15, 55),
                Size = new Size(250, 290),
                BackColor = Color.FromArgb(33, 33, 44)
            };

            _lblStatusTitle = new Label
            {
                Text = "CURRENT STATE",
                Font = new Font("Segoe UI", 8, FontStyle.Bold),
                ForeColor = Color.FromArgb(9, 132, 227), // Accent Blue
                Location = new Point(15, 15),
                Size = new Size(220, 15)
            };

            _lblStatusText = new Label
            {
                Text = "Not Connected",
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(15, 32),
                Size = new Size(220, 25),
                TextAlign = ContentAlignment.MiddleLeft
            };

            _lblTimerTitle = new Label
            {
                Text = "TIME TRACKING",
                Font = new Font("Segoe UI", 8, FontStyle.Bold),
                ForeColor = Color.FromArgb(127, 140, 141),
                Location = new Point(15, 65),
                Size = new Size(220, 15)
            };

            _lblTimerText = new Label
            {
                Text = "--h --m --s",
                Font = new Font("Consolas", 12, FontStyle.Bold),
                ForeColor = Color.FromArgb(220, 221, 230),
                Location = new Point(15, 82),
                Size = new Size(220, 25),
                TextAlign = ContentAlignment.MiddleLeft
            };

            // Grid of Buttons
            _btnCheckIn = new Button
            {
                Text = "🌅 Check In",
                Location = new Point(15, 125),
                Size = new Size(105, 40),
                BackColor = Color.FromArgb(46, 204, 113), // Solid Green
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnCheckIn.FlatAppearance.BorderSize = 0;
            _btnCheckIn.Click += async (s, e) => await TriggerAction(ApiSync.CheckInAsync, "Checked in successfully!");

            _btnLunch = new Button
            {
                Text = "🍱 Lunch",
                Location = new Point(130, 125),
                Size = new Size(105, 40),
                BackColor = Color.FromArgb(9, 132, 227),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnLunch.FlatAppearance.BorderSize = 0;
            _btnLunch.Click += async (s, e) => await TriggerBreakAction();

            _btnTea = new Button
            {
                Text = "☕ Tea Break",
                Location = new Point(15, 180),
                Size = new Size(105, 40),
                BackColor = Color.FromArgb(9, 132, 227),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnTea.FlatAppearance.BorderSize = 0;
            _btnTea.Click += async (s, e) => await TriggerBreakAction();

            _btnCheckOut = new Button
            {
                Text = "🚪 Check Out",
                Location = new Point(130, 180),
                Size = new Size(105, 40),
                BackColor = Color.FromArgb(231, 76, 60), // Red
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
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
                Location = new Point(280, 55),
                Size = new Size(275, 290),
                BackColor = Color.FromArgb(33, 33, 44)
            };

            _lblLogTitle = new Label
            {
                Text = "📋 TELEMETRY ACTIVITY LOG",
                Font = new Font("Segoe UI", 8, FontStyle.Bold),
                ForeColor = Color.FromArgb(127, 140, 141),
                Location = new Point(15, 15),
                Size = new Size(240, 15)
            };

            _lstEvents = new ListBox
            {
                Location = new Point(15, 35),
                Size = new Size(245, 240),
                BackColor = Color.FromArgb(20, 20, 26),
                ForeColor = Color.FromArgb(220, 221, 230),
                Font = new Font("Consolas", 8.5f),
                BorderStyle = BorderStyle.None,
                SelectionMode = SelectionMode.None
            };

            _pnlLog.Controls.AddRange(new Control[] { _lblLogTitle, _lstEvents });

            // 4. Footer Panel
            _lblAccount = new Label
            {
                Text = "Account: Disconnected",
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = Color.FromArgb(127, 140, 141),
                Location = new Point(15, 355),
                Size = new Size(250, 30),
                TextAlign = ContentAlignment.MiddleLeft
            };

            _btnSync = new Button
            {
                Text = "Sync Now",
                Location = new Point(365, 353),
                Size = new Size(90, 28),
                BackColor = Color.FromArgb(47, 54, 64),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f),
                Cursor = Cursors.Hand
            };
            _btnSync.FlatAppearance.BorderSize = 0;
            _btnSync.Click += (s, e) => _onSyncRequested();

            _btnDisconnect = new Button
            {
                Text = "Disconnect",
                Location = new Point(465, 353),
                Size = new Size(90, 28),
                BackColor = Color.FromArgb(192, 57, 43), // Muted red
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f),
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

            // Subscribe to Telemetry events
            ApiSync.OnEventLogged += OnEventLogged;
        }

        private void HeaderPanel_MouseDown(object? sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                ReleaseCapture();
                SendMessage(Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
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

            // Update footer email
            _lblAccount.Text = ApiSync.IsLoggedIn ? $"Linked: {ApiSync.CurrentEmail}" : "Account: Disconnected";

            // Default State
            bool hasCheckedIn = attendance?.CheckInTime != null;
            bool hasCheckedOut = attendance?.CheckOutTime != null;
            bool isOnBreak = breaks.Exists(b => b.EndTime == null);

            // Clear styling and set defaults
            _btnCheckIn.Text = "🌅 Check In";
            _btnLunch.Text = "🍱 Lunch";
            _btnTea.Text = "☕ Tea Break";
            _btnCheckOut.Text = "🚪 Check Out";

            _btnCheckIn.BackColor = Color.FromArgb(46, 204, 113); // Green
            _btnLunch.BackColor = Color.FromArgb(9, 132, 227); // Blue
            _btnTea.BackColor = Color.FromArgb(9, 132, 227); // Blue
            _btnCheckOut.BackColor = Color.FromArgb(231, 76, 60); // Red

            _btnCheckIn.Enabled = false;
            _btnLunch.Enabled = false;
            _btnTea.Enabled = false;
            _btnCheckOut.Enabled = false;

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
                _btnCheckIn.Enabled = true;
            }
            else if (isOnBreak)
            {
                var activeBreak = breaks.Find(b => b.EndTime == null);
                string breakName = "Break";
                if (activeBreak != null && DateTime.TryParse(activeBreak.StartTime, out var start))
                {
                    var localStart = start.ToLocalTime();
                    if (localStart.Hour == 10 || (localStart.Hour == 11 && localStart.Minute <= 15))
                    {
                        breakName = "Morning Tea";
                        _btnTea.Text = "🛑 End Tea";
                        _btnTea.BackColor = Color.FromArgb(231, 76, 60);
                        _btnTea.Enabled = true;
                    }
                    else if (localStart.Hour == 12 || localStart.Hour == 13 || localStart.Hour == 14)
                    {
                        breakName = "Lunch";
                        _btnLunch.Text = "🛑 End Lunch";
                        _btnLunch.BackColor = Color.FromArgb(231, 76, 60);
                        _btnLunch.Enabled = true;
                    }
                    else
                    {
                        breakName = "Evening Tea";
                        _btnTea.Text = "🛑 End Tea";
                        _btnTea.BackColor = Color.FromArgb(231, 76, 60);
                        _btnTea.Enabled = true;
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
                    if (DateTime.TryParse(b.StartTime, out var start))
                    {
                        var localStart = start.ToLocalTime();
                        return localStart.Hour == 10 || (localStart.Hour == 11 && localStart.Minute <= 15);
                    }
                    return false;
                });

                bool tookLunch = breaks.Exists(b => {
                    if (DateTime.TryParse(b.StartTime, out var start))
                    {
                        var localStart = start.ToLocalTime();
                        return localStart.Hour == 12 || localStart.Hour == 13 || localStart.Hour == 14;
                    }
                    return false;
                });

                bool tookEveningTea = breaks.Exists(b => {
                    if (DateTime.TryParse(b.StartTime, out var start))
                    {
                        var localStart = start.ToLocalTime();
                        return localStart.Hour == 15 || localStart.Hour == 16 || localStart.Hour == 17;
                    }
                    return false;
                });

                // Enable buttons if they haven't taken the break yet
                _btnLunch.Enabled = !tookLunch;
                _btnTea.Enabled = !tookMorningTea || !tookEveningTea;
                
                // Set button labels dynamically
                if (tookMorningTea && !tookEveningTea)
                {
                    _btnTea.Text = "☕ Evening Tea";
                }
                else if (tookMorningTea && tookEveningTea)
                {
                    _btnTea.Text = "☕ Tea Done";
                    _btnTea.Enabled = false;
                }

                if (tookLunch)
                {
                    _btnLunch.Text = "🍱 Lunch Done";
                }

                _btnCheckOut.Enabled = true;
            }
            else
            {
                _lblStatusText.Text = "Shift Completed";
                _lblStatusText.ForeColor = Color.FromArgb(127, 140, 141); // Gray
            }
        }

        private async Task TriggerAction(Func<Task<bool>> apiCall, string successMsg)
        {
            _btnCheckIn.Enabled = false;
            _btnLunch.Enabled = false;
            _btnTea.Enabled = false;
            _btnCheckOut.Enabled = false;

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

        private async Task TriggerBreakAction()
        {
            bool isOnBreak = _currentBreaks.Exists(b => b.EndTime == null);
            if (isOnBreak)
            {
                await TriggerAction(ApiSync.EndBreakAsync, "Break session ended successfully!");
            }
            else
            {
                await TriggerAction(ApiSync.StartBreakAsync, "Break session started successfully!");
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

            // Translate technical telemetry triggers to beautiful readable text
            switch (eventType)
            {
                case "IDLE_START":
                    eventDesc = "Idle State (User away from desk)";
                    break;
                case "IDLE_END":
                    eventDesc = "Active State (User returned to desk)";
                    break;
                case "LOCK":
                    eventDesc = "Workstation Locked";
                    break;
                case "UNLOCK":
                    eventDesc = "Workstation Unlocked";
                    break;
                case "WAKE":
                    eventDesc = "System Awake from sleep";
                    break;
                case "SUSPEND":
                    eventDesc = "System Suspend / Sleep Mode";
                    break;
            }

            _lstEvents.Items.Add($"[{timeStr}] {eventDesc}");

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
