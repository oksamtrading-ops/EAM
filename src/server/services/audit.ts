// Lightweight audit logger — fire-and-forget, never blocks main operation

type AuditContext = {
  db: any;
  workspaceId: string;
  dbUserId?: string;     // DB User.id — used as the FK for AuditLog.userId
  userId?: string | null; // Clerk user ID — NOT a DB FK
};

type AuditPayload = {
  action: "CREATE" | "UPDATE" | "DELETE" | "IMPORT" | "ASSESS";
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export function auditLog(ctx: AuditContext, payload: AuditPayload): void {
  // Fire-and-forget — never throw, never await
  ctx.db.auditLog
    .create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.dbUserId ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        before: payload.before ?? undefined,
        after: payload.after ?? undefined,
      },
    })
    .catch((err: unknown) =>
      console.error("[AuditLog] Failed to write:", err)
    );
}
