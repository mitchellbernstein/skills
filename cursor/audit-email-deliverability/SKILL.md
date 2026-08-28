---
name: audit-email-deliverability
description: Use this when a user worries their email lands in spam, or asks to check/fix SPF, DKIM, DMARC, or sending-domain DNS. Enumerates the real zone before diagnosing, finds dead DMARC report addresses, sequences report-collection before policy enforcement, and drives Cloudflare's DNS dashboard by computer use when no API token is available.
---

# Audit and Fix Email Deliverability (SPF / DKIM / DMARC)

Use this skill when someone says their mail goes to spam, asks whether their
email DNS is set up right, or wants to harden a domain against spoofing.

The job has two halves that are easy to conflate:

- **Deliverability** — does mail reach the inbox? Driven by SPF + DKIM + DMARC
  existing and passing, plus sender reputation.
- **Spoofing protection and visibility** — can others send as you, and would you
  know? Driven by DMARC *enforcement* (`p=quarantine`/`p=reject`) and by
  aggregate reports actually arriving somewhere a human reads.

A domain can be perfectly deliverable and still have no spoofing protection.
Say which problem you are solving. Users usually ask about the first and are
handed advice about the second.

## Rule 1: enumerate the zone, never guess record names

**This is the mistake that wastes the most time and produces confidently wrong
advice.** `dig` only answers the exact name you ask for. Sending providers put
their records on a *subdomain*, and querying the apex returns nothing — which
reads identically to "not configured."

Resend, SendGrid, Mailgun, Postmark, and SES all commonly use a sending
subdomain. Real example: a domain whose apex had no DKIM at all turned out to
have a complete, correct Resend setup on `mail.<domain>`:

```text
mail.<domain>                     TXT   v=spf1 include:amazonses.com ~all
resend._domainkey.mail.<domain>   TXT   p=MIGfMA0...
_dmarc.mail.<domain>              TXT   v=DMARC1; p=none; ...
send.mail.<domain>                MX    feedback-smtp.<region>.amazonses.com
send.mail.<domain>                TXT   v=spf1 include:amazonses.com ~all
```

An audit that queried `resend._domainkey.<domain>` would have reported "no DKIM"
and recommended deleting the "orphan" `mail` TXT record — which would have
broken working mail.

**Always list the whole zone first.** Best to worst:

1. Read the zone in the DNS provider's UI or API. It shows every record *and*
   any human-written comments recording why a record exists.
2. `dig AXFR` if transfers are permitted (they usually aren't).
3. Only then probe names, and probe the full common set:

```sh
DOMAIN=example.com
for sub in "" mail. em. mg. sendgrid. news. mailer. e. m.; do
  for rec in "" _dmarc. resend._domainkey. s1._domainkey. s2._domainkey. \
             k1._domainkey. google._domainkey. selector1._domainkey. \
             selector2._domainkey. pm._domainkey. send.; do
    v=$(dig +short TXT "${rec}${sub}${DOMAIN}")
    [ -n "$v" ] && echo "${rec}${sub}${DOMAIN} -> $v"
  done
done
```

Treat "I found nothing" as "I have not looked in the right place yet" until you
have seen the zone itself.

## Rule 2: find out who actually sends before changing anything

Ask, and verify in the code:

```sh
grep -rInE "from:|resend|sendgrid|postmark|mailgun|@[a-z0-9.-]+\.(com|chat|io)" \
  --include="*.ts" --include="*.js" --include="*.py" --exclude-dir=node_modules .
```

You need the **From: domain** of every real sending path — application mail,
marketing, transactional, and any human mailbox. DMARC aligns against the
visible From domain, so that is the domain that needs DKIM.

Distinguish sending domains from **receiving/forwarding** domains. A domain with
only registrar-forwarding MX records receives mail but may not originate it —
different fix list entirely.

## Rule 3: verify the DMARC report address is alive

A `_dmarc` record whose `rua=` points at a mailbox nobody reads, or that does
not exist, is the single most common silent failure. It looks configured. It
produces nothing. And without reports you can never safely leave `p=none`,
so the domain sits unprotected indefinitely.

Ask the user directly: *"Is `dmarc@yourdomain.com` a real mailbox you read?"*
Do not assume. Raw aggregate reports are gzipped XML and unreadable by hand
even when they do arrive.

Two ways to fix it:

**Preferred — use a free report processor.** Postmark's DMARC digest
(`https://dmarc.postmarkapp.com`) is free, needs no payment method, and emails
a human-readable weekly summary. It issues a per-domain address like
`re+xxxxxxxx@dmarc.postmarkapp.com`. The processor publishes its own external
authorization record, so nothing extra is needed on your side.

**Or — self-host the reports**, in which case remember the cross-domain rule:
if `_dmarc.a.com` sends `rua` to an address `@b.com`, then `b.com` MUST publish

```text
a.com._report._dmarc.b.com   TXT   "v=DMARC1"
```

or every compliant reporter silently drops the report (RFC 7489 §7.1). Missing
this is common and invisible.

The signup requires the user's own email and an inbox confirmation click. Hand
that step to them; do not create accounts on their behalf.

## Rule 4: collect reports first, enforce second, harden SPF last

Sequence matters. Each step depends on data from the previous one.

1. **Fix `rua` so reports arrive.** Safe, reversible, changes no mail flow.
2. **Wait ~2 weeks.** Read the digests. Confirm every legitimate sender passes.
3. **Ratchet the policy**, roughly a week apart:
   `p=none` → `p=quarantine; pct=25` → `pct=100` → `p=reject`.
4. **Tighten SPF `~all` → `-all`** only once reports prove you know every sender.

Going to `p=reject` or `-all` without report data is how you silently blackhole
your own invoices.

A reasonable monitoring-phase record:

```text
v=DMARC1; p=none; pct=100; rua=mailto:<report-address>; sp=none; adkim=r; aspf=r; fo=1
```

`fo=1` requests failure detail. `adkim=r`/`aspf=r` are relaxed alignment, which
lets a subdomain's DKIM signature satisfy the parent's From domain — this is
why a `mail.<domain>` sender can pass DMARC for `@<domain>`.

## Rule 5: prefer inheritance to duplication

A subdomain with **no** `_dmarc` record of its own inherits the parent's `sp=`
policy. If parent and subdomain policies are identical, delete the subdomain
record. One record, one report stream, one place to update.

Only keep a separate subdomain `_dmarc` when the subdomain genuinely needs a
different policy or a different report destination.

## Rule 6: never delete a record you cannot explain

Before removing anything:

- Read its **comment** in the DNS UI (`SPF for Resend`, `DMARC for ...`). API
  and `dig` output do not expose these. This alone prevents most bad deletions.
- Check for sibling records implying an active provider setup — a
  `send.<name>` MX plus a `<selector>._domainkey.<name>` means a live
  configured sender, not debris.
- Record the exact old value in your reply before deleting, so it can be restored.

Removing a stray `include:` from an SPF record deserves the same caution. An
apex SPF carrying `include:amazonses.com` does let any SES tenant spoof that
domain — a real finding — but if something legitimately sends from the apex,
removing it bounces real mail. Let the DMARC reports identify the senders first.

## Computer use: driving the Cloudflare DNS dashboard

Preferred order: Cloudflare API token → Cloudflare MCP server → browser
automation. Use the browser when the user cannot produce a token, which is
common and is a perfectly good reason to fall back.

For the browser, use a **browser-extension MCP** (DOM-aware). Generic
screen-level computer use often grants browsers read-only tier, so clicks are
blocked; and pixel-hunting a data table is slow and brittle.

Working flow:

```text
1. navigate  https://dash.cloudflare.com/<account-id>/<zone>/dns/records
2. find      "Search DNS Records input box"     -> ref
3. form_input ref = "_dmarc"                    (filters the table)
4. click     the row's "Edit"
5. find      "Content textbox in the record edit form" -> ref
6. form_input ref = "<new record value>"
7. find      "Save button in the DNS record edit form" -> ref
8. click     by ref
9. confirm   the green "DNS record updated successfully" toast
```

Hard-won details:

- **Click by `ref`, not coordinates.** The Cloudflare DNS page reflows as the
  Recommendations banner resolves and as the inline edit form expands. A button
  can shift 30–80px between the screenshot and the click, and the click lands on
  empty space with no error. Coordinate clicks that silently no-op are the main
  failure mode here; `ref` clicks survive the reflow.
- **Set the Content field with `form_input`, not by typing.** It replaces the
  full value atomically, no select-all-then-type dance.
- **Filter the table before editing.** Zones have dozens of records and row
  positions shift; searching narrows to one unambiguous row.
- **Deleting takes two clicks**: `Delete` in the edit form, then `Delete` again
  in the confirmation dialog. Find the second by "Delete confirmation button
  inside Delete record dialog" — a plain "Delete" query matches both.
- **The Comment column is the reason to be in the UI at all.** It carries
  provenance that no DNS query returns. Read it before touching a record.

Get the account ID and zone path once from the first navigation's resulting URL,
then construct subsequent zone URLs directly.

## Verify every change against public DNS

Never trust the dashboard's success toast alone — confirm resolution:

```sh
sleep 5
dig +short TXT _dmarc.example.com @1.1.1.1
```

Query a public resolver explicitly (`@1.1.1.1`) to bypass local caches. For a
deletion, confirm empty output. Report the literal returned value back to the
user.

## Reporting findings

Separate what you **observed** from what you **inferred**. State plainly when an
earlier finding was wrong and what changes as a result — a corrected audit is
worth more than a consistent one.

Rank by real impact, and be honest when the headline worry is unfounded. Valid
SPF + DKIM + DMARC + a bounce subdomain on the sending domain means
deliverability is fine; if the actual gaps are spoofing and visibility, say so
rather than letting "you're in spam" go unchallenged.

## Beyond DNS

Once records are correct, remaining deliverability risk is behavioral:

- **Shared-domain reputation.** If many users or tenants send from one domain,
  one bad sender degrades delivery for all of them. Mitigate with per-user rate
  limits and automatic suspension on a bounce/complaint webhook spike.
- **Bulk-sender rules.** Gmail and Yahoo require one-click `List-Unsubscribe`
  (RFC 8058), a spam-complaint rate under 0.3%, and TLS, for senders above
  roughly 5,000 messages/day to their users.
- **Separate streams.** Keep transactional and marketing on different
  subdomains so a campaign cannot damage password-reset delivery.
- **Warm up gradually.** A new domain or dedicated IP sending at full volume
  immediately looks like a spam source.
- **Optional hardening.** MTA-STS with TLS-RPT enforces TLS to your MX. BIMI
  displays a logo but requires `p=quarantine` or stricter, plus a VMC.
