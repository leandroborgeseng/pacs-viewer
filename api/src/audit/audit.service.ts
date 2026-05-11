import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuditInput = {
  userId?: string;
  action: string;
  resource?: string;
  ip?: string;
  metadata?: Prisma.InputJsonValue;
};

export type AuditLogRowView = {
  id: string;
  createdAt: string;
  action: string;
  resource: string | null;
  ip: string | null;
  metadata: unknown;
  userId: string | null;
  user: { id: string; email: string; name: string } | null;
};

export type AuditLogPageView = {
  items: AuditLogRowView[];
  total: number;
  page: number;
  pageSize: number;
};

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditInput) {
    await this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        ip: input.ip,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listLogs(q: {
    page: number;
    pageSize: number;
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
  }): Promise<AuditLogPageView> {
    const page = Math.max(1, q.page);
    const pageSize = Math.min(100, Math.max(1, q.pageSize));
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};

    if (q.userId) {
      where.userId = q.userId;
    }
    if (q.action?.length) {
      where.action = { contains: q.action, mode: 'insensitive' };
    }

    const createdAt: Prisma.DateTimeFilter = {};
    if (q.from?.length) {
      const d =
        q.from.length <= 10 && /^\d{4}-\d{2}-\d{2}$/.test(q.from)
          ? new Date(`${q.from}T00:00:00.000Z`)
          : new Date(q.from);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (q.to?.length) {
      const d =
        q.to.length <= 10 && /^\d{4}-\d{2}-\d{2}$/.test(q.to)
          ? new Date(`${q.to}T23:59:59.999Z`)
          : new Date(q.to);
      if (!Number.isNaN(d.getTime())) createdAt.lte = d;
    }
    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const rows: AuditLogRowView[] = items.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      action: row.action,
      resource: row.resource,
      ip: row.ip,
      metadata: row.metadata,
      userId: row.userId,
      user: row.user,
    }));

    return { items: rows, total, page, pageSize };
  }
}

