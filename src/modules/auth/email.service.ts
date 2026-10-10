import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.mailHost,
  port: env.mailPort,
  secure: false,
});

export async function sendWelcomeEmail(name: string, email: string) {
  await transporter.sendMail({
    from: "Mini ERP <no-reply@mini-erp.local>",
    to: email,
    subject: "Welcome to Mini ERP",
    text: `Hello ${name}, welcome to Mini ERP.`,
  });
}
