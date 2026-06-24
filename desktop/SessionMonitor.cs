using System;
using Microsoft.Win32;

namespace HRMS_Agent
{
    public class SessionMonitor
    {
        private bool _isStarted = false;

        public void Start()
        {
            if (_isStarted) return;
            _isStarted = true;

            // Session switch events (Lock/Unlock/Logon/Logoff)
            SystemEvents.SessionSwitch += OnSessionSwitch;

            // Power mode events (Sleep/Wake)
            SystemEvents.PowerModeChanged += OnPowerModeChanged;

            // Session ending events (Shutdown/Logoff)
            SystemEvents.SessionEnding += OnSessionEnding;
        }

        public void Stop()
        {
            if (!_isStarted) return;
            _isStarted = false;

            SystemEvents.SessionSwitch -= OnSessionSwitch;
            SystemEvents.PowerModeChanged -= OnPowerModeChanged;
            SystemEvents.SessionEnding -= OnSessionEnding;
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

        private async void OnPowerModeChanged(object sender, PowerModeChangedEventArgs e)
        {
            string? eventType = null;

            switch (e.Mode)
            {
                case PowerModes.Suspend:
                    eventType = "SLEEP";
                    break;
                case PowerModes.Resume:
                    eventType = "WAKE";
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
}
