import { Resend } from "resend";
import twilio from "twilio";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

export async function sendSeatAlertEmail(to: string, sectionLabel: string, courseTitle: string, seats: number) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set - skipping email send");
    return;
  }
  await resend.emails.send({
    from: process.env.NOTIFY_FROM_EMAIL || "seats@yourdomain.edu",
    to,
    subject: `Seat open: ${sectionLabel} - ${courseTitle}`,
    text: `${sectionLabel} (${courseTitle}) now has ${seats} seat${seats === 1 ? "" : "s"} available.\n\nRegister now in WesPortal - open seats can disappear within minutes.\n\nYou're getting this because you set a watch on this section. Manage your watches at ${process.env.APP_URL || "your app URL"}.`,
  });
}

export async function sendSeatAlertSms(to: string, sectionLabel: string, seats: number) {
  if (!twilioClient) {
    console.warn("Twilio credentials not set - skipping SMS send");
    return;
  }
  await twilioClient.messages.create({
    from: process.env.TWILIO_FROM_NUMBER,
    to,
    body: `Seat open: ${sectionLabel} now has ${seats} seat(s) available. Register in WesPortal ASAP.`,
  });
}

export async function sendLoginCodeEmail(to: string, code: string) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set - skipping email send. Code was:", code);
    return;
  }
  await resend.emails.send({
    from: process.env.NOTIFY_FROM_EMAIL || "seats@yourdomain.edu",
    to,
    subject: "Your sign-in code",
    text: `Your sign-in code is: ${code}\n\nIt expires in 10 minutes.`,
  });
}
