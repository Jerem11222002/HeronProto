# Configuration
$baseUrl = "http://localhost:3000/api"
$credentials = @{
    email = "cheesecake0101"
    password = "crossfire1"
}

# Colors for better visibility
$colors = @{
    success = "Green"
    warning = "Yellow"
    error = "Red"
    info = "Cyan"
}

# Helper functions
function Format-Score {
    param($score)
    return [math]::Round($score * 100, 2)
}

function Write-ColorOutput {
    param($message, $color)
    Write-Host $message -ForegroundColor $color
}

# Test scenarios
$scenarios = @(
    @{
        name = "Events Only"
        params = "filterType=events`&sampleSize=5"
    },
    @{
        name = "Upcoming Events"
        params = "filterType=events`&status=upcoming`&sampleSize=5"
    },
    @{
        name = "Organization Events"
        params = "filterType=events`&organization=true`&sampleSize=5"
    }
)

# Verify server is running
try {
    $null = Invoke-RestMethod -Uri $baseUrl -Method Head
    Write-ColorOutput "✅ Server is running" $colors.success
}
catch {
    Write-ColorOutput "❌ Server is not running. Please start the server first." $colors.error
    exit 1
}

# Get auth token
Write-ColorOutput "`n🔐 Getting authentication token..." $colors.info
try {
    $loginResponse = Invoke-RestMethod `
        -Uri "$baseUrl/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body ($credentials | ConvertTo-Json)

    $token = $loginResponse.token
    Write-ColorOutput "✅ Authentication successful!" $colors.success
}
catch {
    Write-ColorOutput "❌ Authentication failed: $_" $colors.error
    exit 1
}

# Run tests for each scenario
foreach ($scenario in $scenarios) {
    Write-ColorOutput "`n📊 Testing: $($scenario.name)" $colors.info
    Write-ColorOutput "----------------------------------------" $colors.info

    try {
        $results = Invoke-RestMethod `
            -Uri "$baseUrl/posts/recommendations/test?$($scenario.params)" `
            -Method Get `
            -Headers @{
                "Authorization" = "Bearer $token"
            }

        if ($null -eq $results) {
            Write-ColorOutput "⚠️ No results returned" $colors.warning
            continue
        }

        # Display user context
        Write-ColorOutput "`n👤 User Profile:" $colors.info
        Write-Host "   Interests: $($results.userProfile.interestsCount)"
        Write-Host "   Top Interests: $($results.userProfile.topInterests -join ', ')"

        # Display top recommendations
        Write-ColorOutput "`n🎯 Top Recommendations:" $colors.success
        $results.results | Sort-Object { $_.scores.final } -Descending | 
            Select-Object -First 3 | ForEach-Object {
                Write-Host "`n   📌 $($_.title)"
                Write-Host "      Type: $($_.type)"
                Write-Host "      Final Score: $(Format-Score $_.scores.final)%"
                Write-Host "      Base Score: $(Format-Score $_.scores.base)%"
                Write-Host "      Recency: $(Format-Score $_.scores.recency)%"
                Write-Host "      Interest Match: $(Format-Score $_.scores.interest)%"
                Write-Host "      Organization: $($_.metadata.organization)"
                Write-Host "      Status: $($_.metadata.status)"
                Write-Host "      Matched Interests: $($_.metadata.matchedInterests -join ', ')"
            }

        # Display statistics
        Write-ColorOutput "`n📈 Statistics:" $colors.info
        Write-Host "   Average Score: $(Format-Score $results.stats.averageScore)%"
        Write-Host "   Score Distribution:"
        Write-Host "   - High (>70%): $($results.stats.scoreDistribution.high)"
        Write-Host "   - Medium (40-70%): $($results.stats.scoreDistribution.medium)"
        Write-Host "   - Low (<40%): $($results.stats.scoreDistribution.low)"
    }
    catch {
        Write-ColorOutput "❌ Error testing scenario: $_" $colors.error
        Write-ColorOutput "URI: $baseUrl/posts/recommendations/test?$($scenario.params)" $colors.info
    }
}