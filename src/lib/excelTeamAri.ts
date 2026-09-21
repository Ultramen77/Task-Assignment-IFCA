/**
 * Excel helper — export & import mirrored 1:1 to template `Documents/IFCA KM+.xlsx` / TEAM ARI
 * Sheet: TEAM ARI  |  dim A1:M  |  freeze A2  |  header h 31.5  |  cols A-M only (N-AD ignored)
 * Columns:
 *   A No (=ROW()-1 live formula on export, static fallback on paste)
 *   B Consultant *
 *   C Bugs / Improvements * (validation Bugs,Improvements)
 *   D Client *
 *   E Nama Screen / report *
 *   F Request *
 *   G Status (QC,Open,Done,Reject,Reopen,Hold,Assign,In Progress)
 *   H Assign Programmer
 *   I Sql Server
 *   J Database
 *   K Target (dd/mm/yyyy date)
 *   L Sisa Hari (=IF(K2="","No Target",IF(G2="Done","",(K2-TODAY()))) + CF <0 red)
 *   M Keterangan (notes)
 */
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { Task, TaskStatus, TaskType } from '../types/task.types'

// ExcelJS types may not expose dataValidations — cast to any for validation APIs
interface WorksheetWithValidations extends ExcelJS.Worksheet {
  dataValidations: {
    add: (range: string, options: any) => void
  }
}

// ---------- column spec ----------
export const TEAM_ARI_HEADERS = [
  'No',
  'Consultant',
  'Bugs / Improvements',
  'Client',
  'Nama Screen / report',
  'Request',
  'Status',
  'Assign Programmer',
  'Sql Server',
  'Database',
  'Target',
  'Sisa Hari',
  'Keterangan',
] as const

export const TEAM_ARI_COL_WIDTHS: Record<string, number> = {
  A: 7.38, B: 13, C: 17.88, D: 31.25, E: 54.5, F: 53.75, G: 20.13, H: 19, I: 12.63, J: 13, K: 10.75, L: 11.38, M: 47.88,
}

export const TEAM_ARI_STATUS_LIST = ['QC', 'Open', 'Done', 'Reject', 'Reopen', 'Hold', 'Assign', 'In Progress'] as const
export const TEAM_ARI_TYPE_LIST = ['Bugs', 'Improvements'] as const

const TYPE_MAP: Record<string, TaskType> = { bugs: 'Bugs', improvements: 'Improvements' }
const STATUS_CANON: Record<string, TaskStatus> = {
  qc: 'QC', open: 'Open', done: 'Done', reject: 'Reject', reopen: 'Reopen', hold: 'Hold', assign: 'Assign', 'in progress': 'In Progress', 'inprogress': 'In Progress',
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFF6F8F9' } },
  left: { style: 'thin', color: { argb: 'FFF6F8F9' } },
  bottom: { style: 'thin', color: { argb: 'FFF6F8F9' } },
  right: { style: 'thin', color: { argb: 'FFF6F8F9' } },
}
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
const L_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8F9' } }
const RED_CF_FILL = 'FFCC0000'

function applyHeaderStyle(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1)
  header.height = 31.5
  header.eachCell(c => {
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.fill = HEADER_FILL
    c.border = THIN_BORDER
  })
  header.commit()
}

function setColWidths(ws: ExcelJS.Worksheet) {
  ws.columns = (['A','B','C','D','E','F','G','H','I','J','K','L','M'] as const).map(letter => ({
    header: '',
    key: letter,
    width: TEAM_ARI_COL_WIDTHS[letter],
  }))
}

function styleDataCell(cell: ExcelJS.Cell, col: string) {
  cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } }
  // center only for No / Status / Target / Sisa Hari, left for free text
  const centered = ['A', 'C', 'G', 'K', 'L'].includes(col)
  cell.alignment = { horizontal: centered ? 'center' : 'left', vertical: 'middle', wrapText: true }
  // borders on all data cells for clean look (original only C/H/L had, but this is nicer)
  cell.border = THIN_BORDER
}

function excelSerialToDate(serial: number): Date | null {
  // Excel epoch 1899-12-30
  if (!Number.isFinite(serial) || serial < 1 || serial > 60000) return null
  const utc = Math.round((serial - 25569) * 86400 * 1000)
  return new Date(utc)
}

function parseTargetCell(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) return toISODate(v)
  if (typeof v === 'number') {
    const d = excelSerialToDate(v)
    return d ? toISODate(d) : null
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    // try dd/mm/yyyy or yyyy-mm-dd or dd-mm-yyyy
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m1) {
      const [, dd, mm, yyyy] = m1
      return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
    }
    const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (m2) {
      const [, yyyy, mm, dd] = m2
      return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
    }
    const m3 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (m3) {
      const [, dd, mm, yyyy] = m3
      return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
    }
    const d = new Date(s)
    if (!isNaN(d.getTime())) return toISODate(d)
    return null
  }
  // ExcelJS may pass {text, hyperlink} etc — fallback to string
  const d = new Date(String(v))
  if (!isNaN(d.getTime())) return toISODate(d)
  return null
}

function toISODate(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const dd = String(d.getDate()).padStart(2,'0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------- EXPORT ----------
export async function exportTeamAri(tasks: Task[], fileName?: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Task Assignment System'
  wb.created = new Date()
  const ws = wb.addWorksheet('TEAM ARI', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    properties: { tabColor: { argb: 'FF7C3AED' } },
  })

  setColWidths(ws)
  // header
  const headerRow = ws.addRow([...TEAM_ARI_HEADERS])
  applyHeaderStyle(ws)
  // freeze already set via views, also ensure header row is bold
  headerRow.commit()

  // validations: C, G, H — need distinct programmer list from tasks + canonical list
  const progSet = new Set<string>(tasks.map(t => t.programmer).filter(Boolean))
  ;['Andi','Ammar','Faisal','Bagus','Raka','Fandy'].forEach(p => progSet.add(p))
  const progList = Array.from(progSet)

  // data rows — newest first to mimic sheet order (or sort by updatedAt desc)
  const sorted = [...tasks].sort((a,b) => b.createdAt.localeCompare(a.createdAt))

  sorted.forEach((t, idx) => {
    const r = idx + 2
    const row = ws.addRow([
      idx + 1,                 // A No (static; formula alternative is =ROW()-1 — but static survives sorting)
      t.consultant,            // B
      t.type,                  // C
      t.client,                // D
      t.screenReport,          // E
      t.request,               // F
      t.status,                // G
      t.programmer || '',      // H
      t.sqlServer || '',       // I
      t.database || '',        // J
      t.targetDate ? new Date(t.targetDate + 'T00:00:00') : '', // K (let Excel format as date)
      { formula: `IF(K${r}="","No Target",IF(G${r}="Done","",(K${r}-TODAY())))` }, // L
      t.notes || '',           // M
    ])
    // style each cell
    const letters = ['A','B','C','D','E','F','G','H','I','J','K','L','M']
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = letters[colNumber - 1]
      styleDataCell(cell, col)
      // L has subtle fill
      if (col === 'L') cell.fill = L_FILL
    })
    // K as date
    const kCell = row.getCell(11)
    if (t.targetDate) {
      kCell.numFmt = 'dd/mm/yyyy'
    }
    // row height auto — keep default but allow wrap
    row.height = 22
    row.commit()
  })

  // validations (exceljs expects ranges like 'C2:C998')
  const lastRow = Math.max(2, sorted.length + 1)
  const wsVal = ws as WorksheetWithValidations
  // C
  wsVal.dataValidations.add(`C2:C${Math.max(lastRow, 998)}`, {
    type: 'list',
    allowBlank: true,
    formulae: ['"Bugs,Improvements"'],
    showErrorMessage: true,
    errorTitle: 'Invalid Type',
    error: 'Pilih Bugs atau Improvements',
    showDropDown: false,
  })
  // G
  wsVal.dataValidations.add(`G2:G${Math.max(lastRow, 998)}`, {
    type: 'list',
    allowBlank: true,
    formulae: ['"QC,Open,Done,Reject,Reopen,Hold,Assign,In Progress"'],
    showErrorMessage: true,
    errorTitle: 'Invalid Status',
    error: 'Pilih salah satu status yang valid',
    showDropDown: false,
  })
  if (progList.length) {
    const listStr = `"${progList.join(',')}"`
    wsVal.dataValidations.add(`H2:H${Math.max(lastRow, 998)}`, {
      type: 'list',
      allowBlank: true,
      formulae: [listStr],
      showDropDown: false,
    })
  }

  // conditional formatting L < 0 red
  ws.addConditionalFormatting({
    ref: `L2:L${Math.max(lastRow, 998)}`,
    rules: [
      {
        type: 'cellIs',
        operator: 'lessThan',
        priority: 1,
        formulae: [0],
        style: {
          font: { color: { argb: 'FFFFFFFF' }, bold: true },
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: RED_CF_FILL } },
        },
      },
    ],
  })

  // autoFilter on header
  ws.autoFilter = { from: 'A1', to: 'M1' }
  // print titles
  ws.pageSetup.printTitlesRow = '1:1'

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const name = fileName || `TEAM ARI - Export ${new Date().toISOString().slice(0,10)}.xlsx`
  saveAs(blob, name)
}

// ---------- IMPORT ----------
export interface ImportRowPreview {
  rowNumber: number            // excel row number (2-indexed)
  consultant: string
  type: string
  client: string
  screenReport: string
  request: string
  status: string
  programmer: string
  sqlServer: string
  database: string
  targetDate: string | null    // YYYY-MM-DD or null
  notes: string
  rawTarget: unknown
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ImportParseResult {
  rows: ImportRowPreview[]
  validCount: number
  invalidCount: number
  emptySkipped: number
}

export async function parseTeamAriFile(file: File): Promise<ImportParseResult> {
  const wb = new ExcelJS.Workbook()
  const buf = await file.arrayBuffer()
  await wb.xlsx.load(buf)

  // pick sheet: prefer TEAM ARI, else first sheet with header 'Consultant'
  let ws: ExcelJS.Worksheet | undefined = wb.getWorksheet('TEAM ARI') as ExcelJS.Worksheet | undefined
  if (!ws) {
    for (const sh of wb.worksheets) {
      const v = String(sh.getCell('B1').value || '').toLowerCase()
      if (v.includes('consultant')) { ws = sh; break }
    }
    if (!ws) ws = wb.worksheets[0]
  }
  if (!ws) throw new Error('Tidak ada sheet yang terbaca di file.')

  const rows: ImportRowPreview[] = []
  let emptySkipped = 0

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    // exceljs getCell values — need to handle richText and formula
    const getV = (col: string): unknown => {
      const c = row.getCell(col)
      const v: any = c.value
      if (v === null || v === undefined) return ''
      if (typeof v === 'object' && v !== null) {
        if ('result' in v) return (v as any).result // formula result
        if ('text' in v) return (v as any).text
        if ('richText' in v) return (v as any).richText.map((x: any) => x.text).join('')
        if (v instanceof Date) return v
      }
      return v
    }

    const consultant = String(getV('B') ?? '').trim()
    const rawType = String(getV('C') ?? '').trim()
    const client = String(getV('D') ?? '').trim()
    const screenReport = String(getV('E') ?? '').trim()
    const request = String(getV('F') ?? '').trim()
    const rawStatus = String(getV('G') ?? '').trim()
    const programmer = String(getV('H') ?? '').trim()
    const sqlServer = String(getV('I') ?? '').trim()
    const database = String(getV('J') ?? '').trim()
    const rawTarget = getV('K')
    const notes = String(getV('M') ?? '').trim()

    const isEmptyRow = !consultant && !client && !screenReport && !request
    if (isEmptyRow) { emptySkipped++; continue }

    const errors: string[] = []
    const warnings: string[] = []

    // consultant
    if (!consultant) errors.push('Consultant wajib diisi (kolom B)')
    // type
    const normType = rawType ? TYPE_MAP[rawType.toLowerCase()] : null
    if (!rawType) errors.push('Bugs/Improvements wajib diisi (kolom C)')
    else if (!normType) errors.push(`Type "${rawType}" tidak valid — harus Bugs atau Improvements`)
    // client
    if (!client) errors.push('Client wajib diisi (kolom D)')
    // screen
    if (!screenReport) warnings.push('Screen/Report kosong (kolom E) — akan tetap diimport sebagai "-"')
    // request
    if (!request) errors.push('Request wajib diisi (kolom F)')
    // status
    let normStatus: TaskStatus = 'Open'
    if (rawStatus) {
      const key = rawStatus.toLowerCase().replace(/\s+/g, ' ').trim()
      const canon = STATUS_CANON[key] || STATUS_CANON[key.replace(/\s/g,'')]
      if (!canon) errors.push(`Status "${rawStatus}" tidak valid — pakai QC/Open/Done/Reject/Reopen/Hold/Assign/In Progress`)
      else normStatus = canon
    } else {
      warnings.push('Status kosong — default Open')
    }
    // target
    let targetDate: string | null = null
    if (rawTarget !== '' && rawTarget !== null && rawTarget !== undefined) {
      // Excel may store as Date object directly
      if (rawTarget instanceof Date) targetDate = toISODate(rawTarget)
      else if (typeof rawTarget === 'number') {
        const d = excelSerialToDate(rawTarget)
        if (d) targetDate = toISODate(d)
        else warnings.push(`Target "${String(rawTarget)}" tidak dikenali — diabaikan`)
      } else if (typeof rawTarget === 'string' && rawTarget.trim()) {
        const parsed = parseTargetCell(rawTarget)
        if (parsed) targetDate = parsed
        else warnings.push(`Target "${String(rawTarget).trim()}" tidak valid — diabaikan`)
      } else {
        const parsed = parseTargetCell(rawTarget)
        if (parsed) targetDate = parsed
      }
    }

    // sanity: if consultant/client/programmer names contain leading/trailing spaces already trimmed

    const isValid = errors.length === 0

    rows.push({
      rowNumber: r,
      consultant,
      type: (normType as string) || rawType,
      client,
      screenReport: screenReport || '-',
      request,
      status: normStatus as unknown as string,
      programmer,
      sqlServer,
      database,
      targetDate,
      notes,
      rawTarget,
      isValid,
      errors,
      warnings,
    })
  }

  const validCount = rows.filter(x => x.isValid).length
  return { rows, validCount, invalidCount: rows.length - validCount, emptySkipped }
}

// re-export helper
export function downloadTemplate(): Promise<void> {
  // empty template export (no tasks)
  return exportTeamAri([], `TEAM ARI - Template.xlsx`)
}
