/**
 * Google Apps Script Web App Backend for Task Assignment Management System
 * Deployed as a spreadsheet-bound web app.
 * Relies on the active spreadsheet having the sheets:
 * Tasks, TaskHistory, Attachments, Clients, Consultants, Programmers, Settings
 */

// Route GET requests
function doGet(e) {
  try {
    checkSheetsSetup();
    const action = e.parameter.action;
    if (!action) {
      return buildErrorResponse("BAD_REQUEST", "Missing action parameter");
    }

    switch (action) {
      case "health":
        return buildSuccessResponse({ status: "ok", version: "1.0.0" });
      case "listTasks":
        return handleListTasks(e);
      case "getTask":
        return handleGetTask(e);
      case "listClients":
        return handleListClients(e);
      case "listConsultants":
        return handleListConsultants(e);
      case "listProgrammers":
        return handleListProgrammers(e);
      case "getTaskHistory":
        return handleGetTaskHistory(e);
      case "getTaskAttachments":
        return handleGetTaskAttachments(e);
      case "viewAttachment":
        return handleViewAttachment(e);
      case "listRecentHistory":
        return handleListRecentHistory(e);
      default:
        return buildErrorResponse("UNKNOWN_ACTION", "Unknown action: " + action);
    }
  } catch (err) {
    return buildErrorResponse(
      err.message.indexOf("Missing required sheet") > -1 ? "CONFIGURATION_ERROR" : "SERVER_ERROR",
      err.message
    );
  }
}

// Route POST requests
function doPost(e) {
  try {
    checkSheetsSetup();
    const action = e.parameter.action;
    if (!action) {
      return buildErrorResponse("BAD_REQUEST", "Missing action parameter");
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return buildErrorResponse("BAD_REQUEST", "Malformed JSON payload in request body");
    }

    switch (action) {
      case "createTask":
        return handleCreateTask(payload);
      case "updateTask":
        return handleUpdateTask(payload);
      case "archiveTask":
        return handleArchiveTask(payload);
      case "uploadAttachment":
        return handleUploadAttachment(payload);
      case "deleteAttachment":
        return handleDeleteAttachment(payload);
      default:
        return buildErrorResponse("UNKNOWN_ACTION", "Unknown action: " + action);
    }
  } catch (err) {
    return buildErrorResponse("SERVER_ERROR", err.message);
  }
}

// Check database setup
function checkSheetsSetup() {
  const required = ["Tasks", "TaskHistory", "Attachments", "Clients", "Consultants", "Programmers", "Settings"];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (let i = 0; i < required.length; i++) {
    const sheet = ss.getSheetByName(required[i]);
    if (!sheet) {
      throw new Error("Missing required sheet in database: " + required[i]);
    }
  }
}

// Success Response Envelope
function buildSuccessResponse(data) {
  const response = {
    success: true,
    data: data
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// Error Response Envelope
function buildErrorResponse(code, message) {
  const response = {
    success: false,
    error: {
      code: code,
      message: message
    }
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// Get helper for header index mapping
function getHeaderIndexMap(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  headers.forEach((h, i) => {
    map[h] = i + 1; // 1-indexed
  });
  return map;
}

// Generic Sheet Reader converting row values into structured objects mapping headers
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0];
  const data = [];

  for (let r = 1; r < lastRow; r++) {
    const row = values[r];
    const item = {};
    for (let c = 0; c < lastColumn; c++) {
      item[headers[c]] = row[c];
    }
    data.push(item);
  }
  return data;
}

// Append Row dynamic column mapping
function appendRowByHeader(sheetName, item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  const headerMap = getHeaderIndexMap(sheet);
  const newRowIndex = sheet.getLastRow() + 1;
  const headers = Object.keys(headerMap);
  
  const rowValues = [];
  for (let i = 0; i < headers.length; i++) {
    rowValues.push('');
  }
  
  Object.keys(item).forEach(key => {
    const colIndex = headerMap[key];
    if (colIndex !== undefined) {
      rowValues[colIndex - 1] = item[key];
    }
  });
  
  sheet.getRange(newRowIndex, 1, 1, rowValues.length).setValues([rowValues]);
}

// Update Row dynamic column mapping
function updateRowByHeader(sheetName, keyColumnName, keyValue, updatedFields) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  
  const headerMap = getHeaderIndexMap(sheet);
  const keyColIndex = headerMap[keyColumnName];
  if (!keyColIndex) return false;
  
  const keyValues = sheet.getRange(2, keyColIndex, lastRow - 1, 1).getValues();
  let foundRowIndex = -1;
  for (let i = 0; i < keyValues.length; i++) {
    if (String(keyValues[i][0]) === String(keyValue)) {
      foundRowIndex = i + 2; // header offset + 1-indexed
      break;
    }
  }
  
  if (foundRowIndex === -1) return false;
  
  Object.keys(updatedFields).forEach(key => {
    const colIndex = headerMap[key];
    if (colIndex !== undefined) {
      sheet.getRange(foundRowIndex, colIndex).setValue(updatedFields[key]);
    }
  });
  
  return true;
}

// Format Sheets Values to standard types
function formatSheetValue(key, val) {
  if (val instanceof Date) {
    if (key.indexOf('date') > -1) {
      return val.toISOString().split('T')[0];
    }
    return val.toISOString();
  }
  if (key === 'is_archived' || key === 'active') {
    return val === true || String(val).toUpperCase() === 'TRUE';
  }
  if (val === '') return null;
  return val;
}

// ID Generator with lock safety
function getNextSequenceId(prefix, sheetName, keyColName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  let maxNum = 0;
  
  if (lastRow > 1) {
    const headerMap = getHeaderIndexMap(sheet);
    const colIndex = headerMap[keyColName];
    const values = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
    values.forEach(row => {
      const cellVal = String(row[0]);
      if (cellVal.indexOf(prefix) === 0) {
        const numPart = parseInt(cellVal.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
  }
  
  const nextNum = maxNum + 1;
  return prefix + String(nextNum).padStart(6, '0');
}

function generateNewTaskId() {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      return getNextSequenceId('TASK-', 'Tasks', 'task_id');
    } finally {
      lock.releaseLock();
    }
  } else {
    throw new Error("Lock timeout: Could not generate task ID");
  }
}

// Fixed actor placeholder until authentication is implemented
const CHANGED_BY = "SYSTEM";

// Normalize a sheet value for safe old-vs-new comparison
function normalizeVal(val, key) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string' && val.trim() === '') return '';
  if (val instanceof Date) {
    return key.indexOf('date') > -1 ? val.toISOString().split('T')[0] : val.toISOString();
  }
  return String(val);
}

// Append one or more history rows atomically with a LockService sequence
function appendHistoryRows(taskId, entries) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error("Lock timeout: Could not write history");
  }
  try {
    entries.forEach(function (entry) {
      const id = getNextSequenceId('HIST-', 'TaskHistory', 'history_id');
      const row = {
        history_id: id,
        task_id: taskId,
        action: entry.action,
        field_name: entry.fieldName || '',
        old_value: entry.oldValue != null ? String(entry.oldValue) : '',
        new_value: entry.newValue != null ? String(entry.newValue) : '',
        changed_by: CHANGED_BY,
        changed_at: new Date().toISOString()
      };
      appendRowByHeader("TaskHistory", row);
    });
  } finally {
    lock.releaseLock();
  }
}

// Actions Business Logic

function handleListTasks(e) {
  const includeArchived = e.parameter.includeArchived === 'true';
  const tasks = getSheetData("Tasks");
  const clients = getSheetData("Clients");
  const consultants = getSheetData("Consultants");
  const programmers = getSheetData("Programmers");

  const clientMap = {};
  clients.forEach(c => {
    clientMap[c.client_id] = { id: c.client_id, name: c.client_name };
  });

  const consultantMap = {};
  consultants.forEach(c => {
    consultantMap[c.consultant_id] = { id: c.consultant_id, name: c.consultant_name };
  });

  const programmerMap = {};
  programmers.forEach(p => {
    programmerMap[p.programmer_id] = { id: p.programmer_id, name: p.programmer_name };
  });

  const result = [];
  tasks.forEach(task => {
    const isArch = formatSheetValue('is_archived', task.is_archived);
    if (!includeArchived && isArch) return;
    
    result.push({
      taskId: task.task_id,
      type: task.type,
      screenReport: task.screen_report,
      request: task.request,
      status: task.status,
      sqlServer: task.sql_server || '',
      databaseName: task.database_name || '',
      targetDate: task.target_date ? formatSheetValue('target_date', task.target_date) : null,
      notes: task.notes || '',
      isArchived: isArch,
      createdAt: formatSheetValue('created_at', task.created_at),
      updatedAt: formatSheetValue('updated_at', task.updated_at),
      completedAt: task.status === 'Done' ? formatSheetValue('updated_at', task.updated_at) : null,
      consultant: consultantMap[task.consultant_id] || { id: task.consultant_id, name: task.consultant_id },
      client: clientMap[task.client_id] || { id: task.client_id, name: task.client_id },
      programmer: task.programmer_id ? (programmerMap[task.programmer_id] || { id: task.programmer_id, name: task.programmer_id }) : null
    });
  });

  return buildSuccessResponse(result);
}

function handleGetTask(e) {
  const taskId = e.parameter.taskId;
  if (!taskId) {
    return buildErrorResponse("BAD_REQUEST", "Missing taskId parameter");
  }

  const tasks = getSheetData("Tasks");
  const task = tasks.find(t => t.task_id === taskId);
  if (!task) {
    return buildErrorResponse("NOT_FOUND", "Task not found: " + taskId);
  }

  const clients = getSheetData("Clients");
  const consultants = getSheetData("Consultants");
  const programmers = getSheetData("Programmers");

  const clientMap = {};
  clients.forEach(c => {
    clientMap[c.client_id] = { id: c.client_id, name: c.client_name };
  });

  const consultantMap = {};
  consultants.forEach(c => {
    consultantMap[c.consultant_id] = { id: c.consultant_id, name: c.consultant_name };
  });

  const programmerMap = {};
  programmers.forEach(p => {
    programmerMap[p.programmer_id] = { id: p.programmer_id, name: p.programmer_name };
  });

  const taskRead = {
    taskId: task.task_id,
    type: task.type,
    screenReport: task.screen_report,
    request: task.request,
    status: task.status,
    sqlServer: task.sql_server || '',
    databaseName: task.database_name || '',
    targetDate: task.target_date ? formatSheetValue('target_date', task.target_date) : null,
    notes: task.notes || '',
    isArchived: formatSheetValue('is_archived', task.is_archived),
    createdAt: formatSheetValue('created_at', task.created_at),
    updatedAt: formatSheetValue('updated_at', task.updated_at),
    completedAt: task.status === 'Done' ? formatSheetValue('updated_at', task.updated_at) : null,
    consultant: consultantMap[task.consultant_id] || { id: task.consultant_id, name: task.consultant_id },
    client: clientMap[task.client_id] || { id: task.client_id, name: task.client_id },
    programmer: task.programmer_id ? (programmerMap[task.programmer_id] || { id: task.programmer_id, name: task.programmer_id }) : null
  };

  return buildSuccessResponse(taskRead);
}

function handleCreateTask(payload) {
  const consultantId = payload.consultantId;
  const clientId = payload.clientId;
  const type = payload.type;
  const screenReport = payload.screenReport;
  const request = payload.request;
  const status = payload.status;
  const programmerId = payload.programmerId || null;
  const sqlServer = payload.sqlServer || '';
  const databaseName = payload.databaseName || '';
  const targetDate = payload.targetDate || null;
  const notes = payload.notes || '';

  if (!consultantId || !clientId || !type || !screenReport || !request || !status) {
    return buildErrorResponse("VALIDATION_ERROR", "Missing required fields");
  }

  if (type !== "Bugs" && type !== "Improvements") {
    return buildErrorResponse("VALIDATION_ERROR", "Invalid task type");
  }

  if (status !== "Open" && status !== "Assign" && status !== "Done") {
    return buildErrorResponse("VALIDATION_ERROR", "Invalid status");
  }

  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return buildErrorResponse("VALIDATION_ERROR", "Target date must be in YYYY-MM-DD format");
  }

  const consultants = getSheetData("Consultants");
  const consultantRecord = consultants.find(c => c.consultant_id === consultantId);
  if (!consultantRecord) {
    return buildErrorResponse("VALIDATION_ERROR", "Consultant does not exist");
  }
  if (!formatSheetValue('active', consultantRecord.active)) {
    return buildErrorResponse("VALIDATION_ERROR", "Selected consultant is inactive");
  }

  const clients = getSheetData("Clients");
  const clientRecord = clients.find(c => c.client_id === clientId);
  if (!clientRecord) {
    return buildErrorResponse("VALIDATION_ERROR", "Client does not exist");
  }
  if (!formatSheetValue('active', clientRecord.active)) {
    return buildErrorResponse("VALIDATION_ERROR", "Selected client is inactive");
  }

  if (programmerId) {
    const programmers = getSheetData("Programmers");
    const programmerRecord = programmers.find(p => p.programmer_id === programmerId);
    if (!programmerRecord) {
      return buildErrorResponse("VALIDATION_ERROR", "Programmer does not exist");
    }
    if (!formatSheetValue('active', programmerRecord.active)) {
      return buildErrorResponse("VALIDATION_ERROR", "Selected programmer is inactive");
    }
  }

  let newTaskId;
  try {
    newTaskId = generateNewTaskId();
  } catch (err) {
    return buildErrorResponse("LOCK_TIMEOUT", err.message);
  }

  const nowStr = new Date().toISOString();

  const newTaskRow = {
    task_id: newTaskId,
    consultant_id: consultantId,
    type: type,
    client_id: clientId,
    screen_report: screenReport,
    request: request,
    status: status,
    programmer_id: programmerId,
    sql_server: sqlServer,
    database_name: databaseName,
    target_date: targetDate,
    notes: notes,
    is_archived: false,
    created_at: nowStr,
    updated_at: nowStr
  };

  appendRowByHeader("Tasks", newTaskRow);

  try {
    appendHistoryRows(newTaskId, [{
      action: "CREATE",
      fieldName: null,
      oldValue: null,
      newValue: "Task created"
    }]);
  } catch (histErr) {
    // Task row was written; history write failed. Surface as partial failure.
    return buildErrorResponse("SERVER_ERROR", "Task created but history logging failed: " + histErr.message);
  }

  return buildSuccessResponse({ taskId: newTaskId });
}

function handleUpdateTask(payload) {
  const taskId = payload.taskId;
  const updatedFields = payload.updatedFields;

  if (!taskId || !updatedFields) {
    return buildErrorResponse("BAD_REQUEST", "Missing taskId or updatedFields");
  }

  const tasks = getSheetData("Tasks");
  const task = tasks.find(t => t.task_id === taskId);
  if (!task) {
    return buildErrorResponse("NOT_FOUND", "Task not found: " + taskId);
  }

  const forbidden = ["taskId", "createdAt", "isArchived"];
  for (let i = 0; i < forbidden.length; i++) {
    if (updatedFields[forbidden[i]] !== undefined) {
      return buildErrorResponse("VALIDATION_ERROR", "Cannot rewrite immutable field: " + forbidden[i]);
    }
  }

  if (updatedFields.type && updatedFields.type !== "Bugs" && updatedFields.type !== "Improvements") {
    return buildErrorResponse("VALIDATION_ERROR", "Invalid task type");
  }
  if (updatedFields.status && updatedFields.status !== "Open" && updatedFields.status !== "Assign" && updatedFields.status !== "Done") {
    return buildErrorResponse("VALIDATION_ERROR", "Invalid status");
  }
  if (updatedFields.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(updatedFields.targetDate)) {
    return buildErrorResponse("VALIDATION_ERROR", "Target date must be in YYYY-MM-DD format");
  }

  if (updatedFields.consultantId) {
    const consultants = getSheetData("Consultants");
    const rec = consultants.find(c => c.consultant_id === updatedFields.consultantId);
    if (!rec) return buildErrorResponse("VALIDATION_ERROR", "Consultant does not exist");
  }
  if (updatedFields.clientId) {
    const clients = getSheetData("Clients");
    const rec = clients.find(c => c.client_id === updatedFields.clientId);
    if (!rec) return buildErrorResponse("VALIDATION_ERROR", "Client does not exist");
  }
  if (updatedFields.programmerId) {
    const programmers = getSheetData("Programmers");
    const rec = programmers.find(p => p.programmer_id === updatedFields.programmerId);
    if (!rec) return buildErrorResponse("VALIDATION_ERROR", "Programmer does not exist");
  }

  const fieldMapping = {
    consultantId: "consultant_id",
    type: "type",
    clientId: "client_id",
    screenReport: "screen_report",
    request: "request",
    status: "status",
    programmerId: "programmer_id",
    sqlServer: "sql_server",
    databaseName: "database_name",
    targetDate: "target_date",
    notes: "notes"
  };

  const nowStr = new Date().toISOString();
  const updateRow = {
    updated_at: nowStr
  };

  Object.keys(updatedFields).forEach(key => {
    const snakeKey = fieldMapping[key];
    if (snakeKey) {
      updateRow[snakeKey] = updatedFields[key];
    }
  });

  // Compare old vs new normalized values and build history entries
  const entries = [];
  Object.keys(fieldMapping).forEach(camelKey => {
    if (updatedFields[camelKey] === undefined) return;
    const snakeKey = fieldMapping[camelKey];
    const oldNorm = normalizeVal(task[snakeKey], snakeKey);
    const newNorm = normalizeVal(updateRow[snakeKey], snakeKey);
    if (oldNorm !== newNorm) {
      let action = "UPDATE";
      if (camelKey === "status" && updatedFields.status === "Done") {
        action = "COMPLETE";
      }
      entries.push({
        action: action,
        fieldName: snakeKey,
        oldValue: oldNorm === "" ? null : oldNorm,
        newValue: newNorm === "" ? null : newNorm
      });
    }
  });

  const ok = updateRowByHeader("Tasks", "task_id", taskId, updateRow);
  if (!ok) {
    return buildErrorResponse("SERVER_ERROR", "Failed to update row in sheet");
  }

  try {
    if (entries.length > 0) {
      appendHistoryRows(taskId, entries);
    }
  } catch (histErr) {
    return buildErrorResponse("SERVER_ERROR", "Task updated but history logging failed: " + histErr.message);
  }

  return buildSuccessResponse({ success: true });
}

function handleArchiveTask(payload) {
  const taskId = payload.taskId;
  if (!taskId) {
    return buildErrorResponse("BAD_REQUEST", "Missing taskId");
  }

  const tasks = getSheetData("Tasks");
  const task = tasks.find(t => t.task_id === taskId);
  if (!task) {
    return buildErrorResponse("NOT_FOUND", "Task not found: " + taskId);
  }

  const nowStr = new Date().toISOString();
  const alreadyArchived = formatSheetValue('is_archived', task.is_archived);

  const ok = updateRowByHeader("Tasks", "task_id", taskId, {
    is_archived: true,
    updated_at: nowStr
  });

  if (!ok) {
    return buildErrorResponse("SERVER_ERROR", "Failed to archive task in sheet");
  }

  // Idempotent: only log archive history if not already archived
  if (!alreadyArchived) {
    try {
      appendHistoryRows(taskId, [{
        action: "ARCHIVE",
        fieldName: "is_archived",
        oldValue: "FALSE",
        newValue: "TRUE"
      }]);
    } catch (histErr) {
      return buildErrorResponse("SERVER_ERROR", "Task archived but history logging failed: " + histErr.message);
    }
  }

  return buildSuccessResponse({ success: true });
}

function handleListClients(e) {
  const data = getSheetData("Clients");
  const result = data.map(item => ({
    id: item.client_id,
    name: item.client_name,
    active: formatSheetValue('active', item.active)
  }));
  return buildSuccessResponse(result);
}

function handleListConsultants(e) {
  const data = getSheetData("Consultants");
  const result = data.map(item => ({
    id: item.consultant_id,
    name: item.consultant_name,
    active: formatSheetValue('active', item.active)
  }));
  return buildSuccessResponse(result);
}

function handleListProgrammers(e) {
  const data = getSheetData("Programmers");
  const result = data.map(item => ({
    id: item.programmer_id,
    name: item.programmer_name,
    active: formatSheetValue('active', item.active)
  }));
  return buildSuccessResponse(result);
}

function handleGetTaskHistory(e) {
  const taskId = e.parameter.taskId;
  if (!taskId) {
    return buildErrorResponse("BAD_REQUEST", "Missing taskId parameter");
  }
  const data = getSheetData("TaskHistory");
  const filtered = data.filter(h => h.task_id === taskId);
  const result = filtered.map(item => ({
    id: item.history_id,
    taskId: item.task_id,
    action: item.action,
    fieldName: item.field_name || null,
    oldValue: item.old_value || null,
    newValue: item.new_value || null,
    changedBy: item.changed_by || 'SYSTEM',
    changedAt: formatSheetValue('changed_at', item.changed_at)
  }));
  result.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  return buildSuccessResponse(result);
}

function handleListRecentHistory(e) {
  const limit = e.parameter.limit ? parseInt(e.parameter.limit, 10) : 50;
  const data = getSheetData("TaskHistory");
  const result = data.map(item => ({
    id: item.history_id,
    taskId: item.task_id,
    action: item.action,
    fieldName: item.field_name || null,
    oldValue: item.old_value || null,
    newValue: item.new_value || null,
    changedBy: item.changed_by || 'SYSTEM',
    changedAt: formatSheetValue('changed_at', item.changed_at)
  }));
  // Newest first
  result.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  return buildSuccessResponse(result.slice(0, limit));
}

function handleGetTaskAttachments(e) {
  const taskId = e.parameter.taskId;
  if (!taskId) {
    return buildErrorResponse("BAD_REQUEST", "Missing taskId parameter");
  }
  const data = getSheetData("Attachments");
  const filtered = data.filter(a => a.task_id === taskId);
  const result = filtered.map(item => ({
    id: item.attachment_id,
    taskId: item.task_id,
    fileName: item.file_name,
    driveFileId: item.drive_file_id,
    fileUrl: buildAttachmentImageUrl(item.attachment_id),
    mimeType: item.mime_type,
    description: item.description || '',
    uploadedAt: formatSheetValue('uploaded_at', item.uploaded_at)
  }));
  return buildSuccessResponse(result);
}

// Serve an attachment image directly as binary bytes (used as <img src>).
// Looks up metadata by attachmentId, then reads bytes via DriveApp.
function handleViewAttachment(e) {
  const attachmentId = e.parameter.attachmentId;
  if (!attachmentId) {
    return buildErrorResponse("BAD_REQUEST", "Missing attachmentId parameter");
  }

  const data = getSheetData("Attachments");
  const meta = data.find(a => a.attachment_id === attachmentId);
  if (!meta) {
    return buildErrorResponse("NOT_FOUND", "Attachment not found: " + attachmentId);
  }

  const mimeType = meta.mime_type;
  if (!isValidMimeType(mimeType)) {
    return buildErrorResponse("INVALID_FILE_TYPE", "Unsupported attachment type");
  }

  if (!meta.drive_file_id) {
    return buildErrorResponse("NOT_FOUND", "Attachment has no Drive file");
  }

  let file;
  let blob;
  try {
    file = DriveApp.getFileById(meta.drive_file_id);
    blob = file.getBlob();
  } catch (err) {
    // Missing file, trashed file, or access failure: never expose stack traces.
    return buildErrorResponse("NOT_FOUND", "Attachment image is unavailable");
  }

  const output = ContentService.createBinaryTokenOutput(blob.getBytes());
  output.setHeader('Content-Type', mimeType);
  output.setHeader('X-Content-Type-Options', 'nosniff');
  return output;
}

// ============================================================
// Attachment Upload & Delete Implementation (Phase 4B)
// ============================================================

function getAttachmentsRootFolder() {
  const scriptProps = PropertiesService.getScriptProperties();
  const rootFolderId = scriptProps.getProperty('ATTACHMENTS_ROOT_FOLDER_ID');
  if (!rootFolderId) {
    throw new Error('Missing ATTACHMENTS_ROOT_FOLDER_ID in Script Properties');
  }
  const folder = DriveApp.getFolderById(rootFolderId);
  return folder;
}

function getOrCreateTaskFolder(rootFolder, taskId) {
  const existing = rootFolder.getFoldersByName(taskId);
  if (existing.hasNext()) {
    return existing.next();
  }
  return rootFolder.createFolder(taskId);
}

function getNextAttachmentId() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Lock timeout: Could not generate attachment ID');
  }
  try {
    return getNextSequenceId('ATT-', 'Attachments', 'attachment_id');
  } finally {
    lock.releaseLock();
  }
}

function sanitizeFileName(name) {
  if (!name) return 'file';
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

// Base URL of the deployed Web App, so fileUrl can be built without hardcoding
// deployment URLs in the spreadsheet. Fallback: WEB_APP_URL script property.
function getWebAppBaseUrl() {
  try {
    const url = ScriptApp.getService().getUrl();
    if (url) return url.replace(/\/$/, '');
  } catch (err) {
    // getUrl() is only available while executing as the deployed web app.
  }
  const prop = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  if (prop) return prop.replace(/\/$/, '');
  throw new Error('Cannot determine Web App URL. Set WEB_APP_URL in Script Properties.');
}

// Browser-renderable URL that serves the image through this Apps Script Web App,
// keyed by the stable attachmentId (never an arbitrary Drive file id).
function buildAttachmentImageUrl(attachmentId) {
  return getWebAppBaseUrl() + '?action=viewAttachment&attachmentId=' + encodeURIComponent(attachmentId);
}

function isValidMimeType(mimeType) {
  return mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/webp';
}

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

function handleUploadAttachment(payload) {
  const { taskId, fileName, mimeType, description, contentBase64 } = payload;

  // Basic payload validation
  if (!taskId || !fileName || !mimeType || !contentBase64) {
    return buildErrorResponse("BAD_REQUEST", "Missing required upload fields");
  }

  if (!isValidMimeType(mimeType)) {
    return buildErrorResponse("INVALID_FILE_TYPE", "Only PNG, JPEG, and WebP images are supported");
  }

  // Validate task exists
  const tasks = getSheetData("Tasks");
  const task = tasks.find(t => t.task_id === taskId);
  if (!task) {
    return buildErrorResponse("NOT_FOUND", "Task not found: " + taskId);
  }

  // Decode base64
  let fileBlob;
  try {
    const decoded = Utilities.base64Decode(contentBase64);
    if (decoded.length > MAX_ATTACHMENT_BYTES) {
      return buildErrorResponse("FILE_TOO_LARGE", "Image must be 5 MB or smaller");
    }
    fileBlob = Utilities.newBlob(decoded, mimeType, fileName);
  } catch (err) {
    return buildErrorResponse("INVALID_FILE", "Invalid base64 content");
  }

  // Generate IDs and folder
  let attachmentId;
  try {
    attachmentId = getNextAttachmentId();
  } catch (err) {
    return buildErrorResponse("LOCK_TIMEOUT", err.message);
  }

  // Prepare Drive storage
  let taskFolder;
  let rootFolder;
  try {
    rootFolder = getAttachmentsRootFolder();
    taskFolder = getOrCreateTaskFolder(rootFolder, taskId);
  } catch (err) {
    return buildErrorResponse("CONFIGURATION_ERROR", err.message);
  }

  // Generate safe Drive file name
  const safeName = `${taskId}_${attachmentId}_${sanitizeFileName(fileName)}`;
  fileBlob.setName(safeName);

  let createdFile;
  try {
    createdFile = taskFolder.createFile(fileBlob);
  } catch (err) {
    return buildErrorResponse("DRIVE_ERROR", "Failed to create file in Drive: " + err.message);
  }

  // No public Drive sharing is required: images are served through this Web App
  // (executing as owner), which reads the file via DriveApp.getFileById().

  // Prepare metadata row
  const nowStr = new Date().toISOString();
  const driveFileId = createdFile.getId();
  const driveUrl = buildAttachmentImageUrl(attachmentId);

  const metaRow = {
    attachment_id: attachmentId,
    task_id: taskId,
    file_name: fileName, // original user filename
    drive_file_id: driveFileId,
    drive_url: driveUrl,
    mime_type: mimeType,
    description: description || '',
    uploaded_at: nowStr
  };

  // Append to Attachments sheet
  let metadataOk = false;
  try {
    appendRowByHeader("Attachments", metaRow);
    metadataOk = true;
  } catch (sheetErr) {
    // Attempt cleanup of orphaned Drive file
    try { createdFile.setTrashed(true); } catch (_) {}
    return buildErrorResponse("SERVER_ERROR", "File uploaded but metadata write failed: " + sheetErr.message);
  }

  return buildSuccessResponse({
    attachmentId: attachmentId,
    fileUrl: driveUrl
  });
}

function handleDeleteAttachment(payload) {
  const attachmentId = payload.attachmentId;
  if (!attachmentId) {
    return buildErrorResponse("BAD_REQUEST", "Missing attachmentId");
  }

  const data = getSheetData("Attachments");
  const idx = data.findIndex(a => a.attachment_id === attachmentId);
  if (idx === -1) {
    return buildErrorResponse("NOT_FOUND", "Attachment not found: " + attachmentId);
  }
  const meta = data[idx];

  // Trash Drive file
  let driveDeleted = false;
  if (meta.drive_file_id) {
    try {
      const file = DriveApp.getFileById(meta.drive_file_id);
      file.setTrashed(true);
      driveDeleted = true;
    } catch (err) {
      // File may already be missing; log and continue
      console.warn('Drive file not found or already trashed:', meta.drive_file_id);
    }
  }

  // Remove metadata row directly via row deletion
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Attachments");
  if (!sheet) {
    return buildErrorResponse("CONFIGURATION_ERROR", "Missing Attachments sheet");
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return buildErrorResponse("NOT_FOUND", "Attachment not found: " + attachmentId);
  }
  const headerMap = getHeaderIndexMap(sheet);
  const keyCol = headerMap['attachment_id'];
  const keyValues = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();
  let rowToDelete = -1;
  for (let i = 0; i < keyValues.length; i++) {
    if (String(keyValues[i][0]) === String(attachmentId)) {
      rowToDelete = i + 2;
      break;
    }
  }
  if (rowToDelete === -1) {
    return buildErrorResponse("NOT_FOUND", "Attachment not found: " + attachmentId);
  }

  sheet.deleteRow(rowToDelete);

  // If Drive deletion failed but we removed metadata, still return success
  // with a warning; the Drive file may be orphaned but we handled gracefully
  return buildSuccessResponse({ success: true });
}
