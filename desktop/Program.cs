using System;
using System.Drawing;
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
        private readonly NotifyIcon _trayIcon;
        private readonly SessionMonitor _sessionMonitor;
        private readonly IdleTracker _idleTracker;
        private readonly ToolStripMenuItem _statusMenuItem;
        private readonly ToolStripMenuItem _connectMenuItem;

        public HRMSApplicationContext()
        {
            // Initialize event monitors
            _sessionMonitor = new SessionMonitor();
            _idleTracker = new IdleTracker();

            // Set up context menu
            var contextMenu = new ContextMenuStrip();

            _statusMenuItem = new ToolStripMenuItem("Status: Initializing...") { Enabled = false };
            _connectMenuItem = new ToolStripMenuItem("Connect Account...", null, OnConnectClick);
            var syncMenuItem = new ToolStripMenuItem("Sync Now", null, OnSyncClick);
            var exitMenuItem = new ToolStripMenuItem("Exit", null, OnExitClick);

            contextMenu.Items.AddRange(new ToolStripItem[]
            {
                _statusMenuItem,
                new ToolStripSeparator(),
                _connectMenuItem,
                syncMenuItem,
                new ToolStripSeparator(),
                exitMenuItem
            });

            // Set up System Tray Icon
            _trayIcon = new NotifyIcon
            {
                Icon = SystemIcons.Shield,
                ContextMenuStrip = contextMenu,
                Visible = true,
                Text = "IntelliHrHub Desktop Agent"
            };

            _trayIcon.DoubleClick += (s, e) => ShowLoginForm();

            // Register event handler for API status updates
            ApiSync.OnStatusChanged += UpdateStatusText;

            // Update status text initially
            UpdateStatusText(ApiSync.IsLoggedIn ? $"Connected as {ApiSync.CurrentEmail}" : "Not connected");

            // Start monitors
            _sessionMonitor.Start();
            _idleTracker.Start();

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
                _trayIcon.BalloonTipTitle = "IntelliHrHub Desktop Agent";
                _trayIcon.BalloonTipText = $"Successfully linked to {ApiSync.CurrentEmail}";
                _trayIcon.ShowBalloonTip(3000);
            }
            else
            {
                _connectMenuItem.Text = "Connect Account...";
                _trayIcon.Text = "IntelliHrHub Desktop Agent (Disconnected)";
            }
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
                }
                else
                {
                    return;
                }
            }

            using var loginForm = new LoginForm();
            if (loginForm.ShowDialog() == DialogResult.OK)
            {
                UpdateStatusText($"Connected as {ApiSync.CurrentEmail}");
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
            UpdateStatusText($"Connected as {ApiSync.CurrentEmail}");
        }

        private void OnExitClick(object? sender, EventArgs e)
        {
            var result = MessageBox.Show(
                "Exiting the IntelliHrHub Agent will stop automated attendance break logging. Are you sure you want to exit?",
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
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
            Application.Exit();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _trayIcon?.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
