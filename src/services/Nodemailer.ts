import nodemailer from "nodemailer";

export default async function mailer(
  email: string,
  title: string,
  body: string
) {
  try {
    const host = process.env.MAIL_HOST || "smtp.gmail.com";
    const isGmail = host.toLowerCase().includes("gmail");
    const port = Number(process.env.MAIL_PORT) || (isGmail ? 465 : 587);
    const secure = port === 465;

    let transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: secure,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    let sender = process.env.MAIL_USER || "noreply@studynotion.com";
    let info = await transporter.sendMail({
      from: `"StudyNotion" <${sender}>`,
      to: email,
      subject: title,
      html: body,
    });

    console.log("[MAILER SUCCESS] Sent OTP to:", email, "Message ID:", info.messageId);
    return info;
  } catch (error) {
    console.error("[MAILER ERROR] Failed to send email:", error);
    throw error;
  }
}
