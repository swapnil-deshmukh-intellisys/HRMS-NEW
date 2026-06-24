using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace HRMS_Agent
{
    public class DesktopEvent
    {
        public string EventType { get; set; } = string.Empty;
        public string Timestamp { get; set; } = string.Empty;
    }

    public class ApiConfig
    {
        public string ApiUrl { get; set; } = "http://localhost:4000";
        public string Token { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
    }

    public static class ApiSync
    {
        private static readonly HttpClient _httpClient = new HttpClient();
        private static readonly string AppDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "IntelliHrHub_Agent"
        );
        private static readonly string ConfigPath = Path.Combine(AppDataFolder, "config.json");
        private static readonly string QueuePath = Path.Combine(AppDataFolder, "offline_queue.json");

        private static ApiConfig _config = new ApiConfig();
        private static readonly List<DesktopEvent> _offlineQueue = new List<DesktopEvent>();
        private static bool _isProcessingQueue = false;

        public static event Action<string>? OnStatusChanged;

        static ApiSync()
        {
            try
            {
                if (!Directory.Exists(AppDataFolder))
                {
                    Directory.CreateDirectory(AppDataFolder);
                }

                LoadConfig();
                LoadOfflineQueue();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Initialization error: {ex.Message}");
            }
        }

        public static bool IsLoggedIn => !string.IsNullOrEmpty(_config.Token);
        public static string CurrentEmail => _config.UserEmail;
        public static string ApiUrl => _config.ApiUrl;

        public static void SetApiUrl(string url)
        {
            _config.ApiUrl = url.TrimEnd('/');
            SaveConfig();
        }

        private static void LoadConfig()
        {
            if (File.Exists(ConfigPath))
            {
                try
                {
                    var json = File.ReadAllText(ConfigPath);
                    var loaded = JsonSerializer.Deserialize<ApiConfig>(json);
                    if (loaded != null)
                    {
                        _config = loaded;
                    }
                }
                catch
                {
                    // Fallback to default config
                }
            }
        }

        private static void SaveConfig()
        {
            try
            {
                var json = JsonSerializer.Serialize(_config, new JsonSerializerOptions { WriteIndented = true });
                File.ReadAllText(ConfigPath); // Check access
                File.WriteAllText(ConfigPath, json);
            }
            catch (Exception)
            {
                File.WriteAllText(ConfigPath, JsonSerializer.Serialize(_config));
            }
        }

        private static void LoadOfflineQueue()
        {
            if (File.Exists(QueuePath))
            {
                try
                {
                    var json = File.ReadAllText(QueuePath);
                    var loaded = JsonSerializer.Deserialize<List<DesktopEvent>>(json);
                    if (loaded != null)
                    {
                        _offlineQueue.AddRange(loaded);
                    }
                }
                catch
                {
                    // Corrupted queue file
                }
            }
        }

        private static void SaveOfflineQueue()
        {
            try
            {
                lock (_offlineQueue)
                {
                    var json = JsonSerializer.Serialize(_offlineQueue, new JsonSerializerOptions { WriteIndented = true });
                    File.WriteAllText(QueuePath, json);
                }
            }
            catch
            {
                // Ignore queue save errors
            }
        }

        public static async Task<bool> LoginAsync(string email, string password)
        {
            try
            {
                var payload = new { email, password };
                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                
                var response = await _httpClient.PostAsync($"{_config.ApiUrl}/api/auth/login", content);
                if (!response.IsSuccessStatusCode)
                {
                    return false;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseJson);
                var root = doc.RootElement;

                if (root.TryGetProperty("success", out var successProp) && successProp.GetBoolean() &&
                    root.TryGetProperty("data", out var dataProp))
                {
                    if (dataProp.TryGetProperty("token", out var tokenProp))
                    {
                        _config.Token = tokenProp.GetString() ?? string.Empty;
                        _config.UserEmail = email;
                        SaveConfig();
                        OnStatusChanged?.Invoke("Logged in successfully");
                        
                        // Try syncing offline items
                        _ = ProcessOfflineQueueAsync();
                        return true;
                    }
                }
                return false;
            }
            catch (Exception ex)
            {
                OnStatusChanged?.Invoke($"Login failed: {ex.Message}");
                return false;
            }
        }

        public static void Logout()
        {
            _config.Token = string.Empty;
            _config.UserEmail = string.Empty;
            SaveConfig();
            OnStatusChanged?.Invoke("Logged out");
        }

        public static async Task LogEventAsync(string eventType)
        {
            var newEvent = new DesktopEvent
            {
                EventType = eventType,
                Timestamp = DateTime.UtcNow.ToString("o") // ISO 8601 UTC
            };

            if (!IsLoggedIn)
            {
                lock (_offlineQueue)
                {
                    _offlineQueue.Add(newEvent);
                    SaveOfflineQueue();
                }
                OnStatusChanged?.Invoke($"Offline: Queued {eventType}");
                return;
            }

            bool sent = await SendEventPayloadAsync(newEvent);
            if (!sent)
            {
                lock (_offlineQueue)
                {
                    _offlineQueue.Add(newEvent);
                    SaveOfflineQueue();
                }
                OnStatusChanged?.Invoke($"Failed to send {eventType}. Queued offline.");
            }
            else
            {
                OnStatusChanged?.Invoke($"Sent: {eventType}");
                // Trigger queue processing in case previous events are pending
                _ = ProcessOfflineQueueAsync();
            }
        }

        private static async Task<bool> SendEventPayloadAsync(DesktopEvent ev)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.ApiUrl}/api/attendance/desktop-event");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _config.Token);
                
                var json = JsonSerializer.Serialize(ev);
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.SendAsync(request);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public static async Task ProcessOfflineQueueAsync()
        {
            if (_isProcessingQueue || !IsLoggedIn) return;
            _isProcessingQueue = true;

            try
            {
                while (true)
                {
                    DesktopEvent? nextEvent = null;
                    lock (_offlineQueue)
                    {
                        if (_offlineQueue.Count > 0)
                        {
                            nextEvent = _offlineQueue[0];
                        }
                    }

                    if (nextEvent == null) break;

                    bool sent = await SendEventPayloadAsync(nextEvent);
                    if (sent)
                    {
                        lock (_offlineQueue)
                        {
                            _offlineQueue.RemoveAt(0);
                            SaveOfflineQueue();
                        }
                        OnStatusChanged?.Invoke($"Synced offline event: {nextEvent.EventType}");
                    }
                    else
                    {
                        // Server still unreachable, stop processing for now
                        break;
                    }
                }
            }
            finally
            {
                _isProcessingQueue = false;
            }
        }
    }
}
