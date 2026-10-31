# /.well-known

Files here are served at the site root, e.g.
`public/.well-known/foo` → `https://<domain>/.well-known/foo`.

## Apple Pay (Coinflow) domain verification

Coinflow will not enable Apple Pay on a domain until Apple can fetch a
verification file from it. Drop the file Coinflow gives you here as:

    public/.well-known/apple-developer-merchantid-domain-association

**No file extension.** Not `.txt`, not `.json` — the byte-for-byte file
downloaded from Coinflow Dashboard → Settings → Apple Pay → *Download Domain
Verification File*. Renaming it or letting an editor append a newline is the
usual reason verification keeps failing.

Then deploy, confirm the URL returns the file contents with a 200, and press
verify in the Coinflow dashboard.

Every domain listed in the dashboard needs its own copy served from that
domain — the file is per-domain, and a domain that is not verified simply never
shows the Apple Pay button.

Note: `src/proxy.ts` deliberately lets `/.well-known/*` bypass the beta password
gate. Machines fetching these files cannot answer a password page, and a
redirect reads to them as "file missing".
