# ADR-0004: Dynamic depreciation pricing vs fixed tariff

- **Status:** Accepted
- **Date:** 2026-06

## Context
A fixed hourly tariff treats a 3-year-old 45 HP tractor in loam and a 12-year-
old 75 HP 4WD in black-cotton clay in a compressed 12-day harvest window as
interchangeable. That prices the asset on its *nameplate*, not on its
*recoverable value* — it systematically over-prices young machines in flat
seasons (hurting liquidity) and under-prices old machines in surge windows
(where scarcity value is highest).

## Decision
Price each machine-hour as three economically-distinct components
(implemented in `showcase/analytics/pricing.py`):

    R = (B_base × μ_season × δ_soil)   # market/scarcity
      + (D_wear × κ_age)               # depreciation recovery
      + (F_consumption × P_diesel)      # zero-margin fuel pass-through

- `B_base` by HP tier; `μ_season` ∈ [1.0, 1.45]; `δ_soil` (loam 1.0, black-
  cotton clay 1.25); `D_wear = acquisition / 10,000 h`; `κ_age = 1 + 0.05·age`.

## Rationale
- **Three-way separation** means each factor is auditable and independently
  tunable — a PM can move the seasonal surge without touching depreciation
  recovery or the fuel pass-through.
- **Depreciation recovery** charges the *owner's* capital cost pro-rata to
  use (wear × age), which is the economically-honest allocation: an old,
  heavily-used machine recovers less capital per hour.
- **Fuel pass-through is zero-margin**: we don't trade diesel; we pass the
  district price through so the platform's margin is not coupled to fuel
  price volatility.
- The **250 h → 620 h utilization-expansion case** (see `pricing.py` output)
  is the supply-side argument: idle-time is the true enemy, so the pricing
  model must make *owners* want to list more hours.

## Consequences
- Pricing requires live inputs (diesel price, season, soil) — a `pricing.events`
  Kafka topic feeds them in; the matching ranker can additionally boost
  cheaper machines (see `showcase/contracts/openapi.yaml` candidate scoring).
- We commit to publishing the formula (transparency builds owner trust in a
  marketplace that replaces an opaque informal broker).
