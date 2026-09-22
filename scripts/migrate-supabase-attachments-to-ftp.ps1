param(
  [int]$Limit = 0
)

$ErrorActionPreference = 'Stop'

function Read-EnvironmentFile([string]$Path) {
  $result = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $result[$Matches[1]] = $Matches[2].Trim().Trim('"')
    }
  }
  return $result
}

function Require-Value([hashtable]$Values, [string]$Key) {
  if (-not $Values.ContainsKey($Key) -or -not $Values[$Key]) { throw "Missing $Key in .env.local." }
  return $Values[$Key]
}

function New-FtpRequest([Uri]$Uri, [System.Net.NetworkCredential]$Credential, [string]$Method) {
  $request = [System.Net.FtpWebRequest]::Create($Uri)
  $request.Method = $Method
  $request.Credentials = $Credential
  $request.UsePassive = $true
  $request.EnableSsl = $false
  $request.ReadWriteTimeout = 60000
  $request.Timeout = 60000
  return $request
}

function Get-FtpSize([Uri]$Uri, [System.Net.NetworkCredential]$Credential) {
  try {
    $response = (New-FtpRequest $Uri $Credential ([System.Net.WebRequestMethods+Ftp]::GetFileSize)).GetResponse()
    try { return [int64]$response.ContentLength } finally { $response.Dispose() }
  } catch [System.Net.WebException] {
    if ($_.Exception.Response) { $_.Exception.Response.Dispose() }
    return $null
  }
}

function Ensure-FtpDirectory([Uri]$Uri, [System.Net.NetworkCredential]$Credential) {
  try {
    $response = (New-FtpRequest $Uri $Credential ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)).GetResponse()
    $response.Dispose()
  } catch [System.Net.WebException] {
    # FTP returns 550 when the directory already exists; upload verifies access next.
    if ($_.Exception.Response) { $_.Exception.Response.Dispose() }
  }
}

$values = Read-EnvironmentFile (Join-Path $PSScriptRoot '..\.env.local')
$sourceUrl = (Require-Value $values 'SOURCE_SUPABASE_URL').TrimEnd('/')
$sourceKey = Require-Value $values 'SOURCE_SUPABASE_SERVICE_ROLE_KEY'
$ftpHost = Require-Value $values 'FTP_HOST'
$ftpPort = [int](Require-Value $values 'FTP_PORT')
$ftpRoot = (Require-Value $values 'FTP_ROOT_DIR').Trim('/')
$ftpCredential = [System.Net.NetworkCredential]::new((Require-Value $values 'FTP_USER'), (Require-Value $values 'FTP_PASSWORD'))

$apiUrl = "$sourceUrl/rest/v1/attachments?select=attachment_id,task_id,storage_key&order=attachment_id.asc&limit=1000"
$headers = @{ apikey = $sourceKey; Authorization = "Bearer $sourceKey" }
$attachments = Invoke-RestMethod -Uri $apiUrl -Headers $headers -Method Get
if ($Limit -gt 0) { $attachments = $attachments | Select-Object -First $Limit }
$attachments = @($attachments)

$http = [System.Net.Http.HttpClient]::new()
$http.DefaultRequestHeaders.TryAddWithoutValidation('apikey', $sourceKey) | Out-Null
$http.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $sourceKey)

$uploaded = 0
$skipped = 0
try {
  for ($index = 0; $index -lt $attachments.Count; $index++) {
    $attachment = $attachments[$index]
    $taskId = [string]$attachment.task_id
    $storageKey = [string]$attachment.storage_key
    if ($taskId -match '[\\/\r\n]' -or -not $storageKey.StartsWith("$taskId/")) {
      throw "Unsafe storage key for $($attachment.attachment_id)."
    }
    $fileName = $storageKey.Substring($taskId.Length + 1)
    if (-not $fileName -or $fileName -match '[\\/\r\n]') { throw "Unsafe filename for $($attachment.attachment_id)." }

    $taskFolder = [Uri]("ftp://${ftpHost}:${ftpPort}/$ftpRoot/$taskId/")
    $ftpFile = [Uri]("ftp://${ftpHost}:${ftpPort}/$ftpRoot/$taskId/$fileName")
    Ensure-FtpDirectory $taskFolder $ftpCredential

    $encodedKey = (($storageKey -split '/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
    $sourceFile = "$sourceUrl/storage/v1/object/authenticated/attachments/$encodedKey"
    $bytes = $http.GetByteArrayAsync($sourceFile).GetAwaiter().GetResult()
    $existingSize = Get-FtpSize $ftpFile $ftpCredential

    if ($existingSize -eq $bytes.Length) {
      $skipped += 1
      Write-Output "[$($index + 1)/$($attachments.Count)] $($attachment.attachment_id) skipped ($($bytes.Length) bytes)"
      continue
    }

    $upload = New-FtpRequest $ftpFile $ftpCredential ([System.Net.WebRequestMethods+Ftp]::UploadFile)
    $upload.ContentLength = $bytes.Length
    $stream = $upload.GetRequestStream()
    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    $response = $upload.GetResponse()
    $response.Dispose()

    $verifiedSize = Get-FtpSize $ftpFile $ftpCredential
    if ($verifiedSize -ne $bytes.Length) { throw "Size verification failed for $($attachment.attachment_id)." }
    $uploaded += 1
    Write-Output "[$($index + 1)/$($attachments.Count)] $($attachment.attachment_id) uploaded ($($bytes.Length) bytes)"
  }
} finally {
  $http.Dispose()
}

Write-Output "MIGRATION=SUCCESS total=$($attachments.Count) uploaded=$uploaded skipped=$skipped sourcePreserved=true"
