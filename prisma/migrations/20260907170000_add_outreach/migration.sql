-- CreateTable
CREATE TABLE "outreach_contacts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "firstMessageId" TEXT,
    "firstSentAt" TIMESTAMP(3),
    "followUpDueAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "replyMessageId" TEXT,
    "replyFolderId" TEXT,
    "replySummary" TEXT,
    "stopReason" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_messages" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reservedDay" TEXT NOT NULL,
    "zohoMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outreach_contacts_key_key" ON "outreach_contacts"("key");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_contacts_domain_key" ON "outreach_contacts"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_contacts_email_key" ON "outreach_contacts"("email");

-- CreateIndex
CREATE INDEX "outreach_contacts_status_checkedAt_idx" ON "outreach_contacts"("status", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_messages_zohoMessageId_key" ON "outreach_messages"("zohoMessageId");

-- CreateIndex
CREATE INDEX "outreach_messages_reservedDay_sequence_status_idx" ON "outreach_messages"("reservedDay", "sequence", "status");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_messages_contactId_sequence_key" ON "outreach_messages"("contactId", "sequence");

-- AddForeignKey
ALTER TABLE "outreach_messages" ADD CONSTRAINT "outreach_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "outreach_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No anonymous/client-side access through Supabase REST. The server DB role owns these tables.
ALTER TABLE "outreach_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outreach_messages" ENABLE ROW LEVEL SECURITY;
