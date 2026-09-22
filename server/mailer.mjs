import nodemailer from 'nodemailer'

let transport

function getTransport() {
  if (transport) return transport
  if (!process.env.SMTP_HOST) throw new Error('SMTP is not configured.')
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  })
  return transport
}

export async function sendReopenEmail({ to, taskId, oldStatus, newStatus }) {
  if (!to) return { sent: false, reason: 'Programmer has no email.' }
  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `Task ${taskId} dibuka kembali`,
    text: `Task ${taskId} dibuka kembali oleh konsultan.\n\nStatus sebelumnya: ${oldStatus}\nStatus sekarang: ${newStatus}\n\nSilakan cek assignment tersebut di Task Assignment.`,
  })
  return { sent: true }
}
