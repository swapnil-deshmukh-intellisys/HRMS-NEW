import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
const smtpUser = process.env.SMTP_USER || "swapnil.deshmukh.intellisys@gmail.com";
const smtpPass = process.env.SMTP_PASS || "";

export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for other ports
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (!smtpPass) {
    console.warn("Mail not sent. SMTP_PASS is missing in environment variables. Would have sent to:", to);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"HRMS Notifications" <${smtpUser}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
