// CSRF guard for mutating API routes. Tomko OS binds localhost, but any website
// open in the browser can still fire "simple" cross-origin POSTs at it — and
// mutating routes write files. Browsers always attach Origin to cross-site
// POSTs, so: no Origin (curl, server-side, same-origin GET-nav) or a
// localhost Origin passes; anything else is rejected.

export function checkOrigin(req: { headers: Headers }): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return null;
  } catch {
    // malformed origin → reject
  }
  return Response.json({ ok: false, error: "cross-origin request rejected" }, { status: 403 });
}
