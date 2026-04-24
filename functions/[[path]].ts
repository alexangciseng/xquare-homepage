/**
 * Catch-all proxy to the Bookinga storefront.
 *
 * Pages owns only the static marketing pages in `public/` (`/`, `/kol`, …).
 * Every other path on `dev.xquare.net` is proxied to the S3 Bookinga origin
 * (`xquare.ofiz.cloud`). HTML responses have `https://xquare.ofiz.cloud`
 * rewritten to the public host so canonical/og:url/script-src stay correct.
 *
 * On `xquare.net` (production) we don't proxy — prod storefront isn't wired
 * yet, so non-static paths 404 honestly instead of silently leaking to dev.
 */

interface Env {
  LISTING_ORIGIN?: string;
}

const DEV_ORIGIN = "https://xquare.ofiz.cloud";

// Hosts on which we proxy dynamic paths to the Bookinga origin.
// Anything else (e.g. xquare.net) gets a 404 for non-static paths.
const PROXIED_HOSTS = new Set([
  "dev.xquare.net",
  "xquare-homepage.pages.dev", // for direct preview-URL testing
]);

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const publicHost = url.host;

  if (!PROXIED_HOSTS.has(publicHost)) {
    return new Response("Not found", { status: 404 });
  }

  const origin = env.LISTING_ORIGIN || DEV_ORIGIN;

  // `/listing/{slug}` is the canonical Bookinga route (its nested subtree —
  // account, bookings, checkout — lives under there too). `/l/{slug}` is a
  // short public alias we just 301 into place; Bookinga's client-side router
  // never sees `/l/*` so there's no hydration mismatch.
  if (url.pathname === "/l" || url.pathname.startsWith("/l/")) {
    const canonical = "/listing" + url.pathname.slice(2);
    return Response.redirect(
      new URL(canonical + url.search, url.origin).toString(),
      301,
    );
  }

  const originUrl = new URL(url.pathname + url.search, origin);

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.set("Host", new URL(origin).host);
  upstreamHeaders.set("X-Forwarded-Host", publicHost);
  upstreamHeaders.set("X-Forwarded-Proto", url.protocol.replace(":", ""));
  const clientIp = request.headers.get("CF-Connecting-IP");
  if (clientIp) upstreamHeaders.set("X-Forwarded-For", clientIp);

  const init: RequestInit = {
    method: request.method,
    headers: upstreamHeaders,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(originUrl.toString(), init);
  } catch (err) {
    return new Response(`Upstream error: ${(err as Error).message}`, {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  }

  // Rewrite origin hostname to public hostname in HTML bodies only.
  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("text/html")) {
    return upstream;
  }

  const body = await upstream.text();
  const rewritten = body.split(origin).join(`https://${publicHost}`);

  const headers = new Headers(upstream.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");

  return new Response(rewritten, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};
