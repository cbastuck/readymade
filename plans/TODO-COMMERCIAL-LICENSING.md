# Commercial licensing (the paid alternative to AGPL)

Drafted 2026-10-11. **Nothing here is effective.** The clause text below is a
first draft to be reviewed by a lawyer under German law before it is offered to
anyone; prices are not decided. The structure is settled: one agreement holding
the common terms, plus one schedule per tier, so a customer who needs both tiers
signs one document.

The right to sell this at all comes from `CLA.md` §1, which reserves the
Maintainer's right to license contributions "under AGPL-3.0 or any other license
terms of the Maintainer's choosing".

---

## What the customer is actually buying

AGPL-3.0 does **not** prohibit commercial use, selling, redistribution or
hosting. It permits all of them. What it requires is that the source of the
Covered Software and of the customer's modifications is passed on, and — under
§13 — offered to users who interact with a modified version over a network.

So the commercial licence sells **relief from the source-disclosure
obligation**, not permission to make money. Any pitch that says "you can only
build a commercial product with a commercial licence" is false and a buyer's
counsel will see that in ten minutes. The honest claim is "…and keep your own
source closed".

Two consequences worth holding on to:

- A company that merely **uses** Readymade internally and unmodified has
  essentially no AGPL exposure and is not a customer for this.
- A company that **hosts an unmodified** Readymade for its own users arguably
  has no §13 obligation either. For that customer the Hosted tier sells
  warranty, indemnity, support and white-label rights rather than relief — see
  the note in Schedule B. This is a real soft spot in the Hosted tier and the
  reason its value has to be built out of those four things.

---

## The two tiers

| | **Schedule A — Embedded** | **Schedule B — Hosted** |
| --- | --- | --- |
| What they do | Ship a native or standalone product containing the Covered Software to their end users | Operate the Covered Software as a service their end users reach over a network |
| Relief granted | AGPL §§4–6 source obligations on distribution | AGPL §13 obligation to offer source to remote users |
| Does **not** cover | Operating a hosted service | Distributing object code to end users |
| Term | Annual, auto-renewing | Annual, auto-renewing |
| Scope metric | Flat, by the customer's size band | Flat, by the customer's size band |
| Fee | **open** — see Open questions | **open** — higher than Embedded |

Both tiers are **annual, never perpetual**. A perpetual commercial licence is a
single payment ever, which removes the renewal event the whole model depends on.

A customer doing both (a native app *and* a hosted backend) signs both
schedules.

**Two axes, not one.** Schedules A and B say *what you may do*. How you pay is a
separate choice — flat fee, or the revenue share in Schedule R — and it attaches
to either grant. Keeping these apart matters: conflating "what the licence
permits" with "how it is priced" is the same mistake as treating *commercial* and
*perpetual* as alternatives when one is about terms and the other about duration.

---

## What this licence cannot grant

The single most important technical term in the document, and the one most
likely to be missed.

The Covered Software links, bundles or fetches third-party components listed in
`THIRD-PARTY-NOTICES.md`. **The Maintainer owns none of them and can grant no
rights in them.** A commercial licence therefore cannot relieve a customer of
their terms.

This bites hardest on **espeak-ng** (`GPL-3.0-or-later`), reached two ways —
transitively through sherpa-onnx via piper-phonemize, and directly through the
inflect TTS backend — and gated by `HKP_SPEECH_ENABLED` and
`HKP_INFLECT_ENABLED` in `3rdparty/CMakeLists.txt`. A customer who ships a
closed-source binary built with either option on infringes espeak-ng's licence
no matter what this Agreement says. Those options are already off for iOS and
Android; desktop is the exposed target.

So: **a closed-source product must be built with the espeak-linked services
disabled.** §5 of the draft says so, and commits the Maintainer to identifying
which build options are copyleft-free for a given release — cheap to honour and
worth real money to the buyer.

`fdk-aac` needs the same treatment for a different reason: a non-OSI licence
with patent considerations, excluded from iOS and Android builds, flagged
`REVIEW` in `THIRD-PARTY-NOTICES.md`.

---

## Pricing: flat fee, or a share of what they make

Offered as an **alternative fee structure on either grant**, never as a
replacement for the flat fee. Clause text in Schedule R.

**Why offer it.** A builder with no customers yet cannot evaluate a four-figure
annual licence — the question is unanswerable, so they don't answer it. "Nothing
until you earn" removes the decision. Revenue share is historically the pricing
of the party with less leverage, which is the accurate description of our
position: no brand, no reference customers, no sales motion. Unreal Engine is the
precedent (a percentage of gross above a lifetime threshold).

It also makes the wider strategy coherent. We have decided not to build the
vertical businesses ourselves — court booking being the worked example. Taking a
share of whoever does is how we participate in the verticals we give away, and it
turns demo-building from marketing spend into a portfolio.

**Design decisions taken:**

- **Hybrid, not pure share.** A modest annual Base Fee plus a share above a
  threshold. The Base Fee arrives now, covers the support cost of having a
  customer at all, and filters out non-serious signups — which matters more than
  the money, because every licensee costs inbox time.
- **Gross, crude, no apportionment.** Product Revenue is the gross revenue of
  Your Product as a whole. No formula for "the part attributable to Readymade" —
  such a formula is unverifiable by one person and invites an argument every
  year.
- **A real threshold.** Nothing owed and nothing reported below it. Both
  administratively necessary and the best line in the pitch: *free until it
  works*.
- **Election is irrevocable for the Term.** Builders who expect to earn well will
  take the flat fee and those who expect little will take the share, so the
  share pool skews toward the ones that don't make it. Locking the election per
  term is the only cheap defence, and the flat fee must stay attractive enough
  that confident builders still choose it — that is cash now.
- **Self-reported, with a deterrent audit right.** We cannot audit anyone. An
  annual signed statement plus a verification right we will probably never
  exercise is the honest shape.

**What to expect from it.** Honest small companies will report and pay; others
will not, and there is no enforcement capacity to change that. Price the flat
tier so the business is solvent if **no** share income ever arrives, and treat
whatever does arrive as upside. The share also pays *late*, which is the opposite
of the near-term need for revenue — another reason it is an option beside the
flat fee rather than the main line.

---

## The development commitment (and why there is no fund)

**Decided 2026-10-11: no fund, no vehicle, no pooled money.**

A "fund" that takes money and manages it on behalf of others sits close to
regulated collective investment (in Germany, the KAGB) and needs licensing we
cannot carry. If instead it is simply money we receive and spend on development,
then it is not a fund at all — it is revenue, and calling it a fund in public
would misdescribe it.

Worse, the surrounding language is the language of securities. Participants who
"invest", hold "shares", or expect a return or control in exchange for money
move the arrangement toward a regulated offering — the Vermögensanlagengesetz
here, the Howey analysis for any US customer. That is a serious problem rather
than paperwork.

**What we do instead:** publish a plain commitment, in the licence page and the
pitch, of the form *"X% of commercial licence revenue is spent on Readymade
development, reported once a year."* It carries nearly all the narrative value,
is kept honest by reputation rather than regulation, and creates no entity.

**Vocabulary rule for all public material.** Do not write *fund*, *invest*,
*investment*, *shares*, *stake*, *equity* or *returns* about this. Write that a
published share of commercial revenue goes into development. The words are the
risk.

A real vehicle (gGmbH, e.V., Stiftung) is a conversation for after there is
revenue — and note those structures exist to *remove* founder control, which is
the opposite of what is needed now.

---

## Decided against: governance votes for licensees

**Rejected 2026-10-11.** Giving commercial licensees a vote in project steering
was considered and dropped:

- it hands steering to parties whose interest is their own product, not the
  project;
- it collides with `CLA.md` §1, which exists so the Maintainer can relicense and
  explicitly anticipates assigning rights to "a future business entity formed to
  operate the Project". Voting licensees become a veto bloc on exactly that
  freedom — legally or as a PR problem the first time terms or prices change;
- votes, money and the word "shares" together are classic markers that something
  is a security rather than a purchase;
- no customer asked for it. Licensees want stability, clear terms and someone who
  answers email; governance is what *contributors* request.

**Substitute, which delivers the felt benefit at no cost:** licensees get a
roadmap preview, a direct channel, and their feature requests logged and
prioritised — none of it binding. Belongs in §7 or the Order Form.

---

## Open questions

- [ ] **Prices.** Nothing below is decided. Indicative only, for a solo
      maintainer: Embedded €2–8k/yr, Hosted €5–20k/yr, with a small-company band
      (say under €1M revenue or 10 staff) at €500–1.5k so the customers most
      likely to say yes are not priced out. The floor has to clear the support
      cost of having a paying customer at all.
- [ ] **Entity.** Do not sign a commercial licence as a sole proprietorship.
      These terms carry warranty and indemnity obligations that reach personal
      assets. The UG decision comes before the first signature, not after.
- [ ] **Trademark registration.** §6 grants and withholds rights in marks that
      `TRADEMARK.md` itself calls "an informal policy, not a registered
      trademark". Register the word mark before contracting over it.
- [ ] **`inflect` licence.** `LicenseRef-UNRESOLVED`, marked ACTION REQUIRED in
      `THIRD-PARTY-NOTICES.md`: no licence file, upstream Inflect v2 terms
      unrecorded, model weights unaddressed. Must be closed before the first
      licence with any warranty goes out.
- [ ] **`fdk-aac` decision.** Resolve the flagged conflict, or exclude it from
      any build offered to a commercial licensee.
- [ ] **Patent indemnity.** §9 excludes it. Confirm that stays excluded —
      a solo maintainer cannot carry it, and silence is worse than an explicit
      exclusion.
- [ ] **Hosted scope metric.** Flat by size band avoids any need to audit or
      meter the customer. Revisit only if a customer's scale makes it absurd.
- [ ] **Governing law for non-EU customers.** German law and Berlin venue work
      inside the EU; a US customer may refuse. Decide whether to offer
      arbitration as a fallback.
- [ ] **Customer-name use.** §6 requires consent. Consider making it opt-out
      instead, or trading it for a discount.
- [ ] **Share percentage.** Indicative 3–8% of Product Revenue above the
      Threshold. Undecided.
- [ ] **Base Fee under Schedule R.** Low enough not to block a builder with no
      customers, high enough to cover support. Undecided.
- [ ] **Threshold.** Indicative €25–50k of Product Revenue per year. Undecided.
- [ ] **Cap on the Share?** A cap (say, never more than N× the flat fee) is a
      strong trust signal and removes the main objection builders have to
      revenue share — the fear of being punished for success, which is what
      damaged Unity in 2023. Against it: it converts the best outcomes into the
      cheapest ones. Decide before Schedule R is offered.
- [ ] **Reporting Year** — the customer's fiscal year, or the Term? The fiscal
      year is easier for them and therefore likelier to be honoured.
- [ ] **Withholding tax.** Schedule R amounts are likely royalties, and
      cross-border royalty withholding differs materially from a flat licence
      fee. Do not offer Schedule R outside Germany until the tax advisor has
      confirmed the handling and the residence-certificate process.
- [ ] **Development commitment percentage** — the number in the published
      commitment, and whether the annual report is a page or a post.
- [ ] **Attribution discount.** §6 offers a reduced fee for displaying "Powered
      by Readymade". Decide the discount, or drop the option.

---

# Draft: Readymade Commercial Licence Agreement

*Draft 2026-10-11. Not effective. For legal review.*

## 1. Parties and documents

This Agreement is between BSTCK BRLN, Christoph Bastuck, Kolonnenstr. 8, 10827
Berlin, Germany ("the Maintainer") and the company named in the Order Form
("you"). It consists of these common terms, the Schedule or Schedules named in
the Order Form, and the Order Form itself. Where they conflict, the Order Form
prevails over a Schedule, and a Schedule over these common terms.

## 2. Definitions

**Covered Software** — the components of the Readymade project owned or
licensable by the Maintainer, in the versions published during the Term, as
identified in the Order Form. It does not include Third-Party Components.

**Third-Party Components** — software not owned by the Maintainer that the
Covered Software links, bundles or fetches, as listed in
`THIRD-PARTY-NOTICES.md` for the release concerned.

**Your Product** — the application or service you build, identified in the
Order Form, which incorporates or operates the Covered Software.

**Term** — the period stated in the Order Form, and any renewal.

**AGPL** — the GNU Affero General Public License, version 3.

## 3. Grant

Subject to payment of the Fees and to the restrictions in §4, the Maintainer
grants you a non-exclusive, non-transferable, worldwide licence, for the Term,
to exercise the rights set out in the Schedule or Schedules named in the Order
Form.

This licence operates **instead of** the AGPL in respect of the Covered
Software, so that the obligations the relevant Schedule names do not apply to
you. Nothing in this Agreement removes or restricts any right you already hold
under the AGPL: you may at any time choose to use the Covered Software under the
AGPL instead, and this Agreement does not make you give up that option.

The grant extends to your affiliates and to contractors acting on your behalf,
provided you remain responsible for their compliance.

## 4. Restrictions

You may not:

1. distribute, sublicense or make the Covered Software available **as such** —
   that is, as a runtime, framework or development tool for third parties to
   build with — whether on its own or as the substance of Your Product. The
   grant is for shipping or operating Your Product, not for re-offering
   Readymade;
2. remove or alter copyright, licence or attribution notices in the Covered
   Software, or omit the notices Third-Party Components require you to pass on;
3. use the Marks except as §6 permits.

## 5. Third-Party Components

**This Agreement grants no rights in Third-Party Components.** Your rights in
them arise from their own licences, and this Agreement neither alters those
licences nor relieves you of their terms. The Maintainer gives no warranty of
any kind in respect of them (§8).

Some Third-Party Components are copyleft. At the date of this Agreement,
`espeak-ng` (`GPL-3.0-or-later`) is reached through the speech-to-text and
text-to-speech services and is enabled by the build options
`HKP_SPEECH_ENABLED` and `HKP_INFLECT_ENABLED`. A binary that links such a
component and is distributed without complete corresponding source infringes
that component's licence regardless of this Agreement. **If Your Product is
distributed or operated without disclosing its source, you must build the
Covered Software with those options disabled**, and you are responsible for
verifying the configuration you ship.

Some Third-Party Components are under non-OSI licences or carry patent
considerations — at the date of this Agreement, `fdk-aac`. Clearance for those
is yours.

On your written request the Maintainer will identify, for a given release, which
build configurations are free of copyleft and non-OSI components.

## 6. Trademarks

"Readymade", the Readymade logo and related names and marks (the **Marks**) are
the Maintainer's and are **not licensed by this Agreement**.

**White-label is the default.** You are not required to display the Marks, to
name the Maintainer in Your Product or its interface, or to disclose to your end
users that Your Product incorporates the Covered Software.

You may state factually that Your Product is built on or powered by Readymade.
You may not use the Marks as the name or primary brand of Your Product, nor in
any way suggesting that the Maintainer endorses, supports, or is the supplier of
Your Product to your end users.

Where the Order Form elects **Attributed**, you will display "Powered by
Readymade", linked to the project's website, in a reasonable and discoverable
place in Your Product, and the Fee is reduced as the Order Form states.

The Maintainer may name you and use your logo as a customer reference only with
your prior written consent.

## 7. Support

This Agreement includes no service level. The Maintainer will use reasonable
efforts to respond to reports through the channel named in the Order Form,
targeting five business days. Support with committed response times, or any
development work, is contracted separately.

## 8. Warranty

For ninety days after each release is made available to you, the Maintainer
warrants that the Covered Software will perform substantially as described in
the documentation published for that release. If it does not, the Maintainer
will correct the defect within a reasonable period or, failing that, refund the
Fee for the current Term pro rata. **That is your sole remedy for defects.**

The Maintainer warrants that it holds sufficient rights in the Covered Software
to grant this licence.

Except as stated above, and to the extent the law permits, the Covered Software
is provided **as is**. The Maintainer does not warrant that it will operate
uninterrupted or error-free, that it is fit for any particular purpose, or that
it is suitable for use where failure could cause death, personal injury, or
severe physical, environmental or financial harm. **No warranty whatever is
given in respect of Third-Party Components.**

> Review note: these are B2B terms, but §§307–310 BGB still control them as AGB.
> A blanket exclusion of liability for defects is likely to fail. The German text
> needs a lawyer's hand, not a translation of this.

## 9. Liability and indemnity

The Maintainer's total aggregate liability under this Agreement is limited to
the Fees you paid in the twelve months before the event giving rise to the
claim. Liability for indirect or consequential loss, lost profit, lost revenue
and lost or corrupted data is excluded.

These limits do **not** apply to liability for intent or gross negligence, for
injury to life, body or health, under the Produkthaftungsgesetz, or for the
absence of a warranted quality. Where a cardinal obligation is breached through
ordinary negligence, liability is limited to foreseeable damage typical of this
kind of agreement.

The Maintainer will defend you against, and settle, a third-party claim that the
**unmodified** Covered Software, used as this Agreement permits, infringes that
party's copyright or trade secret, and will bear the resulting cost up to the
cap above. This does not apply to claims arising from Third-Party Components,
from your modifications, from combining the Covered Software with anything else,
or from your own content, boards or configurations. **Patent claims are
excluded.**

You will indemnify the Maintainer against claims arising from Your Product, from
your use of the Covered Software outside this Agreement, and from your end
users.

## 10. Fees

Fees, currency and invoicing interval are in the Order Form. Fees are exclusive
of VAT. Where you are a business established in another EU member state, the
reverse-charge procedure applies and you will supply a valid VAT identification
number. Fees are non-refundable except under §8.

## 11. Term, renewal and what survives

The Term is one year from the effective date and renews for successive one-year
terms unless either party gives notice at least thirty days before it ends.
Either party may terminate for material breach not cured within thirty days of
written notice.

On expiry or termination:

1. **copies of Your Product distributed during the Term remain licensed
   perpetually**, and your end users' rights in them are unaffected — nothing
   you have already shipped becomes unlicensed;
2. you may not distribute further copies of Your Product, bring further Hosted
   deployments into service, or use any release of the Covered Software
   published after the Term ended;
3. where a Hosted deployment is in service, you must within ninety days either
   renew, or cease operating it, or bring it into compliance with the AGPL;
4. §§4, 5, 8, 9 and 12 survive.

## 12. General

This Agreement is governed by German law; the UN Convention on Contracts for the
International Sale of Goods does not apply. The courts of Berlin have exclusive
jurisdiction. You may assign this Agreement to a successor to the business it
concerns on written notice. The Maintainer may assign it, including to an entity
formed to operate the Readymade project. Amendments require text form.

---

## Schedule A — Embedded

You may, for the Term:

1. use and modify the Covered Software for the purpose of building Your Product;
2. incorporate the Covered Software, modified or unmodified, into Your Product;
3. distribute Your Product in object-code form to your end users, directly or
   through an app store or other channel,

in each case **without the obligations AGPL §§4, 5 and 6 would otherwise impose
on you** in respect of the Covered Software and your modifications to it, and
subject to §5 of the common terms.

This Schedule does not permit you to operate the Covered Software as a service
reached over a network by anyone other than you and your personnel. That is
Schedule B.

## Schedule B — Hosted

You may, for the Term:

1. use and modify the Covered Software for the purpose of building Your Product;
2. operate the Covered Software, modified or unmodified, as part of Your Product
   on infrastructure you control, and make Your Product available to your end
   users over a network,

in each case **without the obligation AGPL §13 would otherwise impose on you**
to offer Corresponding Source to those users, and subject to §5 of the common
terms.

This Schedule does not permit you to distribute the Covered Software, or Your
Product containing it, in source or object form to your end users. That is
Schedule A.

> Review note: where a customer hosts the Covered Software **unmodified**, the
> §13 obligation may not arise in the first place, so the relief this Schedule
> grants is worth little to them. What they are buying in that case is §6
> (white-label), §8 (warranty), §9 (indemnity) and §7 (support). Price and pitch
> this Schedule on those four, not on the relief.

## Schedule R — Revenue Share (fee terms)

This Schedule replaces §10 where the Order Form elects Revenue Share. It attaches
to Schedule A, Schedule B or both: it changes **how you pay**, not what you may
do.

1. **Election.** The choice between Flat Fee and Revenue Share is made in the
   Order Form before the Term begins and cannot be changed during that Term.
   Either may be elected for a renewal term by notice given before renewal.

2. **Base Fee.** You pay the annual Base Fee stated in the Order Form, whether or
   not any Share becomes due.

3. **Threshold.** No Share is due for a Reporting Year in which Product Revenue
   does not exceed the Threshold stated in the Order Form.

4. **Share.** Where Product Revenue exceeds the Threshold, you pay the percentage
   stated in the Order Form of Product Revenue **above** the Threshold.

5. **Product Revenue** means all amounts invoiced to or received by you and your
   affiliates in respect of Your Product — subscriptions, licences, one-off
   sales, setup, onboarding and support fees — excluding value-added and sales
   taxes, documented refunds and chargebacks, and amounts you collect purely as
   agent for a third party and pass on in full.

   It is deliberately the **gross** figure for Your Product as a whole. No
   apportionment is made for the share of Your Product's value attributable to
   the Covered Software, to your own work, or to anything else.

6. **Reporting.** Within sixty days of the end of each Reporting Year you deliver
   a statement, signed by a person authorised to bind you, giving Product Revenue
   for that year and the resulting calculation. A statement is due even where it
   reports nothing. Payment follows within thirty days of the statement.

7. **Records and verification.** You keep records sufficient to support each
   statement for three years. Once in any twelve months, on thirty days' notice,
   the Maintainer may have an independent accountant bound to confidentiality
   verify a statement, at the Maintainer's cost — unless the verification shows
   Product Revenue understated by more than five per cent, in which case you bear
   that cost and pay the difference.

8. **Failure to report.** A statement still undelivered thirty days after a
   written reminder is a material breach for the purposes of §11.

9. **Withholding.** Amounts payable under this Schedule may be treated as
   royalties. Where the law requires you to withhold tax you may do so, and you
   will promptly provide whatever documentation the Maintainer needs to claim
   treaty relief or a refund. The Maintainer will supply a certificate of
   residence on request.

> Review note: royalty characterisation and withholding differ materially from a
> flat licence fee, and the answer depends on the customer's country. Do not
> offer this Schedule across borders before the tax advisor has confirmed the
> handling.
