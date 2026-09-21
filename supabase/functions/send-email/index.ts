import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'https://esm.sh/nodemailer@6.9.13'

const SMTP_HOST = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com'
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587')
const SMTP_USER = Deno.env.get('SMTP_USER') || ''
const SMTP_PASS = Deno.env.get('SMTP_PASS') || ''
const SMTP_FROM = Deno.env.get('SMTP_FROM') || SMTP_USER
const SMTP_FROM_NAME = Deno.env.get('SMTP_FROM_NAME') || 'Task System'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailPayload {
  task_id: string
  action: 'create' | 'update' | 'reopen'
  old_status?: string
  new_status?: string
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for 587
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
})

async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM}>`,
    to,
    subject,
    html,
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: EmailPayload = await req.json()
    const { task_id, action, old_status, new_status } = payload

    if (!task_id) {
      return new Response(JSON.stringify({ error: 'task_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (
      action === 'reopen' &&
      (!['Done', 'QC'].includes(old_status || '') || !['Open', 'Reopen'].includes(new_status || ''))
    ) {
      return new Response(JSON.stringify({ error: 'Invalid reopen status transition' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: task, error } = await supabase
      .from('tasks')
      .select(`
        task_id,
        type,
        screen_report,
        request,
        status,
        target_date,
        consultant:consultants(consultant_name, consultant_email),
        programmer:programmers(programmer_name, programmer_email),
        client:clients(client_name)
      `)
      .eq('task_id', task_id)
      .single()

    if (error || !task) {
      throw new Error(`Task not found: ${error?.message}`)
    }

    const consultantEmail = task.consultant?.consultant_email
    const programmerEmail = task.programmer?.programmer_email
    const consultantName = task.consultant?.consultant_name || 'Consultant'
    const programmerName = task.programmer?.programmer_name || 'Programmer'
    const clientName = task.client?.client_name || 'Client'

    if (action === 'reopen') {
      if (!programmerEmail) {
        return new Response(JSON.stringify({ sent: false, reason: 'No programmer email' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const safeTaskId = escapeHtml(task.task_id)
      const safeProgrammerName = escapeHtml(programmerName)
      const safeConsultantName = escapeHtml(consultantName)
      const safeClientName = escapeHtml(clientName)
      const safeScreenReport = escapeHtml(task.screen_report)
      const safeType = escapeHtml(task.type)
      const safeRequest = escapeHtml(task.request)
      const safeOldStatus = escapeHtml(old_status || 'Done/QC')
      const safeNewStatus = escapeHtml(new_status || task.status)

      await sendEmail(programmerEmail, `🔁 Task Reopened: ${task.task_id} - ${task.screen_report}`, `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f97316;">Task Dibuka Ulang</h2>
          <p>Hi <b>${safeProgrammerName}</b>,</p>
          <p>Pekerjaan ini dibuka ulang. Mohon direview dan dilanjutkan kembali.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Task ID</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeTaskId}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Client</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeClientName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Type</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeType}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Screen/Report</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeScreenReport}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Request</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeRequest}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Status</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeOldStatus} → ${safeNewStatus}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Consultant</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${safeConsultantName}</td></tr>
          </table>

          <p style="margin-top: 24px;">
            <a href="https://faisalfakhri.github.io/task-assignment-system/#/tasks?id=${encodeURIComponent(task.task_id)}"
               style="background: #f97316; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              Buka Task
            </a>
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 12px;">Task Assignment System — Auto-generated email</p>
        </div>
      `)

      return new Response(JSON.stringify({ sent: true, to: programmerEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create') {
      if (!programmerEmail) {
        return new Response(JSON.stringify({ sent: false, reason: 'No programmer email' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await sendEmail(programmerEmail, `📋 New Task: ${task.task_id} - ${task.screen_report}`, `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">New Task Assigned</h2>
          <p>Hi <b>${programmerName}</b>,</p>
          <p>You have a new task from <b>${consultantName}</b>:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Task ID</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.task_id}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Type</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.type}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Client</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${clientName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Screen/Report</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.screen_report}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Request</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.request}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Status</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.status}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Target Date</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.target_date ? formatDate(task.target_date) : '-'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Consultant</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${consultantName}</td></tr>
          </table>

          <p style="margin-top: 24px;">
            <a href="https://faisalfakhri.github.io/task-assignment-system/#/tasks?id=${task.task_id}" 
               style="background: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              View Task
            </a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 12px;">Task Assignment System — Auto-generated email</p>
        </div>
      `)

      return new Response(JSON.stringify({ sent: true, to: programmerEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update' && old_status !== new_status) {
      if (!consultantEmail) {
        return new Response(JSON.stringify({ sent: false, reason: 'No consultant email' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const statusColors: Record<string, string> = {
        Open: '#0ea5e9', Assign: '#f59e0b', 'In Progress': '#06b6d4',
        QC: '#a855f7', Done: '#22c55e', Hold: '#64748b',
        Reopen: '#f97316', Reject: '#ef4444',
      }
      const color = statusColors[new_status || ''] || '#374151'

      await sendEmail(consultantEmail, `🔄 Status Update: ${task.task_id} → ${new_status}`, `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${color};">Task Status Changed</h2>
          <p>Hi <b>${consultantName}</b>,</p>
          <p>Status of task <b>${task.task_id}</b> updated by <b>${programmerName}</b>:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Task ID</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.task_id}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Screen/Report</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.screen_report}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Client</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${clientName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Previous Status</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><span style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">${old_status}</span></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>New Status</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><span style="background: ${color}20; color: ${color}; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${new_status}</span></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><b>Programmer</b></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${programmerName}</td></tr>
          </table>

          <p style="margin-top: 24px;">
            <a href="https://faisalfakhri.github.io/task-assignment-system/#/tasks?id=${task.task_id}" 
               style="background: ${color}; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              View Task
            </a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 12px;">Task Assignment System — Auto-generated email</p>
        </div>
      `)

      return new Response(JSON.stringify({ sent: true, to: consultantEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ sent: false, reason: 'No action needed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-email error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
