import { jest } from "@jest/globals";

// Important: Mock must be defined before any imports
const mockSendMail = jest.fn() as any;
mockSendMail.mockResolvedValue({ messageId: "test" });

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

import { sendLeaveApprovedEmail, sendLeaveRejectedEmail, sendNewLeaveRequestEmail, _resetTransporterForTests } from "../services/email.service";

describe("Email Service", () => {
  beforeAll(() => {
    // Set SMTP env vars to enable transporter
    process.env.SMTP_HOST = "smtp.test.com";
    process.env.SMTP_USER = "test@test.com";
    process.env.SMTP_PASS = "password";
    process.env.EMAIL_FROM = "noreply@test.com";
  });

  afterAll(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
  });

  beforeEach(() => {
    mockSendMail.mockClear();
  });

  it("sends approval email with correct recipient and subject", async () => {
    await sendLeaveApprovedEmail("Alice", "alice@test.com", "Annual Leave", "2026-04-01", "2026-04-05");
    
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@test.com",
        subject: expect.stringContaining("Approved"),
      })
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("Alice"),
      })
    );
  });

  it("sends rejection email with comment", async () => {
    await sendLeaveRejectedEmail("Alice", "alice@test.com", "Annual Leave", "2026-04-01", "2026-04-05", "Insufficient balance");
    
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@test.com",
        subject: expect.stringContaining("Rejected"),
        html: expect.stringContaining("Insufficient balance"),
      })
    );
  });

  it("sends rejection email without comment", async () => {
    await sendLeaveRejectedEmail("Alice", "alice@test.com", "Annual Leave", "2026-04-01", "2026-04-05");
    
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@test.com",
        subject: expect.stringContaining("Rejected"),
      })
    );
  });

  it("sends new leave request email to multiple managers", async () => {
    await sendNewLeaveRequestEmail(
      ["manager1@test.com", "manager2@test.com"],
      "Bob",
      "Sick Leave",
      "2026-05-01",
      "2026-05-03"
    );
    
    expect(mockSendMail).toHaveBeenCalledTimes(2);
    expect(mockSendMail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "manager1@test.com",
        subject: expect.stringContaining("New Leave Request from Bob"),
      })
    );
    expect(mockSendMail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: "manager2@test.com",
        subject: expect.stringContaining("New Leave Request from Bob"),
      })
    );
  });

  it("includes from address in email", async () => {
    await sendLeaveApprovedEmail("Alice", "alice@test.com", "Annual Leave", "2026-04-01", "2026-04-05");
    
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@test.com",
      })
    );
  });

  it("does not send when SMTP not configured", async () => {
    const savedHost = process.env.SMTP_HOST;
    const savedUser = process.env.SMTP_USER;
    const savedPass = process.env.SMTP_PASS;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    _resetTransporterForTests();

    await sendLeaveApprovedEmail("Alice", "alice@test.com", "Annual Leave", "2026-04-01", "2026-04-05");
    expect(mockSendMail).not.toHaveBeenCalled();

    // Restore
    process.env.SMTP_HOST = savedHost;
    process.env.SMTP_USER = savedUser;
    process.env.SMTP_PASS = savedPass;
    _resetTransporterForTests();
  });

  it("escapes HTML in user-supplied fields", async () => {
    await sendLeaveRejectedEmail(
      "Alice",
      "alice@test.com",
      "Annual Leave",
      "2026-04-01",
      "2026-04-05",
      '<script>alert("xss")</script>'
    );
    const callArg = mockSendMail.mock.calls[0][0] as { html: string };
    expect(callArg.html).not.toContain("<script>");
    expect(callArg.html).toContain("&lt;script&gt;");
  });
});
