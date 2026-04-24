# xquare-homepage

Marketing homepage for xquare.net + `/kol` affiliate/KOL landing page.

**Fully decoupled from S1/S2.** Deployed as static assets to Cloudflare Pages — the site stays up even if the xquare servers are down.

## Layout

```
public/
  index.html    # xquare.net apex homepage
  kol.html      # /kol — affiliate/KOL landing (CF Pages auto-serves at /kol)
  _redirects    # /kol.html → /kol (301)
  _headers      # basic security headers
wrangler.toml
```

## Deploy

Token is in `~/.claude/projects/-home-xquare02/memory/credentials-s2.md` ("Cloudflare API Token" section).

```bash
cd /home/xquare02/xquare-homepage
export CLOUDFLARE_API_TOKEN='cfut_...'
export CLOUDFLARE_ACCOUNT_ID='283ba3c979c3eb60217b573596d85050'
npx wrangler@latest pages deploy public --project-name=xquare-homepage --branch=main
```

First deploy creates the project. Subsequent `--branch=main` deploys = production.
Preview deploys use any other branch name.

## Custom domains

- `xquare.net` apex → Pages project (primary)
- `www.xquare.net` → Pages project (redirect-to-apex via CF Rules if desired)
- `/kol` is served directly by `kol.html` (CF Pages auto-strips `.html`)

Adding custom domains requires a token with DNS:Edit scope for the zone — the Pages-only token
currently stored does **not** have that scope. Either upgrade the token or attach domains manually
in the Cloudflare dashboard → Pages → xquare-homepage → Custom domains.
