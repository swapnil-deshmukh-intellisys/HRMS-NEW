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
        private bool _isSlidingDown = false;
        private bool _actionInProgress = false;

        private readonly Label _lblEmoji;
        private readonly Label _lblTitle;
        private readonly Label _lblMessage;
        private readonly Button _btnAction;
        private readonly Button _btnSnooze;
        private readonly Button _btnDismiss;

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
            Size = new Size(880, 480); // Doubled size
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            BackColor = Color.FromArgb(33, 33, 44); // Sleek Dark Background
            StartPosition = FormStartPosition.CenterScreen;
            Opacity = 0; // Start fully transparent for fade-in

            // Apply GDI Rounded Corners
            Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 24, 24));

            // Emoji icon label
            _lblEmoji = new Label
            {
                Text = emoji,
                Font = new Font("Segoe UI Emoji", 72), // Doubled font size
                Location = new Point(50, 50), // Spaced layout
                Size = new Size(128, 128),
                TextAlign = ContentAlignment.MiddleCenter
            };

            // Title label
            _lblTitle = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 22, FontStyle.Bold), // Large bold title
                Location = new Point(200, 50),
                Size = new Size(630, 50),
                ForeColor = Color.FromArgb(245, 246, 250),
                TextAlign = ContentAlignment.MiddleLeft
            };

            // Message label
            _lblMessage = new Label
            {
                Text = message,
                Font = new Font("Segoe UI", 14f, FontStyle.Regular), // Highly readable large message
                Location = new Point(200, 110),
                Size = new Size(630, 160),
                ForeColor = Color.FromArgb(200, 200, 210),
                TextAlign = ContentAlignment.TopLeft
            };

            // Action Button
            _btnAction = new Button
            {
                Text = actionText,
                Location = new Point(50, 290),
                Size = new Size(370, 60), // Larger button
                BackColor = Color.FromArgb(9, 132, 227), // Primary Blue
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 14f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnAction.FlatAppearance.BorderSize = 0;
            _btnAction.Click += OnActionClick;

            // Snooze Button
            _btnSnooze = new Button
            {
                Text = "Snooze",
                Location = new Point(460, 290),
                Size = new Size(370, 60),
                BackColor = Color.FromArgb(47, 54, 64),
                ForeColor = Color.FromArgb(220, 221, 230),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 14f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnSnooze.FlatAppearance.BorderSize = 0;
            _btnSnooze.Click += OnSnoozeClick;

            // Dismiss Button
            _btnDismiss = new Button
            {
                Text = "Dismiss",
                Location = new Point(50, 375),
                Size = new Size(780, 50), // Wide footer button
                BackColor = Color.Transparent,
                ForeColor = Color.FromArgb(127, 140, 141),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 12f),
                Cursor = Cursors.Hand
            };
            _btnDismiss.FlatAppearance.BorderSize = 1;
            _btnDismiss.FlatAppearance.BorderColor = Color.FromArgb(47, 54, 64);
            _btnDismiss.Click += OnDismissClick;

            // Add Controls
            Controls.AddRange(new Control[] {
                _lblEmoji, _lblTitle, _lblMessage, _btnAction, _btnSnooze, _btnDismiss
            });

            // Set up animation
            Load += (s, e) => {
                StartSlideUp();
                BringToFront();
                Activate();
            };
        }

        private void StartSlideUp()
        {
            try
            {
                System.Media.SystemSounds.Asterisk.Play();
            }
            catch
            {
                // Fallback in case of sound device issues
            }

            // Smooth fade-in in the center of the screen
            _animTimer = new System.Windows.Forms.Timer { Interval = 15 };
            _animTimer.Tick += (s, e) =>
            {
                if (!_isSlidingDown)
                {
                    if (Opacity < 1.0)
                    {
                        Opacity += 0.08;
                    }
                    else
                    {
                        Opacity = 1.0;
                        _animTimer.Stop();
                    }
                }
                else
                {
                    if (Opacity > 0.0)
                    {
                        Opacity -= 0.08;
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
            using var customForm = new CustomSnoozeForm(this);
            if (customForm.ShowDialog(this) == DialogResult.OK)
            {
                _onSnooze(customForm.SelectedMinutes);
                SlideDownAndClose();
            }
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

    public class CustomSnoozeForm : Form
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

        private readonly TextBox _txtMinutes;
        private readonly Button _btnSnooze;
        private readonly Button _btnCancel;
        public int SelectedMinutes { get; private set; } = 5;

        public CustomSnoozeForm(Form owner)
        {
            Owner = owner;
            Text = "Snooze Options";
            Size = new Size(400, 240); // Large, spacious layout
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.CenterParent;
            BackColor = Color.FromArgb(33, 33, 44);
            ForeColor = Color.White;

            // Apply GDI Rounded Corners
            Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 16, 16));

            // Custom border paint
            Paint += (s, e) =>
            {
                using var pen = new Pen(Color.FromArgb(47, 54, 64), 2);
                e.Graphics.DrawRectangle(pen, 1, 1, Width - 2, Height - 2);
            };

            var lblTitle = new Label
            {
                Text = "Snooze Duration",
                Location = new Point(25, 25),
                Size = new Size(350, 25),
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                ForeColor = Color.FromArgb(245, 246, 250)
            };

            var lblPrompt = new Label
            {
                Text = "Enter custom minutes:",
                Location = new Point(25, 65),
                Size = new Size(170, 25),
                AutoSize = false, // Fixed size to guarantee NO overlap
                Font = new Font("Segoe UI", 10.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(200, 200, 210),
                TextAlign = ContentAlignment.MiddleLeft
            };

            _txtMinutes = new TextBox
            {
                Text = "5",
                Location = new Point(215, 65),
                Size = new Size(160, 26),
                BackColor = Color.FromArgb(47, 54, 64),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 11, FontStyle.Bold),
                TextAlign = HorizontalAlignment.Center
            };

            // Predefined Shortcuts Row
            var lblShortcuts = new Label
            {
                Text = "Shortcuts:",
                Location = new Point(25, 115),
                Size = new Size(80, 30),
                AutoSize = false, // Fixed size to guarantee NO overlap
                Font = new Font("Segoe UI", 10, FontStyle.Regular),
                ForeColor = Color.FromArgb(150, 150, 160),
                TextAlign = ContentAlignment.MiddleLeft
            };

            var btn5 = CreateShortcutButton("5 Min", 5, 115, 115);
            var btn10 = CreateShortcutButton("10 Min", 10, 205, 115);
            var btn15 = CreateShortcutButton("15 Min", 15, 295, 115);

            // Action Buttons at the bottom
            _btnSnooze = new Button
            {
                Text = "Snooze",
                Location = new Point(25, 175),
                Size = new Size(165, 40),
                BackColor = Color.FromArgb(9, 132, 227), // Primary blue
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnSnooze.FlatAppearance.BorderSize = 0;
            _btnSnooze.Click += (s, e) => SubmitCustomValue();

            _btnCancel = new Button
            {
                Text = "Cancel",
                Location = new Point(210, 175),
                Size = new Size(165, 40),
                BackColor = Color.FromArgb(47, 54, 64),
                ForeColor = Color.FromArgb(220, 221, 230),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10.5f),
                Cursor = Cursors.Hand
            };
            _btnCancel.FlatAppearance.BorderSize = 0;
            _btnCancel.Click += (s, e) =>
            {
                DialogResult = DialogResult.Cancel;
                Close();
            };

            Controls.AddRange(new Control[] { 
                lblTitle, lblPrompt, _txtMinutes, lblShortcuts, btn5, btn10, btn15, _btnSnooze, _btnCancel 
            });

            AcceptButton = _btnSnooze;
            CancelButton = _btnCancel;

            // Autofocus text box and select all text on load
            Load += (s, e) =>
            {
                _txtMinutes.Focus();
                _txtMinutes.SelectAll();
            };
        }

        private Button CreateShortcutButton(string text, int minutes, int x, int y)
        {
            var btn = new Button
            {
                Text = text,
                Location = new Point(x, y),
                Size = new Size(80, 30), // Very large and spacious shortcut buttons
                BackColor = Color.FromArgb(47, 54, 64),
                ForeColor = Color.FromArgb(220, 221, 230),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f),
                Cursor = Cursors.Hand
            };
            btn.FlatAppearance.BorderSize = 0;
            btn.Click += (s, e) =>
            {
                SelectedMinutes = minutes;
                DialogResult = DialogResult.OK;
                Close();
            };
            return btn;
        }

        private void SubmitCustomValue()
        {
            if (int.TryParse(_txtMinutes.Text, out int mins) && mins > 0)
            {
                SelectedMinutes = mins;
                DialogResult = DialogResult.OK;
                Close();
            }
            else
            {
                MessageBox.Show("Please enter a valid positive number of minutes.", "Invalid Duration", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }
    }
}
