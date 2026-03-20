import nodemailer from "nodemailer";

// lazily created transporter - only created once env vars are verified
let _transporter: nodemailer.Transporter | null = null;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // silently no-op if SMTP not configured
  }
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transporter;
}

/** Exposed only for tests — resets the singleton so env-var changes take effect. */
export function _resetTransporterForTests(): void {
  _transporter = null;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return; // SMTP not configured, silently skip

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (error) {
    // Log error but never throw - email failure should not break main flow
    console.error("[Email] Failed to send email:", error);
  }
}

export async function sendLeaveApprovedEmail(employeeName: string, employeeEmail: string, leaveTypeName: string, startDate: string, endDate: string): Promise<void> {
  await sendEmail(
    employeeEmail,
    "Your Leave Request Has Been Approved",
    `<p>Hi ${escapeHtml(employeeName)},</p>
    <p>Your <strong>${escapeHtml(leaveTypeName)}</strong> leave request from <strong>${escapeHtml(startDate)}</strong> to <strong>${escapeHtml(endDate)}</strong> has been <strong style="color:green">approved</strong>.</p>
    <p>Thank you.</p>`
  );
}

export async function sendLeaveRejectedEmail(employeeName: string, employeeEmail: string, leaveTypeName: string, startDate: string, endDate: string, comment?: string): Promise<void> {
  await sendEmail(
    employeeEmail,
    "Your Leave Request Has Been Rejected",
    `<p>Hi ${escapeHtml(employeeName)},</p>
    <p>Your <strong>${escapeHtml(leaveTypeName)}</strong> leave request from <strong>${escapeHtml(startDate)}</strong> to <strong>${escapeHtml(endDate)}</strong> has been <strong style="color:red">rejected</strong>.</p>
    ${comment ? `<p>Reason: ${escapeHtml(comment)}</p>` : ""}
    <p>Please contact HR if you have questions.</p>`
  );
}

export async function sendNewLeaveRequestEmail(managerEmails: string[], employeeName: string, leaveTypeName: string, startDate: string, endDate: string): Promise<void> {
  await Promise.all(
    managerEmails.map((email) =>
      sendEmail(
        email,
        `New Leave Request from ${escapeHtml(employeeName)}`,
        `<p>A new leave request has been submitted by <strong>${escapeHtml(employeeName)}</strong>.</p>
        <p>Type: <strong>${escapeHtml(leaveTypeName)}</strong><br/>From: <strong>${escapeHtml(startDate)}</strong> to <strong>${escapeHtml(endDate)}</strong></p>
        <p>Please log in to the system to review and approve.</p>`
      )
    )
  );
}

