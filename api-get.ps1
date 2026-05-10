param(
  [Parameter(Mandatory = $true)]
  [string]$Url
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$headers = @{
  Authorization = "Bearer $env:OPENAI_API_KEY"
}

try {
  $response = Invoke-RestMethod `
    -Uri $Url `
    -Method Get `
    -Headers $headers `
    -TimeoutSec 120

  $response | ConvertTo-Json -Depth 100 -Compress
} catch {
  if ($_.Exception.Response) {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    if ($body) {
      [Console]::Error.WriteLine($body)
    } else {
      [Console]::Error.WriteLine($_.Exception.Message)
    }
  } else {
    [Console]::Error.WriteLine($_.Exception.Message)
  }
  exit 1
}
