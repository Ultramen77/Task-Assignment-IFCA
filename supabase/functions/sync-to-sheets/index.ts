// supabase/functions/sync-to-sheets/index.ts
// Edge Function: Web (Supabase) → Google Sheets FULL API (service account JWT)
// 1 arah: create/update/archive → sheets.spreadsheets.values.append / update
// Env: GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON string), SPREADSHEET_ID, SHEET_NAME (default TEAM ARI)

const SPREADSHEET_ID = Deno.env.get("SPREADSHEET_ID") ?? "";
const SHEET_NAME = Deno.env.get("SHEET_NAME") ?? "TEAM ARI";
const SA_JSON_RAW = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ?? "";

const TEAM_ARI_HEADERS = [
  "No",
  "Consultant",
  "Bugs / Improvements",
  "Client",
  "Nama Screen / report",
  "Request",
  "Status",
  "Assign Programmer",
  "Sql Server",
  "Database",
  "Target",
  "Sisa Hari",
  "Keterangan",
] as const;

type SyncAction = "create" | "update" | "archive";
interface SyncPayload {
  action: SyncAction;
  taskId: string;
  row?: {
    consultant: string;
    type: string;
    client: string;
    screenReport: string;
    request: string;
    status: string;
    programmer: string;
    sqlServer: string;
    database: string;
    targetDate: string | null; // YYYY-MM-DD
    notes: string;
  };
  status?: string; // for archive/update fallback
}

function b64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let b64 = "";
  // Deno: use btoa on binary string
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function getAccessToken(): Promise<string> {
  if (!SA_JSON_RAW) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
  const sa = JSON.parse(SA_JSON_RAW) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const signingInput = `${h}.${p}`;
  const key = await importPrivateKey(sa.private_key);
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const sig = b64url(new Uint8Array(sigBuf));
  const assertion = `${signingInput}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(assertion)}`,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`token error ${res.status}: ${JSON.stringify(j)}`);
  return j.access_token as string;
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-sheets-sync-token, x-supabase-api-version",
    "access-control-allow-methods": "POST, OPTIONS, GET",
  };
}

function formatTargetForSheet(ymd: string | null): string {
  if (!ymd) return "";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = parseInt(m[3], 10);
  const mo = parseInt(m[2], 10);
  const y = m[1];
  return `${d}/${mo}/${y}`;
}

function taskToRowValues(taskId: string, row: NonNullable<SyncPayload["row"]>, rowNumber: number, seqNo: number): (string | number)[] {
  const target = formatTargetForSheet(row.targetDate ?? null);
  // Sheet locale id_ID uses ; as separator — use ; to avoid #ERROR! (was comma)
  const formulaL = `=IFERROR(IF(K${rowNumber}="";"No Target";IF(G${rowNumber}="Done";"";(K${rowNumber}-TODAY())));"")`;
  return [
    seqNo,
    row.consultant,
    row.type,
    row.client,
    row.screenReport,
    row.request,
    row.status,
    row.programmer,
    row.sqlServer,
    row.database,
    target,
    formulaL,
    row.notes ?? "",
  ];
}

async function sheetsGetValues(token: string, range: string) {
  const encoded = encodeURIComponent(range).replace(/'/g, '%27');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encoded}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  if (!r.ok) throw new Error(`sheets get ${r.status}: ${JSON.stringify(j)}`);
  return j as { values?: string[][] };
}

async function sheetsAppend(token: string, range: string, values: (string | number)[][], valueInputOption = "USER_ENTERED") {
  const encoded = encodeURIComponent(range).replace(/'/g, '%27');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encoded}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ values, majorDimension: "ROWS" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`sheets append ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

async function sheetsUpdate(token: string, range: string, values: (string | number)[][], valueInputOption = "USER_ENTERED") {
  const encoded = encodeURIComponent(range).replace(/'/g, '%27');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encoded}?valueInputOption=${valueInputOption}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ values, majorDimension: "ROWS" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`sheets update ${r.status}: ${JSON.stringify(j)}`);
  return j;
}

function sheetRange(a1: string): string {
  // Quote sheet name if it contains space
  const name = SHEET_NAME.includes(' ') || SHEET_NAME.includes("'") ? `'${SHEET_NAME}'` : SHEET_NAME;
  return `${name}!${a1}`;
}

async function findRowByTaskId(token: string, taskId: string): Promise<number | null> {
  const j = await sheetsGetValues(token, sheetRange('A2:M'));
  const rows = j.values ?? [];
  // Debug: log first 3 rows length to edge logs
  // Strategy 1: Keterangan contains taskId
  for (let i = 0; i < rows.length; i++) {
    const m = rows[i]?.[12] ?? "";
    if (m.includes(taskId)) return i + 2;
  }
  // Strategy 2: exact match across all cols (fallback)
  for (let i = 0; i < rows.length; i++) {
    if (rows[i]?.some((c) => c === taskId)) return i + 2;
  }
  // Strategy 3: normalized — trim brackets
  const bare = taskId.replace(/[\[\]]/g, '');
  for (let i = 0; i < rows.length; i++) {
    const rowStr = (rows[i] ?? []).join(' ');
    if (rowStr.includes(bare)) return i + 2;
  }
  return null;
}

async function getNextDataRow(token: string): Promise<number> {
  const j = await sheetsGetValues(token, sheetRange('A2:M'));
  const rows = j.values ?? [];
  // Wi request: cek kolom No (A) aja — baris pertama kosong SETELAH data terakhir, bukan gap di tengah
  // Sheet bisa ada gap di tengah (row kosong), jadi cari last non-empty A
  let lastIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const a = (rows[i]?.[0] ?? '').toString().trim();
    if (a !== '') lastIdx = i;
  }
  if (lastIdx === -1) return 2;
  // Cek apakah row setelah lastIdx memang kosong (seharusnya, karena setelah 55 masih kosong di 63)
  // Kalau gap di tengah, tetap append setelah last, bukan isi gap
  return lastIdx + 3; // +1 for header offset, +1 for next, +1 for 1-indexed -> last sheetRow +1
}

async function getNextSeqNo(token: string): Promise<number> {
  const j = await sheetsGetValues(token, sheetRange('A2:A'));
  const vals = j.values ?? [];
  let maxNo = 0;
  for (const r of vals) {
    const n = parseInt((r[0] ?? '').toString().trim(), 10);
    if (!isNaN(n) && n > maxNo) maxNo = n;
  }
  return maxNo + 1;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders(), "content-type": "application/json" } });
  }

  const syncToken = Deno.env.get("SHEETS_SYNC_TOKEN");
  if (syncToken) {
    const got = req.headers.get("x-sheets-sync-token") ?? new URL(req.url).searchParams.get("token") ?? "";
    if (got !== syncToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders(), "content-type": "application/json" } });
    }
  }

  if (!SPREADSHEET_ID) {
    return new Response(JSON.stringify({ error: "Missing SPREADSHEET_ID" }), { status: 500, headers: { ...corsHeaders(), "content-type": "application/json" } });
  }

  let body: SyncPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders(), "content-type": "application/json" } });
  }

  if (body?.action === 'debug') {
    try {
      const token = await getAccessToken();
      const j = await sheetsGetValues(token, sheetRange('A2:M'));
      const rows = j.values ?? [];
      const sample = rows.slice(0, 3).map(r => r.slice(0, 13));
      const slice5566 = rows.slice(54, 70).map((r,i) => ({ sheetRow: 56+i, row: r }));
      const last10 = rows.slice(-10).map((r,i) => ({ idx: rows.length-10+i+2, row: r }));
      const positions: number[] = [];
      rows.forEach((r,i)=>{ if ((r ?? []).join(' ').includes('TASK-TEST')) positions.push(i+2) });
      const nextRow = await getNextDataRow(token);
      const nextSeq = await getNextSeqNo(token);
      const aCol = await sheetsGetValues(token, sheetRange('A2:A'));
      const aLen = aCol.values?.length ?? 0;
      const amSlice = rows.map((r,i)=> ({ r: i+2, a: r[0] ?? '', l: r[11] ?? '', b: r[1] ?? '' })).filter(x=> x.r<=70 || x.r>=60);
      return new Response(JSON.stringify({ ok:true, rowsCount: rows.length, aLen, nextRow, nextSeq, positions, sample, slice5566, last10, amSlice: amSlice.slice(0,20) }), { headers: { ...corsHeaders(), 'content-type':'application/json' } });
    } catch(e:any){ return new Response(JSON.stringify({ error: e?.message ?? String(e)}), { status:500, headers:{...corsHeaders(),'content-type':'application/json'}}) }
  }
  if (body?.action === 'clearTest') {
    try {
      const token = await getAccessToken();
      const pos = await findRowByTaskId(token, body.taskId);
      if (!pos) return new Response(JSON.stringify({ ok:true, note:'not found' }), { headers:{...corsHeaders(),'content-type':'application/json'}});
      // Clear the row (set empty values for A:M)
      await sheetsUpdate(token, sheetRange(`A${pos}:M${pos}`), [['','','','','','','','','','','','','']]);
      return new Response(JSON.stringify({ ok:true, clearedRow: pos }), { headers:{...corsHeaders(),'content-type':'application/json'}});
    } catch(e:any){ return new Response(JSON.stringify({ error: e?.message ?? String(e)}), { status:500, headers:{...corsHeaders(),'content-type':'application/json'}}) }
  }
  if (!body?.taskId || !body?.action) {
    return new Response(JSON.stringify({ error: "Missing taskId/action" }), { status: 400, headers: { ...corsHeaders(), "content-type": "application/json" } });
  }

  try {
    const token = await getAccessToken();

    if (body.action === "create") {
      if (!body.row) return new Response(JSON.stringify({ error: "Missing row" }), { status: 400, headers: { ...corsHeaders(), "content-type": "application/json" } });
      // Dedup: if already exists (retry from queue), treat as update
      const existingRow = await findRowByTaskId(token, body.taskId);
      if (existingRow) {
        const cur = await sheetsGetValues(token, sheetRange(`M${existingRow}:M${existingRow}`));
        const curNotes = cur.values?.[0]?.[0] ?? "";
        const rawNotes2 = (body.row.notes ?? '').trim();
        const hasTag2 = curNotes.includes(body.taskId) || rawNotes2.includes(`[${body.taskId}]`);
        const notesWithId2 = hasTag2 ? (curNotes.includes(body.taskId) ? curNotes : (rawNotes2 ? `${rawNotes2} [${body.taskId}]` : `[${body.taskId}]`)) : (rawNotes2 ? `${rawNotes2} [${body.taskId}]` : `[${body.taskId}]`);
        const rowWithId2 = { ...body.row, notes: notesWithId2 };
        const curNoRes2 = await sheetsGetValues(token, sheetRange(`A${existingRow}:A${existingRow}`));
        const curNo2 = parseInt(curNoRes2.values?.[0]?.[0] ?? '', 10) || existingRow -1;
        const values2 = taskToRowValues(body.taskId, rowWithId2, existingRow, curNo2);
        await sheetsUpdate(token, sheetRange(`A${existingRow}:M${existingRow}`), [values2]);
        return new Response(JSON.stringify({ ok: true, sheetRow: existingRow, dedup: true }), { headers: { ...corsHeaders(), "content-type": "application/json" } });
      }
      const nextRow = await getNextDataRow(token);
      const rawNotes = (body.row.notes ?? '').trim();
      const hasOwnTag = rawNotes.includes(`[${body.taskId}]`);
      const notesWithId = hasOwnTag ? rawNotes : (rawNotes ? `${rawNotes} [${body.taskId}]` : `[${body.taskId}]`);
      const rowWithId = { ...body.row, notes: notesWithId };
      const seqNo = await getNextSeqNo(token);
      const values = taskToRowValues(body.taskId, rowWithId, nextRow, seqNo);
      await sheetsUpdate(token, sheetRange(`A${nextRow}:M${nextRow}`), [values]);
      return new Response(JSON.stringify({ ok: true, sheetRow: nextRow }), { headers: { ...corsHeaders(), "content-type": "application/json" } });
    }

    if (body.action === "update") {
      const rowNum = await findRowByTaskId(token, body.taskId);
      if (!rowNum) {
        // fallback to create if not found
        if (!body.row) return new Response(JSON.stringify({ error: "Not found and no row to create" }), { status: 404, headers: { ...corsHeaders(), "content-type": "application/json" } });
        const nextRow = await getNextDataRow(token);
        const rawNotes2 = (body.row.notes ?? '').trim();
        const hasOwnTag2 = rawNotes2.includes(`[${body.taskId}]`);
        const notesWithId = hasOwnTag2 ? rawNotes2 : (rawNotes2 ? `${rawNotes2} [${body.taskId}]` : `[${body.taskId}]`);
        const rowWithId = { ...body.row, notes: notesWithId };
        const seqNo2 = await getNextSeqNo(token);
        const values = taskToRowValues(body.taskId, rowWithId, nextRow, seqNo2);
        await sheetsUpdate(token, sheetRange(`A${nextRow}:M${nextRow}`), [values]);
        return new Response(JSON.stringify({ ok: true, created: true, sheetRow: nextRow }), { headers: { ...corsHeaders(), "content-type": "application/json" } });
      }
      if (body.row) {
        // Preserve existing Keterangan's taskId tag if present
        const cur = await sheetsGetValues(token, sheetRange(`M${rowNum}:M${rowNum}`));
        const curNotes = cur.values?.[0]?.[0] ?? "";
        const hasTag = curNotes.includes(body.taskId);
        const notesWithId = hasTag ? (body.row.notes ? (curNotes.includes(body.row.notes) ? curNotes : `${body.row.notes} ${curNotes.match(/\[TASK-[^\]]+\]/)?.[0] ?? `[${body.taskId}]`}`) : curNotes) : (body.row.notes ? `${body.row.notes} [${body.taskId}]` : `[${body.taskId}]`);
        const rowWithId = { ...body.row, notes: notesWithId };
        const curNoRes = await sheetsGetValues(token, sheetRange(`A${rowNum}:A${rowNum}`));
        const curNo = parseInt(curNoRes.values?.[0]?.[0] ?? '', 10) || rowNum -1;
        const values = taskToRowValues(body.taskId, rowWithId, rowNum, curNo);
        await sheetsUpdate(token, sheetRange(`A${rowNum}:M${rowNum}`), [values]);
      } else if (body.status) {
        // status-only update: patch G col
        await sheetsUpdate(token, sheetRange(`G${rowNum}:G${rowNum}`), [[body.status]]);
      }
      return new Response(JSON.stringify({ ok: true, sheetRow: rowNum }), { headers: { ...corsHeaders(), "content-type": "application/json" } });
    }

    if (body.action === "archive") {
      const rowNum = await findRowByTaskId(token, body.taskId);
      if (!rowNum) return new Response(JSON.stringify({ ok: true, note: "No sheet row for task" }), { headers: { ...corsHeaders(), "content-type": "application/json" } });
      // Option: set status to Done or tag Keterangan with [ARCHIVED]
      // Here we append to Keterangan and optionally set G=Done if not already
      const cur = await sheetsGetValues(token, sheetRange(`M${rowNum}:M${rowNum}`));
      const curNotes = cur.values?.[0]?.[0] ?? "";
      const nextNotes = curNotes.includes("[ARCHIVED]") ? curNotes : `${curNotes} [ARCHIVED]`.trim();
      await sheetsUpdate(token, sheetRange(`M${rowNum}:M${rowNum}`), [[nextNotes]]);
      return new Response(JSON.stringify({ ok: true, sheetRow: rowNum }), { headers: { ...corsHeaders(), "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders(), "content-type": "application/json" } });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { ...corsHeaders(), "content-type": "application/json" } });
  }
});
