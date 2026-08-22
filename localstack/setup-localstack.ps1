$ErrorActionPreference = 'Stop'

$endpoint = 'http://localhost:4566'
$bucketName = 'cloudcrafter-receipts'
$functionName = 'cloudcrafter-notify'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$lambdaSourceDir = Join-Path $scriptDir 'lambda'
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) 'cloudcrafter-lambda-package'
$zipPath = Join-Path $scriptDir 'lambda-notify.zip'

$env:AWS_ACCESS_KEY_ID = 'test'
$env:AWS_SECRET_ACCESS_KEY = 'test'
$env:AWS_DEFAULT_REGION = 'us-east-1'

Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Copy-Item (Join-Path $lambdaSourceDir 'notify.js') (Join-Path $tempDir 'index.js') -Force

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $zipPath -Force

aws --endpoint-url $endpoint s3api head-bucket --bucket $bucketName *> $null
if ($LASTEXITCODE -ne 0) {
  aws --endpoint-url $endpoint s3 mb s3://$bucketName --region us-east-1
}

aws --endpoint-url $endpoint lambda get-function --function-name $functionName *> $null
if ($LASTEXITCODE -ne 0) {
  aws --endpoint-url $endpoint lambda create-function `
    --function-name $functionName `
    --runtime nodejs18.x `
    --handler index.handler `
    --role arn:aws:iam::000000000000:role/service-role/localstack `
    --zip-file "fileb://$zipPath" `
    --environment "Variables={NOTIFICATION_ENDPOINT=http://host.docker.internal:3004/notify}"
}

Write-Host "LocalStack bootstrap complete. Bucket: $bucketName | Lambda: $functionName"
