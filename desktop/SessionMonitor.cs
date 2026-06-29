using System;
using System.Windows.Forms;
using Microsoft.Win32;

namespace HRMS_Agent
{
    public class SessionMonitor
    {
        private bool _isStarted = false;
        private PowerEventWindow? _powerWindow;

        public void Start()
        {
            if (_isStarted) return;
            _isStarted = true;

            // Session switch events (Lock/Unlock/Logon/Logoff)
            SystemEvents.SessionSwitch += OnSessionSwitch;

            // Session ending events (Shutdown/Logoff)
            SystemEvents.SessionEnding += OnSessionEnding;

            // Create a hidden form to intercept WM_POWERBROADCAST sleep/wake events
            _powerWindow = new PowerEventWindow();
            _ = _powerWindow.Handle; // Accessing the handle property forces native handle creation
        }

        public void Stop()
        {
            if (!_isStarted) return;
            _isStarted = false;

            SystemEvents.SessionSwitch -= OnSessionSwitch;
            SystemEvents.SessionEnding -= OnSessionEnding;

            if (_powerWindow != null)
            {
                _powerWindow.Dispose();
                _powerWindow = null;
            }
        }

        private async void OnSessionSwitch(object sender, SessionSwitchEventArgs e)
        {
            string? eventType = null;

            switch (e.Reason)
            {
                case SessionSwitchReason.SessionLock:
                    eventType = "LOCK";
                    break;
                case SessionSwitchReason.SessionUnlock:
                    eventType = "UNLOCK";
                    break;
            }

            if (eventType != null)
            {
                await ApiSync.LogEventAsync(eventType);
            }
        }

        private async void OnSessionEnding(object sender, SessionEndingEventArgs e)
        {
            // Trigger SHUTDOWN log
            await ApiSync.LogEventAsync("SHUTDOWN");
        }
    }

    // Hidden Form to capture OS-level broadcast messages (which message-only windows don't receive)
    internal class PowerEventWindow : Form
    {
        private const int WM_POWERBROADCAST = 0x0218;
        private const int PBT_APMSUSPEND = 0x0004;
        private const int PBT_APMRESUMEAUTOMATIC = 0x0012;
        private const int PBT_APMRESUMESUSPEND = 0x0007;

        public PowerEventWindow()
        {
            this.FormBorderStyle = FormBorderStyle.None;
            this.ShowInTaskbar = false;
            this.WindowState = FormWindowState.Minimized;
            this.Size = new System.Drawing.Size(0, 0);
            this.Visible = false;
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_POWERBROADCAST)
            {
                int wParam = m.WParam.ToInt32();
                if (wParam == PBT_APMSUSPEND)
                {
                    _ = ApiSync.LogEventAsync("SLEEP");
                }
                else if (wParam == PBT_APMRESUMEAUTOMATIC || wParam == PBT_APMRESUMESUSPEND)
                {
                    _ = ApiSync.LogEventAsync("WAKE");
                }
            }
            base.WndProc(ref m);
        }
    }
}
