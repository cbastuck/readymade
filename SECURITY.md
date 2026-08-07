# Security Policy

## Reporting a vulnerability

Email **christoph@bstck.berlin**. Please don't open a public issue for a security
problem — tell us first and give us a chance to fix it.

Useful to include: what you found, what an attacker could do with it, how to
reproduce it, and which version, platform, or URL you were looking at. A rough
report sent early beats a polished one sent late.

What to expect: an acknowledgement within 3 working days, an assessment of
whether we agree it's a vulnerability within 10, and word from us when it's
fixed. This is a one-person project, so timelines are honest estimates rather
than commitments. If you'd like credit in the release notes, say so.

There is no bug bounty — no money, just genuine thanks and credit.

## Scope

In scope:

- the hosted services at readymadeit.com — the website, playground, accounts,
  cloud boards, and coordinators we operate;
- this repository and the runtimes in it (`hkp-frontend`, `hkp-node`,
  `hkp-python`, `hkp-rt`, `hkp-go`, and the desktop and mobile shells).

Out of scope: boards other people build with Readymade, third-party services a
board connects to, and the configuration of somebody else's self-hosted
instance. If the bug is in *our* code and you found it on your own instance,
that is in scope — please report it.

## Safe harbour

Good-faith security research is welcome. Research that stays within the rules
below does not breach the [Terms of Use](https://readymadeit.com/terms) § 5, and
we will not pursue claims against you for it:

- test against your own accounts, boards, and data only;
- do not access, alter, or exfiltrate anyone else's data — if you stumble into
  someone else's data, stop and tell us;
- do not degrade the service: no denial-of-service, no load or stress testing,
  no bulk automated scanning against our infrastructure;
- do not use social engineering, phishing, or physical access against us or our
  providers;
- report to us before disclosing anywhere else, and give us reasonable time to
  fix it — 90 days is a good default, and we'll agree something shorter if the
  issue is being exploited.

We can only speak for ourselves. This safe harbour does not bind our hosting
providers or any third party.

## Before you self-host

Two properties of the system are deliberate and worth knowing before you put a
runtime on a network:

- **Service mounts are unauthenticated by design.** A service that must be
  reachable from outside is published at `/hosted/<mountId>` on its runtime's
  server. They exist for callers holding no token, so the unguessable id is the
  only thing gating access. Treat a mount address as a secret.
- **A remote runtime trusts its network.** Runtimes are not hardened against a
  hostile local network. Don't bind one to an interface reachable from a network
  you don't control, and don't expose one to the public internet without putting
  your own authentication in front of it.

Neither of these is a vulnerability report — but a way to reach a mount or a
runtime *without* the id or the network position is exactly the kind of thing
we want to hear about.
