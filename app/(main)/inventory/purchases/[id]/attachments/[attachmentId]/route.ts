import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  const { id, attachmentId } = await context.params;
  const attachment = await prisma.purchaseReceiptAttachment.findFirst({ where: { id: attachmentId, purchaseReceiptId: id } });
  if (!attachment) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(Buffer.from(attachment.data), { headers: {
    'Content-Type': attachment.mimeType,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
