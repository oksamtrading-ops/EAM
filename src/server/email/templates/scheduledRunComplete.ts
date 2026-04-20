import "server-only";

/**
 * Email body for "your scheduled agent run just finished." Kept as a
 * plain function (no MJML/React-Email) — a Resend-ready HTML string
 * and a text fallback.
 */

const APP_BASE_URL =
  process.env.APP_BASE_URL ?? "https://eampoc.vercel.app";

type Input = {
  taskName: string;
  workspaceLabel: string;
  runId: string | null;
  status: "SUCCEEDED" | "FAILED" | "RUNNING" | "CANCELLED";
  excerpt: string | null;
  errorMessage: string | null;
};

export function renderScheduledRunCompleteEmail(input: Input): {
  subject: string;
  html: string;
  text: string;
} {
  const statusLabel =
    input.status === "SUCCEEDED"
      ? "Succeeded"
      : input.status === "FAILED"
        ? "Failed"
        : input.status === "CANCELLED"
          ? "Cancelled"
          : "Running";
  const statusColor =
    input.status === "SUCCEEDED"
      ? "#059669" // emerald-600
      : input.status === "FAILED"
        ? "#dc2626" // red-600
        : "#d97706"; // amber-600

  const runLink = input.runId
    ? `${APP_BASE_URL}/agents/runs/${input.runId}`
    : null;
  const scheduleLink = `${APP_BASE_URL}/agents/scheduled`;

  const subject = `[${input.workspaceLabel}] ${input.taskName} — ${statusLabel}`;

  const excerptHtml = input.excerpt
    ? `<div style="margin:16px 0;padding:12px 14px;background:#f8fafc;border-left:3px solid #7c3aed;border-radius:6px;font-size:13px;line-height:1.5;color:#334155;white-space:pre-wrap;">${escapeHtml(
        input.excerpt
      )}</div>`
    : "";

  const errorHtml = input.errorMessage
    ? `<div style="margin:16px 0;padding:12px 14px;background:#fef2f2;border-left:3px solid #dc2626;border-radius:6px;font-size:13px;line-height:1.5;color:#7f1d1d;">${escapeHtml(
        input.errorMessage
      )}</div>`
    : "";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;background:linear-gradient(to right, rgba(124,58,237,0.08), transparent);">
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#7c3aed;">
        Scheduled agent run
      </div>
      <div style="margin-top:4px;font-size:18px;font-weight:700;color:#0f172a;">
        ${escapeHtml(input.taskName)}
      </div>
      <div style="margin-top:4px;font-size:12px;color:#64748b;">
        ${escapeHtml(input.workspaceLabel)}
      </div>
    </div>
    <div style="padding:20px 24px;">
      <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:${statusColor}15;color:${statusColor};font-size:11px;font-weight:600;">
        ${statusLabel}
      </div>
      ${excerptHtml}
      ${errorHtml}
      <div style="margin-top:20px;font-size:13px;color:#475569;">
        ${
          runLink
            ? `<a href="${runLink}" style="color:#7c3aed;text-decoration:none;font-weight:600;">Open full run trace →</a>`
            : ""
        }
      </div>
      <div style="margin-top:8px;font-size:11px;color:#94a3b8;">
        <a href="${scheduleLink}" style="color:#94a3b8;">Manage scheduled tasks</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  const textLines = [
    `${input.taskName} — ${statusLabel}`,
    `Workspace: ${input.workspaceLabel}`,
    "",
  ];
  if (input.excerpt) {
    textLines.push(input.excerpt, "");
  }
  if (input.errorMessage) {
    textLines.push(`Error: ${input.errorMessage}`, "");
  }
  if (runLink) {
    textLines.push(`Run trace: ${runLink}`);
  }
  textLines.push(`Manage tasks: ${scheduleLink}`);

  return { subject, html, text: textLines.join("\n") };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
