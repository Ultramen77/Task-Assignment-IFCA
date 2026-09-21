# Email Notifications

The frontend sends a `reopen` notification through the Supabase Edge Function
`send-email` when a task changes from `Done` or `QC` to `Open` or `Reopen`.
The email is sent to the currently assigned programmer's email address.

## Deploy

From the repository root, configure the SMTP secrets in Supabase and deploy the
function:

```powershell
npx supabase secrets set --project-ref ntbylafxutwemwmdputg SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=<sender-email> SMTP_PASS=<smtp-app-password> SMTP_FROM=<sender-email> SMTP_FROM_NAME="Task System"
npx supabase functions deploy send-email --project-ref ntbylafxutwemwmdputg
```

Do not put SMTP credentials in `.env.local`, frontend source, or the repository.

If the programmer has no email, the task status is still updated but the
function returns `sent: false` with reason `No programmer email`.
