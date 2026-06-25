using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace HRMS_Agent
{
    public class ReminderForm : Form
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

        private readonly Func<Task<bool>> _onAction;
        private readonly Action<int> _onSnooze;
        private readonly Action _onDismiss;

        private System.Windows.Forms.Timer? _animTimer;
        private int _targetTop;
        private bool _isSlidingDown = false;
        private bool _actionInProgress = false;

        private readonly Label _lblEmoji;
        private readonly Label _lblTitle;
        private readonly Label _lblMessage;
        private readonly Button _btnAction;
        private readonly Button _btnSnooze;
        private readonly Button _btnDismiss;
        private readonly ComboBox _cmbSnoozeMins;

        public ReminderForm(
            string emoji,
            string title,
            string message,
            string actionText,
            Func<Task<bool>> onAction,
            Action<int> onSnooze,
            Action onDismiss)
        {
            _onAction = onAction;
            _onSnooze = onSnooze;
            _onDismiss = onDismiss;

            // Configure Form Settings
            Text = title;
            Size = new Size(330, 190);
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            BackColor = Color.FromArgb(33, 33, 44); // Sleek Dark Background
            StartPosition = FormStartPosition.Manual;

            // Apply GDI Rounded Corners
            Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 16, 16));

            // Emoji icon label
            _lblEmoji = new Label
            {
                Text = emoji,
                Font = new Font("Segoe UI Emoji", 26),
                Location = new Point(15, 15),
                Size = new Size(50, 50),
                TextAlign = ContentAlignment.MiddleCenter
            };

            // Title label
            _lblTitle = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                Location = new Point(75, 15),
                Size = new Size(240, 25),
                ForeColor = Color.FromArgb(245, 246, 250),
                TextAlign = ContentAlignment.MiddleLeft
            };

            // Message label
            _lblMessage = new Label
            {
                Text = message,
                Font = new Font("Segoe UI", 9, FontStyle.Regular),
                Location = new Point(75, 42),
                Size = new Size(240, 50),
                ForeColor = Color.FromArgb(200, 200, 210),
                TextAlign = ContentAlignment.TopLeft
            };

            // Action Button
            _btnAction = new Button
            {
                Text = actionText,
                Location = new Point(15, 105),
                Size = new Size(130, 32),
                BackColor = Color.FromArgb(9, 132, 227), // Primary Blue
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnAction.FlatAppearance.BorderSize = 0;
            _btnAction.Click += OnActionClick;

            // Snooze Button
            _btnSnooze = new Button
            {
                Text = "Snooze",
                Location = new Point(155, 105),
                Size = new Size(80, 32),
                BackColor = Color.FromArgb(47, 54, 64),
                ForeColor = Color.FromArgb(220, 221, 230),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9),
                Cursor = Cursors.Hand
            };
            _btnSnooze.FlatAppearance.BorderSize = 0;
            _btnSnooze.Click += OnSnoozeClick;

            // Snooze minutes dropdown
            _cmbSnoozeMins = new ComboBox
            {
                Location = new Point(240, 110),
                Size = new Size(55, 23),
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9),
                BackColor = Color.FromArgb(47, 54, 64),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            _cmbSnoozeMins.Items.AddRange(new object[] { "5m", "10m", "15m" });
            _cmbSnoozeMins.SelectedIndex = 0;

            // Dismiss Button
            _btnDismiss = new Button
            {
                Text = "Dismiss",
                Location = new Point(15, 145),
                Size = new Size(280, 30),
                BackColor = Color.Transparent,
                ForeColor = Color.FromArgb(127, 140, 141),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 8.5f),
                Cursor = Cursors.Hand
            };
            _btnDismiss.FlatAppearance.BorderSize = 1;
            _btnDismiss.FlatAppearance.BorderColor = Color.FromArgb(47, 54, 64);
            _btnDismiss.Click += OnDismissClick;

            // Add Controls
            Controls.AddRange(new Control[] {
                _lblEmoji, _lblTitle, _lblMessage, _btnAction, _btnSnooze, _cmbSnoozeMins, _btnDismiss
            });

            // Set up animation
            Load += (s, e) => StartSlideUp();
        }

        private void StartSlideUp()
        {
            var workingArea = Screen.PrimaryScreen.WorkingArea;
            Left = workingArea.Right - Width - 15;
            Top = workingArea.Bottom;
            _targetTop = workingArea.Bottom - Height - 15;

            _animTimer = new System.Windows.Forms.Timer { Interval = 10 };
            _animTimer.Tick += (s, e) =>
            {
                if (!_isSlidingDown)
                {
                    if (Top > _targetTop)
                    {
                        Top -= Math.Max(1, (Top - _targetTop) / 4); // Smooth ease-out slide
                    }
                    else
                    {
                        Top = _targetTop;
                        _animTimer.Stop();
                    }
                }
                else
                {
                    if (Top < workingArea.Bottom)
                    {
                        Top += Math.Max(1, (workingArea.Bottom - Top) / 4);
                    }
                    else
                    {
                        _animTimer.Stop();
                        _animTimer.Dispose();
                        base.Close();
                    }
                }
            };
            _animTimer.Start();
        }

        private void SlideDownAndClose()
        {
            if (_animTimer == null)
            {
                base.Close();
                return;
            }
            _isSlidingDown = true;
            _animTimer.Start();
        }

        private async void OnActionClick(object? sender, EventArgs e)
        {
            if (_actionInProgress) return;
            _actionInProgress = true;
            _btnAction.Enabled = false;
            _btnAction.Text = "Syncing...";

            try
            {
                bool success = await _onAction();
                if (success)
                {
                    SlideDownAndClose();
                }
                else
                {
                    _btnAction.Enabled = true;
                    _btnAction.Text = "Retry";
                    _actionInProgress = false;
                    MessageBox.Show("Failed to sync status. Please check your internet connection.", "Sync Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                _btnAction.Enabled = true;
                _btnAction.Text = "Retry";
                _actionInProgress = false;
                MessageBox.Show($"Error: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void OnSnoozeClick(object? sender, EventArgs e)
        {
            string selected = _cmbSnoozeMins.SelectedItem?.ToString() ?? "5m";
            int minutes = int.Parse(selected.Replace("m", ""));
            _onSnooze(minutes);
            SlideDownAndClose();
        }

        private void OnDismissClick(object? sender, EventArgs e)
        {
            _onDismiss();
            SlideDownAndClose();
        }

        public new void Close()
        {
            SlideDownAndClose();
        }
    }
}
