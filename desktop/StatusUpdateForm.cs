using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace HRMS_Agent
{
    public class StatusUpdateForm : Form
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

        private readonly Panel _pnlHeader;
        private readonly Label _lblHeaderTitle;
        private readonly Label _lblPrompt;
        private readonly TextBox _txtStatus;
        private readonly Button _btnSubmit;
        private readonly Button _btnSkip;
        private readonly Button _btnCancel;

        public string StatusUpdate { get; private set; } = string.Empty;

        public StatusUpdateForm()
        {
            // Form Configurations
            Size = new Size(420, 280);
            FormBorderStyle = FormBorderStyle.None;
            BackColor = Color.FromArgb(24, 24, 32); // Modern Dark Slate
            StartPosition = FormStartPosition.CenterParent;
            Text = "Daily Status Update";
            ShowInTaskbar = false;

            // Apply GDI Rounded Corners
            Region = Region.FromHrgn(CreateRoundRectRgn(0, 0, Width, Height, 12, 12));

            // 1. Header Panel (for dragging)
            _pnlHeader = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(Width, 40),
                BackColor = Color.FromArgb(33, 33, 44)
            };
            _pnlHeader.MouseDown += Header_MouseDown;

            _lblHeaderTitle = new Label
            {
                Text = "🚪 Check Out Status",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(15, 10),
                AutoSize = true
            };
            _lblHeaderTitle.MouseDown += Header_MouseDown;
            _pnlHeader.Controls.Add(_lblHeaderTitle);

            // 2. Prompt Label
            _lblPrompt = new Label
            {
                Text = "What did you work on today? (Optional)",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(170, 170, 185),
                Location = new Point(20, 55),
                Size = new Size(380, 20)
            };

            // 3. Status Text Box
            _txtStatus = new TextBox
            {
                Multiline = true,
                Location = new Point(20, 80),
                Size = new Size(380, 120),
                BackColor = Color.FromArgb(33, 33, 44),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 10),
                BorderStyle = BorderStyle.FixedSingle,
                ScrollBars = ScrollBars.Vertical
            };
            _txtStatus.KeyDown += TxtStatus_KeyDown;

            // 4. Submit Button
            _btnSubmit = new Button
            {
                Text = "Submit & Check Out",
                Location = new Point(20, 220),
                Size = new Size(160, 38),
                BackColor = Color.FromArgb(9, 132, 227), // Accent blue
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnSubmit.FlatAppearance.BorderSize = 0;
            _btnSubmit.Click += BtnSubmit_Click;

            // 5. Skip Button
            _btnSkip = new Button
            {
                Text = "Skip",
                Location = new Point(190, 220),
                Size = new Size(100, 38),
                BackColor = Color.FromArgb(47, 54, 64), // Muted gray
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnSkip.FlatAppearance.BorderSize = 0;
            _btnSkip.Click += BtnSkip_Click;

            // 6. Cancel Button
            _btnCancel = new Button
            {
                Text = "Cancel",
                Location = new Point(300, 220),
                Size = new Size(100, 38),
                BackColor = Color.FromArgb(33, 33, 44),
                ForeColor = Color.FromArgb(170, 170, 185),
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            _btnCancel.FlatAppearance.BorderSize = 1;
            _btnCancel.FlatAppearance.BorderColor = Color.FromArgb(60, 60, 80);
            _btnCancel.Click += (s, e) => {
                DialogResult = DialogResult.Cancel;
                Close();
            };

            Controls.AddRange(new Control[] {
                _pnlHeader, _lblPrompt, _txtStatus, _btnSubmit, _btnSkip, _btnCancel
            });
        }

        private void Header_MouseDown(object? sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                ReleaseCapture();
                SendMessage(Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
            }
        }

        private void TxtStatus_KeyDown(object? sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter && e.Control)
            {
                e.SuppressKeyPress = true;
                BtnSubmit_Click(sender, EventArgs.Empty);
            }
        }

        private void BtnSubmit_Click(object? sender, EventArgs e)
        {
            StatusUpdate = _txtStatus.Text.Trim();
            DialogResult = DialogResult.OK;
            Close();
        }

        private void BtnSkip_Click(object? sender, EventArgs e)
        {
            StatusUpdate = string.Empty;
            DialogResult = DialogResult.OK;
            Close();
        }
    }
}
