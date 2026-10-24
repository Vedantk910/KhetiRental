# Phase 10 — Interview grilling: model answers

Prepared for MiM / MBA admissions interviews and consulting case rounds.
Interviewer persona: admissions director (HEC Paris) / senior partner
(McKinsey). Every number is from [`docs/PRD.md`](../PRD.md),
[`analytics/results/pricing_report.json`](../../analytics/results/pricing_report.json)
or the portal's escrow engine; assumptions are named as assumptions.

How to use this: say the answer in your own words in under 90 seconds,
lead with the conclusion, give one number, name what you don't know yet.

---

## 1. Disintermediation

> *Your 27.5 % farmer saving rests on a 38 % broker markup you haven't
> surveyed, and your 13.5 % fee comes out of the owner's share. You never
> hold the tractor. After one good job, what stops the farmer and the owner
> swapping WhatsApp numbers? How many repeat bookings before you lose them?*

**Answer.** Some leakage is certain, and I'd plan for it rather than fight
it. Three reasons the business survives it:

1. **Leaving only saves the owner money on the one renter they already
   know.** On M-101 the fee is about ₹93 an hour (13.5 % of the ₹689
   non-fuel part of the rate). An owner who takes one farmer off-platform
   saves ₹93 an hour on maybe 20–30 hours a season. The platform's value
   is the other 150–370 hours a year that come from strangers, which is
   the whole utilisation case (250 → 400–620 h). An owner who leaves keeps
   one customer and gives up the stream.
2. **The farmer has no reason to leave.** The fee is not on the farmer's
   bill; off-platform, the farmer loses the escrow, the verified-hours
   billing and the automatic no-show refund, and pays the same rate.
   Leakage needs both sides to want it, and only one does.
3. **Repeat pairs get a cheaper deal, not a worse one.** I would price
   the second and later booking between the same pair at the bottom of
   the band (12 %) and new matches at 15 %. That makes staying cheaper
   than the inconvenience of chasing a payment in cash.

**How I'd know.** Track repeat-pair rate and "dark hours": the telematics
device logs engine hours that have no booking. If a pair's dark hours
exceed its booked hours for two seasons, that pair has left. The
break-even I'd watch is the share of an owner's hours that come from
repeat pairs: when it passes roughly half, the platform is mostly a
directory for that owner and the fee needs to be cut further or bundled
with something they can't get directly (insurance, finance, breakdown
replacement under D-08).

**What I don't know yet.** Whether 38 % is the real broker markup. If it
is closer to 20 %, the farmer saving is about 17 % and the case leans
even more on trust (escrow, refunds) than on price.

---

## 2. Escrow friction

> *A 4-hour job on a 35 HP tractor holds ₹4,788 upfront: 1.7 times the
> ₹2,839 rental, because of your own deposit floor. Plus two OTPs, three
> photos and a telematics box. Who pays for the box? Why would a cash-first
> farmer with a keypad phone accept that when a broker takes cash after the
> job?*

**Answer.** That number is a fair hit, and it tells me the floor is wrong
for short jobs. The floor (0.5 % of asset value) was designed for the
damage risk on a full day; on a 4-hour job it dominates the deposit. Three
changes:

1. **Scale the floor with the job.** Cap the deposit at 50 % of rental for
   jobs of 8 hours or less, and waive the floor for renters with three
   clean returns. On the same job that cuts the hold from ₹4,788 to
   ₹4,258 (₹2,839 + ₹1,419), and to ₹3,265 with the 15 % deposit for a
   repeat renter.
2. **It is a block, not a payment.** A UPI mandate reserves the money in
   the farmer's own account; nothing leaves until settlement, and the
   deposit is never debited on a clean return. That is closer to "pay
   after the job" than the number suggests, but it needs saying in the
   farmer's language at the moment of booking.
3. **The farmer never touches the box or the photos.** The OTP is a
   phone call or SMS, the photos are the owner's job at handover, and
   the telematics device is the owner's. Its cost (a few thousand rupees
   plus a SIM) is an owner capex that pays for itself through D-01 and
   D-02 protection, and CHCs can buy it under the same state scheme that
   funds the tractor.

For low-literacy renters, onboarding goes through village agents (CSC
operators or the CHC itself) who book on the farmer's behalf; the
farmer's only action is approving one UPI mandate.

**How I'd know.** Stage 2 → 3 conversion (pre-authorisation) by HP tier
and job length is the pilot metric for exactly this question; the target
in the PRD is ≥ 40 %. If short jobs convert far below long ones, the
floor is the cause.

---

## 3. Drought and payback

> *Your blended payback of 5.09 → 2.05 years needs hours to rise from 250
> to 620. In a failed monsoon, sowing collapses exactly when owners need
> cash, and you've ignored operator wages, maintenance, insurance and
> interest. If one year in four is a drought that cuts hours 40 %, does
> payback still beat a 5-year tractor loan? What do you tell an owner
> buying a second tractor because of you?*

**Answer.** You're right that the simple payback flatters the owner, so I
re-ran it. Adding owner costs (operator ₹80/h, maintenance ₹55/h,
insurance and registration ₹12,000 a year — planning assumptions) and one
drought year in four that loses 40 % of hours:

| Rented hours in a normal year | Simple payback | With owner costs | With costs and droughts |
|---|---|---|---|
| 250 | 5.09 yr | 7.99 yr | **9.03 yr** |
| 400 | 3.18 yr | 4.73 yr | **5.31 yr** |
| 620 | 2.05 yr | 2.96 yr | **3.31 yr** |

So the honest compression is **9.0 years to 3.3 years**, and an owner needs
about **422 rented hours in a normal year** to repay a ₹6.4 lakh tractor
inside a 5-year loan once droughts and costs are counted
(`analytics/pricing.py`, `owner_cash_case`).

What I'd tell the owner buying a second tractor:

1. **Don't buy on the platform's average; buy on your first season's
   hours.** If the first tractor rented more than about 420 hours
   through us in a normal year, the second has a case. Below that, the
   first tractor still has idle time to fill.
2. **A drought hurts less than it looks, because the costs are mostly
   per hour.** Operator and maintenance fall with the hours; only the
   ₹12,000 fixed cost doesn't. That is why one bad year in four moves
   payback by 11–13 %, not 40 %.
3. **The platform can widen the season.** Owners in a drought-hit
   district can be matched to neighbouring districts (H3 Res 7) and to
   non-sowing work (haulage, threshing) the D-02 rule already treats
   separately, which keeps hours up when sowing collapses.

**What I don't know yet.** Real operator and maintenance costs per hour by
tier, and whether drought frequency is one in four for the pilot
districts; both are inputs I'd take from CHC logbooks and IMD rainfall
history before any owner uses this for a loan decision.
