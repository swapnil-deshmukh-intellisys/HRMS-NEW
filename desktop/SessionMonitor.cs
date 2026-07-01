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

            // Session ending events (Shutdown/Logoff)
            SystemEvents.SessionEnding += OnSessionEnding;

            // Power mode changed events (Sleep/Wake)
            SystemEvents.PowerModeChanged += OnPowerModeChanged;
        }

        public void Stop()
        {
            if (!_isStarted) return;
            _isStarted = false;

            SystemEvents.SessionSwitch -= OnSessionSwitch;
            SystemEvents.SessionEnding -= OnSessionEnding;
            SystemEvents.PowerModeChanged -= OnPowerModeChanged;
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

        private void OnSessionEnding(object sender, SessionEndingEventArgs e)
        {
            // Trigger SHUTDOWN log synchronously to ensure it completes before OS terminates the process
            try
            {
                ApiSync.LogEventAsync("SHUTDOWN").GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Shutdown log error: {ex.Message}");
            }
        }

        private void OnPowerModeChanged(object sender, PowerModeChangedEventArgs e)
        {
            try
            {
                if (e.Mode == PowerModes.Suspend)
                {
                    // Trigger SLEEP log synchronously to ensure it completes before OS network adapter power down
                    ApiSync.LogEventAsync("SLEEP").GetAwaiter().GetResult();
                }
                else if (e.Mode == PowerModes.Resume)
                {
                    // Wake up can be run asynchronously
                    _ = ApiSync.LogEventAsync("WAKE");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Power event log error: {ex.Message}");
            }
        }
    }
}
