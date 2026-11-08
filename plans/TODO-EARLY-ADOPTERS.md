# Early adopters: a Readymade board that hears who wants to try it

The pricing page shows offers that are not open yet — Cloud and Partner on
Cloud — and asks people who would try them early to say hello
(`hkp-website/astro/components/EarlyAdopter.astro`). Today that field is a
placeholder: it sends and keeps nothing, and tells the person so. This plan is
what replaces it.

## Decided (2026-11-08)

- **Built on Readymade.** The sign-ups are kept by a board of ours, deployed
  like any other, rather than by a newsletter provider. It is a demo of what a
  deployed board does as much as a form.
- **Not a waiting list.** The wording says "Early adopter? Say hello": the
  point is to hear who is interested, not to suggest more demand than we can
  meet. Button *Say hello*; the placeholder's answer is *Not open yet: your
  address wasn't stored*.
- **One field per offer**, so what we learn is which cell people want, not only
  that someone is interested.

## Open

- [ ] The board: a mount on hkp-node that accepts `{ offer, email }`, a `sql`
      table of sign-ups, and a facade for us to read them by offer.
- [ ] Double opt-in: a confirmation mail with a link back to the mount, and
      only confirmed addresses kept. Needed to show consent for anything we
      later send.
- [ ] Unsubscribe (and deletion) in every mail we send, by the same route.
- [ ] Privacy policy (`hkp-website/src/pages/Privacy.tsx`): what is stored, why,
      for how long, and who processes it — including the mail provider the
      board sends through.
- [ ] Abuse: a rate limit on the mount, so it cannot be used to send mail to
      addresses nobody entered.
- [ ] Connect `EarlyAdopter.astro` to the mount, and give the field its `name`
      only then — without one, a submit sends nothing.
