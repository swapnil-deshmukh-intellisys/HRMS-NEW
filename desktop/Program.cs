using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace HRMS_Agent
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            ApplicationConfiguration.Initialize();
            
            using var context = new HRMSApplicationContext();
            Application.Run(context);
        }
    }

    public class HRMSApplicationContext : ApplicationContext
    {
        private enum ReminderType
        {
            CheckIn,
            MorningTea,
            Lunch,
            EveningTea,
            CheckOut
        }

        private readonly NotifyIcon _trayIcon;
        private readonly SessionMonitor _sessionMonitor;
        private readonly IdleTracker _idleTracker;
        private readonly ToolStripMenuItem _statusMenuItem;
        private readonly ToolStripMenuItem _connectMenuItem;

        // Timers for background operations
        private readonly System.Windows.Forms.Timer _pollTimer;
        private readonly System.Windows.Forms.Timer _reminderTimer;

        // Daily reminder flags to avoid double-triggering
        private DateTime? _lastCheckInReminderDate;
        private DateTime? _lastMorningTeaReminderDate;
        private DateTime? _lastLunchReminderDate;
        private DateTime? _lastEveningTeaReminderDate;
        private DateTime? _lastCheckOutReminderDate;

        // Snooze status
        private DateTime? _snoozeUntil;
        private ReminderType? _snoozedReminderType;
        private ReminderForm? _activeReminderForm;

        // Dashboard Form instance
        private DashboardForm? _dashboardForm;

        public HRMSApplicationContext()
        {
            // Initialize event monitors
            _sessionMonitor = new SessionMonitor();
            _idleTracker = new IdleTracker();

            // Set up context menu
            var contextMenu = new ContextMenuStrip();

            _statusMenuItem = new ToolStripMenuItem("Status: Initializing...") { Enabled = false };
            _connectMenuItem = new ToolStripMenuItem("Connect Account...", null, OnConnectClick);

            contextMenu.Items.AddRange(new ToolStripItem[]
            {
                _statusMenuItem,
                new ToolStripSeparator(),
                _connectMenuItem,
                new ToolStripSeparator(),
                new ToolStripMenuItem("Exit", null, OnExitClick) // Placeholder
            });

            // Set up System Tray Icon
            _trayIcon = new NotifyIcon
            {
                Icon = SystemIcons.Shield,
                ContextMenuStrip = contextMenu,
                Visible = true,
                Text = "IntelliHrHub Desktop Agent"
            };

            // Double-click tray icon opens the interactive dashboard
            _trayIcon.DoubleClick += (s, e) => ShowDashboardForm();

            // Register event handler for API status updates
            ApiSync.OnStatusChanged += UpdateStatusText;

            // Start monitors
            _sessionMonitor.Start();
            _idleTracker.Start();

            // Initialize Polling Timer (Runs every 60 seconds to refresh status)
            _pollTimer = new System.Windows.Forms.Timer { Interval = 60000 };
            _pollTimer.Tick += async (s, e) => await RefreshStatusAndMenuAsync();
            _pollTimer.Start();

            // Initialize Reminder Timer (Runs every 30 seconds to evaluate schedules)
            _reminderTimer = new System.Windows.Forms.Timer { Interval = 30000 };
            _reminderTimer.Tick += OnReminderTimerTick;
            _reminderTimer.Start();

            // Perform initial refresh
            _ = RefreshStatusAndMenuAsync();

            if (!ApiSync.IsLoggedIn)
            {
                // Execute shortly after application startup is complete
                System.Windows.Forms.Timer startupTimer = new System.Windows.Forms.Timer { Interval = 100 };
                startupTimer.Tick += (s, e) =>
                {
                    startupTimer.Stop();
                    startupTimer.Dispose();
                    ShowLoginForm();
                };
                startupTimer.Start();
            }
            else
            {
                // Show dashboard automatically if already logged in
                System.Windows.Forms.Timer startupTimer = new System.Windows.Forms.Timer { Interval = 200 };
                startupTimer.Tick += (s, e) =>
                {
                    startupTimer.Stop();
                    startupTimer.Dispose();
                    ShowDashboardForm();
                };
                startupTimer.Start();
            }
        }

        private void UpdateStatusText(string status)
        {
            if (_statusMenuItem.Owner?.InvokeRequired ?? false)
            {
                _statusMenuItem.Owner.Invoke(new Action(() => UpdateStatusText(status)));
                return;
            }

            _statusMenuItem.Text = $"Status: {status}";
            
            if (ApiSync.IsLoggedIn)
            {
                _connectMenuItem.Text = "Disconnect / Change Account";
                _trayIcon.Text = $"IntelliHrHub Agent ({ApiSync.CurrentEmail})";
            }
            else
            {
                _connectMenuItem.Text = "Connect Account...";
                _trayIcon.Text = "IntelliHrHub Desktop Agent (Disconnected)";
            }
        }

        private void ShowDashboardForm()
        {
            if (!ApiSync.IsLoggedIn)
            {
                ShowLoginForm();
                return;
            }

            if (_dashboardForm == null || _dashboardForm.IsDisposed)
            {
                _dashboardForm = new DashboardForm(
                    async () => {
                        // On manual sync requested from Dashboard
                        UpdateStatusText("Syncing...");
                        await ApiSync.ProcessOfflineQueueAsync();
                        await RefreshStatusAndMenuAsync();
                    },
                    () => {
                        // On logout requested from Dashboard
                        var result = MessageBox.Show(
                            "Are you sure you want to disconnect and log out of your account?",
                            "Confirm Disconnect",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question
                        );
                        if (result == DialogResult.Yes)
                        {
                            ApiSync.Logout();
                            _dashboardForm?.Hide(); // Close/Hide dashboard window
                            _ = RefreshStatusAndMenuAsync();
                            ShowLoginForm();
                        }
                    }
                );
            }

            // Sync the state immediately on show
            _ = RefreshStatusAndMenuAsync();

            _dashboardForm.Show();
            _dashboardForm.Activate();
            if (_dashboardForm.WindowState == FormWindowState.Minimized)
            {
                _dashboardForm.WindowState = FormWindowState.Normal;
            }
        }

        private async Task RefreshStatusAndMenuAsync()
        {
            if (!ApiSync.IsLoggedIn)
            {
                UpdateTrayContextMenu(null, new List<BreakSessionRecord>());
                UpdateStatusText("Not connected");
                _dashboardForm?.UpdateState(null, new List<BreakSessionRecord>());
                return;
            }

            if (string.IsNullOrEmpty(ApiSync.CurrentName))
            {
                await ApiSync.FetchProfileAsync();
            }

            var attendance = await ApiSync.GetAttendanceTodayAsync();
            var breaks = await ApiSync.GetBreaksTodayAsync();

            UpdateTrayContextMenu(attendance, breaks);

            // Forward state to the Dashboard mini-app window
            if (_dashboardForm != null && !_dashboardForm.IsDisposed)
            {
                _dashboardForm.UpdateState(attendance, breaks);
            }

            string statusText = $"Connected as {ApiSync.CurrentEmail}";
            if (attendance != null)
            {
                bool isOnBreak = breaks.Exists(b => b.EndTime == null);
                if (isOnBreak)
                {
                    statusText = "On Break";
                }
                else if (attendance.CheckOutTime != null)
                {
                    statusText = "Checked Out";
                }
                else if (attendance.CheckInTime != null)
                {
                    statusText = "Active / Working";
                }
            }
            UpdateStatusText(statusText);
        }

        private void UpdateTrayContextMenu(AttendanceRecord? attendance, List<BreakSessionRecord> breaks)
        {
            if (_trayIcon.ContextMenuStrip.InvokeRequired)
            {
                _trayIcon.ContextMenuStrip.Invoke(new Action(() => UpdateTrayContextMenu(attendance, breaks)));
                return;
            }

            var contextMenu = _trayIcon.ContextMenuStrip;
            contextMenu.Items.Clear();

            // 1. Add Status Item
            contextMenu.Items.Add(_statusMenuItem);
            contextMenu.Items.Add(new ToolStripSeparator());

            // 2. Add Open Dashboard Option (At the very top of actions)
            if (ApiSync.IsLoggedIn)
            {
                var openDashItem = new ToolStripMenuItem("🖥️ Open Dashboard", null, (s, e) => ShowDashboardForm())
                {
                    Font = new Font(contextMenu.Font ?? SystemFonts.DefaultFont, FontStyle.Bold)
                };
                contextMenu.Items.Add(openDashItem);
                contextMenu.Items.Add(new ToolStripSeparator());
            }

            // 3. Add Dynamic Actions based on current status
            if (ApiSync.IsLoggedIn)
            {
                bool hasCheckedIn = attendance?.CheckInTime != null;
                bool hasCheckedOut = attendance?.CheckOutTime != null;
                bool isOnBreak = breaks.Exists(b => b.EndTime == null);

                if (!hasCheckedIn)
                {
                    var checkInItem = new ToolStripMenuItem("🌅 Check In Now", null, async (s, e) => {
                        UpdateStatusText("Checking in...");
                        bool res = await ApiSync.CheckInAsync();
                        if (res)
                        {
                            _trayIcon.ShowBalloonTip(3000, "Morning Check-In", "You have successfully checked in for your shift.", ToolTipIcon.Info);
                        }
                        await RefreshStatusAndMenuAsync();
                    });
                    contextMenu.Items.Add(checkInItem);
                }
                else if (isOnBreak)
                {
                    var activeBreak = breaks.Find(b => b.EndTime == null);
                    string breakName = "Break";
                    if (activeBreak != null && DateTime.TryParse(activeBreak.StartTime, out var start))
                    {
                        var localStart = start.ToLocalTime();
                        if (localStart.Hour == 10 || (localStart.Hour == 11 && localStart.Minute <= 15))
                            breakName = "Morning Tea Break";
                        else if (localStart.Hour == 12 || localStart.Hour == 13)
                            breakName = "Lunch Break";
                        else
                            breakName = "Evening Tea Break";
                    }

                    var endBreakItem = new ToolStripMenuItem($"🛑 End {breakName}", null, async (s, e) => {
                        var confirmResult = MessageBox.Show(
                            $"Are you sure you want to end your {breakName} and return to work?",
                            "Confirm End Break",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question
                        );
                        if (confirmResult == DialogResult.Yes)
                        {
                            UpdateStatusText("Ending break...");
                            bool res = await ApiSync.EndBreakAsync();
                            if (res)
                            {
                                _trayIcon.ShowBalloonTip(3000, "Break Ended", $"Your {breakName} has ended. Welcome back.", ToolTipIcon.Info);
                            }
                            await RefreshStatusAndMenuAsync();
                        }
                    });
                    contextMenu.Items.Add(endBreakItem);
                }
                else if (!hasCheckedOut)
                {
                    // Check which breaks were already taken today
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
                            return localStart.Hour == 12 || localStart.Hour == 13;
                        }
                        return false;
                    });

                    bool tookEveningTea = breaks.Exists(b => {
                        if (DateTime.TryParse(b.StartTime, out var start))
                        {
                            var localStart = start.ToLocalTime();
                            return localStart.Hour == 14 || localStart.Hour == 15 || localStart.Hour == 16 || localStart.Hour == 17;
                        }
                        return false;
                    });

                    if (!tookMorningTea)
                    {
                        var startMorningTeaItem = new ToolStripMenuItem("☕ Start Morning Tea Break", null, async (s, e) => {
                            var confirmResult = MessageBox.Show(
                                "Are you sure you want to start your Morning Tea Break?",
                                "Confirm Start Break",
                                MessageBoxButtons.YesNo,
                                MessageBoxIcon.Question
                            );
                            if (confirmResult == DialogResult.Yes)
                            {
                                UpdateStatusText("Starting Morning Tea Break...");
                                bool res = await ApiSync.StartBreakAsync();
                                if (res)
                                {
                                    _trayIcon.ShowBalloonTip(3000, "Break Started", "Morning tea break logged successfully.", ToolTipIcon.Info);
                                }
                                await RefreshStatusAndMenuAsync();
                            }
                        });
                        contextMenu.Items.Add(startMorningTeaItem);
                    }

                    if (!tookLunch)
                    {
                        var startLunchItem = new ToolStripMenuItem("🍱 Start Lunch Break", null, async (s, e) => {
                            var confirmResult = MessageBox.Show(
                                "Are you sure you want to start your Lunch Break?",
                                "Confirm Start Break",
                                MessageBoxButtons.YesNo,
                                MessageBoxIcon.Question
                            );
                            if (confirmResult == DialogResult.Yes)
                            {
                                UpdateStatusText("Starting Lunch Break...");
                                bool res = await ApiSync.StartBreakAsync();
                                if (res)
                                {
                                    _trayIcon.ShowBalloonTip(3000, "Lunch Started", "Lunch break logged successfully.", ToolTipIcon.Info);
                                }
                                await RefreshStatusAndMenuAsync();
                            }
                        });
                        contextMenu.Items.Add(startLunchItem);
                    }

                    if (!tookEveningTea)
                    {
                        var startEveningTeaItem = new ToolStripMenuItem("☕ Start Evening Tea Break", null, async (s, e) => {
                            var confirmResult = MessageBox.Show(
                                "Are you sure you want to start your Evening Tea Break?",
                                "Confirm Start Break",
                                MessageBoxButtons.YesNo,
                                MessageBoxIcon.Question
                            );
                            if (confirmResult == DialogResult.Yes)
                            {
                                UpdateStatusText("Starting Evening Tea Break...");
                                bool res = await ApiSync.StartBreakAsync();
                                if (res)
                                {
                                    _trayIcon.ShowBalloonTip(3000, "Break Started", "Evening tea break logged successfully.", ToolTipIcon.Info);
                                }
                                await RefreshStatusAndMenuAsync();
                            }
                        });
                        contextMenu.Items.Add(startEveningTeaItem);
                    }

                    var checkOutItem = new ToolStripMenuItem("🚪 Check Out Now", null, async (s, e) => {
                        var confirmResult = MessageBox.Show(
                            "Are you sure you want to check out? This will end your workday.",
                            "Confirm Check Out",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question
                        );
                        if (confirmResult == DialogResult.Yes)
                        {
                            UpdateStatusText("Checking out...");
                            bool res = await ApiSync.CheckOutAsync();
                            if (res)
                            {
                                _trayIcon.ShowBalloonTip(3000, "Shift Completed", "You have successfully checked out. Have a great evening!", ToolTipIcon.Info);
                            }
                            await RefreshStatusAndMenuAsync();
                        }
                    });
                    contextMenu.Items.Add(checkOutItem);
                }
                else
                {
                    var completedItem = new ToolStripMenuItem("🎉 Shift Completed Today", null) { Enabled = false };
                    contextMenu.Items.Add(completedItem);
                }

                contextMenu.Items.Add(new ToolStripSeparator());
            }

            // 4. Add Static Items
            contextMenu.Items.Add(_connectMenuItem);
            
            var syncMenuItem = new ToolStripMenuItem("Sync Now", null, OnSyncClick);
            contextMenu.Items.Add(syncMenuItem);
            
            contextMenu.Items.Add(new ToolStripSeparator());
            
            var exitMenuItem = new ToolStripMenuItem("Exit", null, OnExitClick);
            contextMenu.Items.Add(exitMenuItem);
        }

        private async void OnReminderTimerTick(object? sender, EventArgs e)
        {
            if (!ApiSync.IsLoggedIn) return;

            // Handle active snooze timer
            if (_snoozeUntil.HasValue)
            {
                if (DateTime.Now >= _snoozeUntil.Value)
                {
                    var typeToTrigger = _snoozedReminderType;
                    _snoozeUntil = null;
                    _snoozedReminderType = null;

                    if (typeToTrigger.HasValue)
                    {
                        TriggerReminderPopup(typeToTrigger.Value);
                    }
                }
                return;
            }

            // Don't spawn a new popup if one is currently active on the screen
            if (_activeReminderForm != null && !_activeReminderForm.IsDisposed) return;

            var now = DateTime.Now;
            // weekday check
            if (now.DayOfWeek == DayOfWeek.Saturday || now.DayOfWeek == DayOfWeek.Sunday) return;

            var today = now.Date;

            // Fetch state to verify if reminder is actually necessary
            var attendance = await ApiSync.GetAttendanceTodayAsync();
            var breaks = await ApiSync.GetBreaksTodayAsync();

            bool hasCheckedIn = attendance?.CheckInTime != null;
            bool hasCheckedOut = attendance?.CheckOutTime != null;
            bool isOnBreak = breaks.Exists(b => b.EndTime == null);

            // 1. Check-In Reminder (Triggered between 9:05 AM and 9:30 AM)
            if (now.Hour == 9 && now.Minute >= 5 && now.Minute <= 30)
            {
                if (!hasCheckedIn && _lastCheckInReminderDate != today)
                {
                    _lastCheckInReminderDate = today;
                    TriggerReminderPopup(ReminderType.CheckIn);
                    return;
                }
            }

            // 2. Morning Tea Break Reminder (Triggered between 10:50 AM and 11:05 AM)
            if ((now.Hour == 10 && now.Minute >= 50) || (now.Hour == 11 && now.Minute <= 5))
            {
                if (hasCheckedIn && !hasCheckedOut && !isOnBreak && _lastMorningTeaReminderDate != today)
                {
                    bool tookMorningTea = breaks.Exists(b => {
                        if (DateTime.TryParse(b.StartTime, out var start))
                        {
                            var localStart = start.ToLocalTime();
                            return localStart.Hour == 10 || (localStart.Hour == 11 && localStart.Minute <= 15);
                        }
                        return false;
                    });

                    if (!tookMorningTea)
                    {
                        _lastMorningTeaReminderDate = today;
                        TriggerReminderPopup(ReminderType.MorningTea);
                        return;
                    }
                }
            }

            // 3. Lunch Break Reminder (Triggered between 1:00 PM and 1:40 PM)
            if (now.Hour == 13 && now.Minute >= 0 && now.Minute <= 40)
            {
                if (hasCheckedIn && !hasCheckedOut && !isOnBreak && _lastLunchReminderDate != today)
                {
                    bool tookLunch = breaks.Exists(b => {
                        if (DateTime.TryParse(b.StartTime, out var start))
                        {
                            var localStart = start.ToLocalTime();
                            return localStart.Hour == 12 || localStart.Hour == 13;
                        }
                        return false;
                    });

                    if (!tookLunch)
                    {
                        _lastLunchReminderDate = today;
                        TriggerReminderPopup(ReminderType.Lunch);
                        return;
                    }
                }
            }

            // 4. Evening Tea Break Reminder (Triggered between 4:15 PM and 4:40 PM)
            if (now.Hour == 16 && now.Minute >= 15 && now.Minute <= 40)
            {
                if (hasCheckedIn && !hasCheckedOut && !isOnBreak && _lastEveningTeaReminderDate != today)
                {
                    bool tookEveningTea = breaks.Exists(b => {
                        if (DateTime.TryParse(b.StartTime, out var start))
                        {
                            var localStart = start.ToLocalTime();
                            return localStart.Hour == 14 || localStart.Hour == 15 || localStart.Hour == 16 || localStart.Hour == 17;
                        }
                        return false;
                    });

                    if (!tookEveningTea)
                    {
                        _lastEveningTeaReminderDate = today;
                        TriggerReminderPopup(ReminderType.EveningTea);
                        return;
                    }
                }
            }

            // 5. Check-Out Reminder (Triggered between 6:00 PM and 6:30 PM)
            if (now.Hour == 18 && now.Minute >= 0 && now.Minute <= 30)
            {
                if (hasCheckedIn && !hasCheckedOut && _lastCheckOutReminderDate != today)
                {
                    _lastCheckOutReminderDate = today;
                    TriggerReminderPopup(ReminderType.CheckOut);
                    return;
                }
            }
        }

        private void TriggerReminderPopup(ReminderType type)
        {
            string emoji = "🔔";
            string title = "HRMS Reminder";
            string message = "Time for an update.";
            string actionText = "Proceed";
            Func<Task<bool>> onAction = async () => false;

            switch (type)
            {
                case ReminderType.CheckIn:
                    emoji = "🌅";
                    title = "Morning Check-In";
                    message = "Good morning! Time to start your workday shift. Click below to check in and avoid late penalties.";
                    actionText = "Check In Now";
                    onAction = async () => {
                        bool res = await ApiSync.CheckInAsync();
                        if (res)
                        {
                            _trayIcon.ShowBalloonTip(3000, "Checked In", "Successfully checked in from reminder.", ToolTipIcon.Info);
                            await RefreshStatusAndMenuAsync();
                        }
                        return res;
                    };
                    break;

                case ReminderType.MorningTea:
                    emoji = "☕";
                    title = "Morning Tea Break";
                    message = "It's 10:45 AM. Time for your morning tea break (15 minutes). Step away to rest and recharge.";
                    actionText = "Start Break";
                    onAction = async () => {
                        var confirmResult = MessageBox.Show(
                            "Are you sure you want to start your Morning Tea Break?",
                            "Confirm Start Break",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question
                        );
                        if (confirmResult == DialogResult.Yes)
                        {
                            bool res = await ApiSync.StartBreakAsync();
                            if (res)
                            {
                                _trayIcon.ShowBalloonTip(3000, "Break Started", "Morning tea break logged successfully.", ToolTipIcon.Info);
                                await RefreshStatusAndMenuAsync();
                            }
                            return res;
                        }
                        return false;
                    };
                    break;

                case ReminderType.Lunch:
                    emoji = "🍱";
                    title = "Lunch Break";
                    message = "It's 1:00 PM. Time to grab some lunch (40 minutes). Make sure to log your break session.";
                    actionText = "Start Break";
                    onAction = async () => {
                        var confirmResult = MessageBox.Show(
                            "Are you sure you want to start your Lunch Break?",
                            "Confirm Start Break",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question
                        );
                        if (confirmResult == DialogResult.Yes)
                        {
                            bool res = await ApiSync.StartBreakAsync();
                            if (res)
                            {
                                _trayIcon.ShowBalloonTip(3000, "Lunch Started", "Lunch break logged successfully.", ToolTipIcon.Info);
                                await RefreshStatusAndMenuAsync();
                            }
                            return res;
                        }
                        return false;
                    };
                    break;

                case ReminderType.EveningTea:
                    emoji = "☕";
                    title = "Evening Tea Break";
                    message = "It's 4:10 PM. Time for your evening tea break (20 minutes) to refresh your focus.";
                    actionText = "Start Break";
                    onAction = async () => {
                        var confirmResult = MessageBox.Show(
                            "Are you sure you want to start your Evening Tea Break?",
                            "Confirm Start Break",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question
                        );
                        if (confirmResult == DialogResult.Yes)
                        {
                            bool res = await ApiSync.StartBreakAsync();
                            if (res)
                            {
                                _trayIcon.ShowBalloonTip(3000, "Break Started", "Evening tea break logged successfully.", ToolTipIcon.Info);
                                await RefreshStatusAndMenuAsync();
                            }
                            return res;
                        }
                        return false;
                    };
                    break;

                case ReminderType.CheckOut:
                    emoji = "🚪";
                    title = "End of Shift Check-Out";
                    message = "Your standard shift is complete. Don't forget to check out and log your hours.";
                    actionText = "Check Out Now";
                    onAction = async () => {
                        var confirmResult = MessageBox.Show(
                            "Are you sure you want to check out? This will end your workday.",
                            "Confirm Check Out",
                            MessageBoxButtons.YesNo,
                            MessageBoxIcon.Question
                        );
                        if (confirmResult == DialogResult.Yes)
                        {
                            bool res = await ApiSync.CheckOutAsync();
                            if (res)
                            {
                                _trayIcon.ShowBalloonTip(3000, "Checked Out", "Successfully checked out from reminder.", ToolTipIcon.Info);
                                await RefreshStatusAndMenuAsync();
                            }
                            return res;
                        }
                        return false;
                    };
                    break;
            }

            _activeReminderForm = new ReminderForm(
                emoji,
                title,
                message,
                actionText,
                onAction,
                (snoozeMins) => {
                    _snoozeUntil = DateTime.Now.AddMinutes(snoozeMins);
                    _snoozedReminderType = type;
                    _activeReminderForm = null;
                },
                () => {
                    _snoozeUntil = null;
                    _snoozedReminderType = null;
                    _activeReminderForm = null;
                }
            );

            _activeReminderForm.Show();
        }

        private void ShowLoginForm()
        {
            if (ApiSync.IsLoggedIn)
            {
                var result = MessageBox.Show(
                    $"You are currently connected as {ApiSync.CurrentEmail}.\nDo you want to disconnect and switch accounts?",
                    "Change Account",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );

                if (result == DialogResult.Yes)
                {
                    ApiSync.Logout();
                    _dashboardForm?.Hide();
                    _ = RefreshStatusAndMenuAsync();
                }
                else
                {
                    return;
                }
            }

            using var loginForm = new LoginForm();
            if (loginForm.ShowDialog() == DialogResult.OK)
            {
                _trayIcon.ShowBalloonTip(3000, "Agent Connected", $"Successfully linked to {ApiSync.CurrentEmail}", ToolTipIcon.Info);
                _ = RefreshStatusAndMenuAsync();
                ShowDashboardForm(); // Automatically open dashboard upon login
            }
        }

        private void OnConnectClick(object? sender, EventArgs e)
        {
            ShowLoginForm();
        }

        private async void OnSyncClick(object? sender, EventArgs e)
        {
            if (!ApiSync.IsLoggedIn)
            {
                MessageBox.Show("Please connect an account first.", "Sync", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            UpdateStatusText("Syncing...");
            await ApiSync.ProcessOfflineQueueAsync();
            await RefreshStatusAndMenuAsync();
        }

        private void OnExitClick(object? sender, EventArgs e)
        {
            var result = MessageBox.Show(
                "Exiting the IntelliHrHub Agent will stop automated attendance tracking. Are you sure you want to exit?",
                "Exit IntelliHrHub Agent",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning
            );

            if (result == DialogResult.Yes)
            {
                ExitContext();
            }
        }

        private void ExitContext()
        {
            _sessionMonitor.Stop();
            _idleTracker.Stop();
            _dashboardForm?.Dispose(); // Disposes dashboard window on exit
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
            Application.Exit();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _pollTimer?.Dispose();
                _reminderTimer?.Dispose();
                _activeReminderForm?.Dispose();
                _dashboardForm?.Dispose();
                _trayIcon?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
