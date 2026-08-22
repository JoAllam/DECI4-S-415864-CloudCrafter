const express = require("express");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const LOCALSTACK_ENDPOINT = process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_ENDPOINT || "http://localhost:4566";
const RECEIPT_BUCKET = process.env.CLOUDCRAFTER_RECEIPT_BUCKET || "cloudcrafter-receipts";
const NOTIFICATION_LAMBDA = process.env.CLOUDCRAFTER_NOTIFICATION_LAMBDA || "cloudcrafter-notify";

const awsCredentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
};

const s3Client = new S3Client({
  region: AWS_REGION,
  endpoint: LOCALSTACK_ENDPOINT,
  forcePathStyle: true,
  credentials: awsCredentials
});

const lambdaClient = new LambdaClient({
  region: AWS_REGION,
  endpoint: LOCALSTACK_ENDPOINT,
  credentials: awsCredentials
});

// Demo ticket store — in-memory, intentionally simple for the capstone starter.
let TICKETS = [];
let nextId = 1;

async function uploadReceiptToS3(ticket) {
  const key = `receipts/${ticket.receiptId}.json`;
  const body = JSON.stringify({
    ticket,
    bucket: RECEIPT_BUCKET,
    objectKey: key
  });

  await s3Client.send(new PutObjectCommand({
    Bucket: RECEIPT_BUCKET,
    Key: key,
    Body: Buffer.from(body),
    ContentType: "application/json"
  }));

  return { bucket: RECEIPT_BUCKET, key };
}

async function invokeNotificationLambda(ticket, s3Receipt) {
  const payload = {
    ticketId: ticket.id,
    userId: ticket.userId,
    message: `Ticket ${ticket.id} created. Receipt stored in ${s3Receipt.bucket}/${s3Receipt.key}`,
    ticket,
    receiptKey: s3Receipt.key,
    receiptBucket: s3Receipt.bucket
  };

  const response = await lambdaClient.send(new InvokeCommand({
    FunctionName: NOTIFICATION_LAMBDA,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify({ body: payload }))
  }));

  const responseBody = response.Payload ? Buffer.from(response.Payload).toString("utf8") : "{}";
  return {
    statusCode: response.StatusCode || 200,
    payload: JSON.parse(responseBody || "{}")
  };
}

app.get("/health", (_req, res) => res.json({ status: "ok", service: "tickets" }));

app.get("/tickets", (_req, res) => res.json(TICKETS));

// Books a ticket for an event and returns a receipt.
// The receipt payload is uploaded to S3 and then processed by a LocalStack Lambda.
app.post("/tickets", async (req, res) => {
  const { eventId, userId } = req.body || {};
  if (!eventId || !userId) {
    return res.status(400).json({ error: "eventId and userId are required" });
  }

  const ticket = {
    id: nextId++,
    eventId,
    userId,
    issuedAt: new Date().toISOString(),
    receiptId: `receipt-${Date.now()}`
  };

  TICKETS.push(ticket);

  try {
    const receipt = await uploadReceiptToS3(ticket);
    const lambdaResult = await invokeNotificationLambda(ticket, receipt);

    return res.status(201).json({
      ...ticket,
      receipt,
      lambda: lambdaResult
    });
  } catch (error) {
    console.error("LocalStack integration failed:", error.message);
    return res.status(201).json({
      ...ticket,
      warning: "Ticket created locally, but LocalStack integration is currently unavailable.",
      error: error.message
    });
  }
});

app.listen(PORT, () => console.log(`Tickets service listening on port ${PORT}`));
