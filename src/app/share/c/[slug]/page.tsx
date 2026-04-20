import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { renderMarkdown } from "@/lib/utils/markdown";
import { Sparkles, LogIn, Lock } from "lucide-react";
import {
  verifyShareCookie,
  shareCookieName,
} from "@/server/share/accessControl";
import { PasscodeForm } from "./_components/PasscodeForm";

export const dynamic = "force-dynamic";

type ToolCallSnapshot = {
  id: string;
  name: string;
  input?: unknown;
  ok?: boolean;
  output?: unknown;
};

export default async function SharedConversationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const share = await db.agentConversationShare.findUnique({
    where: { slug },
    include: {
      conversation: {
        include: {
          workspace: {
          select: {
            name: true,
            clientName: true,
            logoUrl: true,
            brandColor: true,
          },
        },
          messages: { orderBy: { ordinal: "asc" } },
        },
      },
    },
  });

  if (!share || share.revoked) notFound();
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return (
      <ShareLayout
        title="Link expired"
        subtitle={null}
        brandLogoUrl={null}
        brandColor={null}
        workspaceLabel={null}
      >
        <p className="text-sm text-muted-foreground text-center py-12">
          This shared transcript has expired. Ask the original author for a
          fresh link.
        </p>
      </ShareLayout>
    );
  }

  const workspaceLabel =
    share.conversation.workspace.clientName?.trim() ||
    share.conversation.workspace.name;
  const title = share.title ?? share.conversation.title;
  const brandLogoUrl = share.conversation.workspace.logoUrl ?? null;
  const brandColor = share.conversation.workspace.brandColor ?? null;

  // Access control gates. Each renders its own ShareLayout so the
  // gated pages still surface client branding / eyebrow / footer.
  if (share.protectionMode === "SIGNED_IN") {
    const { userId } = await auth();
    if (!userId) {
      return (
        <ShareLayout
          title={title}
          subtitle={`${workspaceLabel} · Sign-in required`}
          brandLogoUrl={brandLogoUrl}
          brandColor={brandColor}
          workspaceLabel={workspaceLabel}
        >
          <div className="max-w-md mx-auto text-center py-12 space-y-4">
            <div className="h-12 w-12 rounded-xl bg-violet-100 mx-auto flex items-center justify-center">
              <LogIn className="h-5 w-5 text-violet-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Sign in to view this transcript
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The owner restricted this link to authenticated users.
              </p>
            </div>
            <Link
              href={`/sign-in?redirect_url=/share/c/${slug}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Link>
          </div>
        </ShareLayout>
      );
    }
  }

  if (share.protectionMode === "PASSCODE") {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(shareCookieName(slug))?.value;
    if (!verifyShareCookie(slug, cookieVal)) {
      return (
        <ShareLayout
          title={title}
          subtitle={`${workspaceLabel} · Passcode required`}
          brandLogoUrl={brandLogoUrl}
          brandColor={brandColor}
          workspaceLabel={workspaceLabel}
        >
          <div className="max-w-sm mx-auto text-center py-12 space-y-4">
            <div className="h-12 w-12 rounded-xl bg-amber-100 mx-auto flex items-center justify-center">
              <Lock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Enter the passcode to view
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The owner shared a short code separately — ask them if you
                don&apos;t have it.
              </p>
            </div>
            <PasscodeForm slug={slug} />
          </div>
        </ShareLayout>
      );
    }
  }

  return (
    <ShareLayout
      title={title}
      subtitle={`${workspaceLabel} · Shared ${share.createdAt.toLocaleDateString()}`}
      brandLogoUrl={brandLogoUrl}
      brandColor={brandColor}
      workspaceLabel={workspaceLabel}
    >
      <div className="space-y-6">
        {share.conversation.messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-white px-4 py-2.5 text-[15px]">
                  {m.content}
                </div>
              </div>
            );
          }

          const toolCalls = !share.redactToolCalls && Array.isArray(m.toolCalls)
            ? (m.toolCalls as ToolCallSnapshot[])
            : [];

          return (
            <div key={m.id} className="space-y-2">
              {toolCalls.map((c) => (
                <div
                  key={c.id}
                  className="inline-flex items-center gap-1.5 text-[11px] rounded-lg border border-[var(--ai)]/30 bg-[var(--ai)]/5 px-2.5 py-1 font-mono text-[var(--ai)]"
                >
                  {c.name}
                  {c.ok === false && (
                    <span className="text-red-600">✗</span>
                  )}
                </div>
              ))}
              <div className="rounded-2xl rounded-bl-md bg-card border px-4 py-2.5 text-[15px] leading-relaxed prose-sm">
                {renderMarkdown(m.content)}
              </div>
            </div>
          );
        })}
      </div>
    </ShareLayout>
  );
}

function ShareLayout({
  title,
  subtitle,
  children,
  brandLogoUrl,
  brandColor,
  workspaceLabel,
}: {
  title: string;
  subtitle: string | null;
  children: React.ReactNode;
  brandLogoUrl: string | null;
  brandColor: string | null;
  workspaceLabel: string | null;
}) {
  // Fall back to the default EAM purple when the workspace hasn't set
  // a brand color. The eyebrow + gradient + link hover all share the
  // same accent so swapping one token re-themes the page.
  const accent = brandColor ?? undefined; // undefined → CSS uses var(--ai) via className
  const hasAccent = brandColor != null;
  const branded = brandLogoUrl != null || hasAccent;

  return (
    <div className="min-h-screen bg-background">
      <header
        className="border-b"
        style={
          hasAccent
            ? { background: `linear-gradient(to right, ${accent}15, transparent)` }
            : undefined
        }
      >
        <div
          className={
            hasAccent
              ? "max-w-3xl mx-auto px-5 py-6"
              : "max-w-3xl mx-auto px-5 py-6 bg-gradient-to-r from-[var(--ai)]/5 to-transparent"
          }
        >
          <div className="flex items-center gap-3">
            {brandLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogoUrl}
                alt={workspaceLabel ?? "Client logo"}
                className="max-h-10 w-auto rounded"
              />
            )}
            <div className="min-w-0">
              <div
                className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider"
                style={
                  hasAccent
                    ? { color: accent }
                    : undefined
                }
              >
                {!hasAccent && (
                  <span className="text-[var(--ai)]/80 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    Shared agent transcript
                  </span>
                )}
                {hasAccent && (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Shared agent transcript
                  </>
                )}
              </div>
              <h1 className="mt-1 text-2xl font-bold text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">{children}</main>

      <footer className="max-w-3xl mx-auto px-5 py-8 text-center text-[11px] text-muted-foreground">
        {branded && workspaceLabel ? (
          <>Prepared by {workspaceLabel}</>
        ) : (
          <>
            Generated by EAM ·{" "}
            <a
              href="https://eampoc.vercel.app"
              className="hover:text-[var(--ai)] transition-colors"
            >
              eampoc.vercel.app
            </a>
          </>
        )}
      </footer>
    </div>
  );
}
