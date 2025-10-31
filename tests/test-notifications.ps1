# First, get your token from browser console:
# Run this in browser console: console.log(localStorage.getItem('token'))
Write-Host "Enter your auth token:" -ForegroundColor Yellow
$token = Read-Host

# API endpoints
$baseUrl = "http://localhost:5000/api/notifications"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Helper function to make requests
function Invoke-NotificationTest {
    param (
        [string]$TestName,
        [string]$Endpoint,
        [string]$Method = "GET"
    )
    
    Write-Host "`n=== Testing: $TestName ===" -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl$Endpoint" `
            -Method $Method `
            -Headers $headers

        Write-Host "Success!" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 5)
        return $response
    } catch {
        Write-Host "Error Details:" -ForegroundColor Red
        
        # Get response body for more details
        $rawResponse = $_.ErrorDetails.Message
        if ($rawResponse) {
            try {
                $errorObj = $rawResponse | ConvertFrom-Json
                Write-Host "Error Response:" -ForegroundColor Red
                Write-Host ($errorObj | ConvertTo-Json)
            } catch {
                Write-Host "Raw Error: $rawResponse"
            }
        }

        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
        Write-Host "Status Description: $($_.Exception.Response.StatusDescription)"
        
        # Read response stream for more details
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
        
        return $null
    }
}

# Run tests
Write-Host "`nStarting notification tests..." -ForegroundColor Yellow

# 1. Create test notification
$testNotif = Invoke-NotificationTest -TestName "Create Test Notification" -Endpoint "/test-notification" -Method "POST"

# 2. Get debug info
Invoke-NotificationTest -TestName "Debug Information" -Endpoint "/debug"

# 3. Get notification status
Invoke-NotificationTest -TestName "Notification Status" -Endpoint "/status"

# 4. Mark notification as read (if created successfully)
if ($testNotif -and $testNotif.notification._id) {
    Invoke-NotificationTest -TestName "Mark as Read" -Endpoint "/$($testNotif.notification._id)/read" -Method "POST"
}

Write-Host "`nTests completed!" -ForegroundColor Green