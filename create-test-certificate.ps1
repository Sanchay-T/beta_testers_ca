# Create Self-Signed Test Certificate for CypherEdge
# Run this script in an elevated PowerShell window

Write-Host "Creating self-signed test certificate..." -ForegroundColor Green

# Generate certificate in user store
$cert = New-SelfSignedCertificate `
         -Type CodeSigning `
         -FriendlyName "CypherEdge TEST" `
         -Subject "CN=CypherEdge TEST" `
         -CertStoreLocation "Cert:\CurrentUser\My"

Write-Host "Certificate created successfully!" -ForegroundColor Green
Write-Host "Certificate Thumbprint: $($cert.Thumbprint)" -ForegroundColor Yellow

# Export to PFX with password "testpass"
$password = ConvertTo-SecureString -String "testpass" -AsPlainText -Force
$pfxPath = "$env:USERPROFILE\CypherEdgeTest.pfx"

Export-PfxCertificate -Cert $cert `
                      -FilePath $pfxPath `
                      -Password $password

Write-Host "`nCertificate exported to: $pfxPath" -ForegroundColor Green
Write-Host "Password: testpass" -ForegroundColor Yellow
Write-Host "`nYou can now use this certificate for test builds!" -ForegroundColor Cyan 