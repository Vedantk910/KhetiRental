"""KhetiRental dynamic depreciation pricing engine.


Mathematical formulation
------------------------
The hourly rental rate is a sum of three economically-distinct components:

    R(hour) = ( B_base * mu_season * delta_soil )          # market price
             + ( D_wear * kappa_age )                       # depreciation recovery
             + ( F_consumption * P_diesel )                 # fuel pass-through

    B_base        baseline hourly rate by horsepower tier
    mu_season     seasonal surge multiplier (1.0 .. 1.45)
    delta_soil    soil-resistance coefficient (loam=1.0, black-cotton clay=1.25)
    D_wear        depreciation wear factor = acquisition_cost / 10_000 h
    kappa_age     vintage multiplier = 1 + 0.05 * age_years
    F_consumption diesel consumption per hour for the machine
    P_diesel      district diesel price (pass-through, no markup)

This is a *recovery + scarcity* model: the base covers market opportunity,
the wear term recovers capital depreciation pro-rata to use, and the fuel
term is a zero-margin pass-through. See `showcase/docs/adr/0004-dynamic-depreciation-pricing.md`
for the rationale and the 250h -> 620h utilization-expansion case.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, asdict
from datetime import date
from pathlib import Path
from typing import Iterable

# Base rate tables (INR per hour).

BASE_RATE_BY_HP: dict[str, float] = {
    "35": 300.0,
    "45": 420.0,
    "55": 520.0,
    "75_4wd": 780.0,
}

# Soil-resistance coefficients (1.0 = reference loam).
SOIL_COEFF: dict[str, float] = {
    "loam": 1.0,
    "black_cotton": 1.25,
    "sandy": 0.9,
}

# Seasonal-surge multipliers by season band.
SEASONAL_SURGE: dict[str, float] = {
    "off_season": 1.00,
    "sowing": 1.20,
    "harvest_compressed": 1.45,   # 12-day sowing/harvest compression
}

# Diesel consumption (litres/hour) by HP tier.
FUEL_PER_HOUR: dict[str, float] = {
    "35": 3.2,
    "45": 4.0,
    "55": 5.2,
    "75_4wd": 7.8,
}

# Depreciation life assumption (hours).
DEPRECIATION_HOURS = 10_000


@dataclass(frozen=True)
class Machine:
    """A listed tractor. Hourly rate is derived from these fields."""
    machine_id: str
    hp: str                       # key into BASE_RATE_BY_HP
    age_years: int
    acquisition_cost_inr: float
    district: str                 # used for diesel price lookup
    soil_type: str                # key into SOIL_COEFF
    season: str                   # key into SEASONAL_SURGE


@dataclass
class PriceBreakdown:
    """Itemised price so a PM can audit each component."""
    machine_id: str
    base_component: float
    wear_component: float
    fuel_component: float
    hourly_rate_inr: float
    per_hour_note: str = ""

    def as_dict(self) -> dict:
        return asdict(self)


def hourly_rate(machine: Machine, diesel_price_inr: float) -> PriceBreakdown:
    """Return the itemised hourly rate for a machine under the current diesel price.

    Raises ValueError on any unknown HP / soil / season key so a data-quality
    bug surfaces instead of silently returning a wrong price.
    """
    b_base = _require(BASE_RATE_BY_HP, machine.hp, "hp")
    delta_soil = _require(SOIL_COEFF, machine.soil_type, "soil_type")
    mu_season = _require(SEASONAL_SURGE, machine.season, "season")
    f_consumption = _require(FUEL_PER_HOUR, machine.hp, "hp")

    d_wear = machine.acquisition_cost_inr / DEPRECIATION_HOURS
    kappa_age = 1.0 + 0.05 * machine.age_years

    base_component = b_base * mu_season * delta_soil
    wear_component = d_wear * kappa_age
    fuel_component = f_consumption * diesel_price_inr

    total = base_component + wear_component + fuel_component
    return PriceBreakdown(
        machine_id=machine.machine_id,
        base_component=_round2(base_component),
        wear_component=_round2(wear_component),
        fuel_component=_round2(fuel_component),
        hourly_rate_inr=_round2(total),
        per_hour_note=f"base={b_base} mu={mu_season} soil={delta_soil} "
                     f"wear/dh={d_wear:.4f} age_x={kappa_age} fuel/h={f_consumption} diesel={diesel_price_inr}",
    )


def _require(table: dict, key, label: str):
    if key not in table:
        raise ValueError(f"unknown {label}={key!r}; valid: {sorted(table)}")
    return table[key]


def _round2(x: float) -> float:
    return round(x + 1e-9, 2)


# Batch pricing + utilization-expansion case (250h -> 620h)

def batch_price(machines: Iterable[Machine], diesel_price_inr: float) -> list[PriceBreakdown]:
    return [hourly_rate(m, diesel_price_inr) for m in machines]


def net_hourly_to_owner(pb: PriceBreakdown, take_rate: float = 0.135) -> float:
    """Owner's net income per billed hour.

    The fuel component is a zero-margin diesel pass-through the owner spends
    (ADR-0004), so only base + wear are income; the platform take-rate
    (12-15 %, midpoint 13.5 %) is deducted from that.
    """
    return _round2((pb.hourly_rate_inr - pb.fuel_component) * (1 - take_rate))


def payback_years(acquisition_cost: float, net_hourly_to_owner: float,
                  annual_hours: float) -> float:
    """Simple payback: acquisition / (net hourly revenue * annual hours).

    Used by the 250h -> 620h utilization-expansion case in the PRD.
    """
    annual_revenue = net_hourly_to_owner * annual_hours
    if annual_revenue <= 0:
        return math.inf
    return acquisition_cost / annual_revenue


@dataclass(frozen=True)
class OwnerOpex:
    """Owner running costs left out of the simple payback (PRD §12 Q5)."""
    per_hour_inr: float        # operator wage + maintenance per billed hour
    fixed_per_year_inr: float  # insurance, registration, parking

    def __post_init__(self):
        if not (self.per_hour_inr >= 0 and self.fixed_per_year_inr >= 0):
            raise ValueError("owner opex must be non-negative")


# Planning assumptions for a 45 HP tractor (not yet validated): operator
# ₹80/h, maintenance ₹55/h, insurance and registration ₹12,000 a year.
DEFAULT_OPEX = OwnerOpex(per_hour_inr=135.0, fixed_per_year_inr=12_000.0)


def annual_owner_cash(net_hourly_to_owner: float, annual_hours: float, opex: OwnerOpex) -> float:
    return (net_hourly_to_owner - opex.per_hour_inr) * annual_hours - opex.fixed_per_year_inr


def payback_with_opex(acquisition_cost: float, net_hourly_to_owner: float,
                      annual_hours: float, opex: OwnerOpex) -> float:
    cash = annual_owner_cash(net_hourly_to_owner, annual_hours, opex)
    return acquisition_cost / cash if cash > 0 else math.inf


def drought_adjusted_hours(normal_hours: float, drought_every: int, hour_loss: float) -> float:
    """Average yearly hours if one year in `drought_every` loses `hour_loss` of them."""
    if drought_every < 1 or not 0 <= hour_loss <= 1:
        raise ValueError("drought_every must be >= 1 and hour_loss within [0, 1]")
    return normal_hours * (1 - hour_loss / drought_every)


def breakeven_hours(acquisition_cost: float, net_hourly_to_owner: float, opex: OwnerOpex,
                    target_years: float, drought_every: int, hour_loss: float) -> float:
    """Normal-year rented hours needed to repay the tractor in `target_years`, droughts included."""
    margin = (net_hourly_to_owner - opex.per_hour_inr) * (1 - hour_loss / drought_every)
    if margin <= 0:
        return math.inf
    return (acquisition_cost / target_years + opex.fixed_per_year_inr) / margin


# CLI: price a small fleet and write a JSON report.

_DEMO_FLEET: list[Machine] = [
    Machine("M-001", "45", 6, 6_50_000, "pune", "loam", "harvest_compressed"),
    Machine("M-002", "75_4wd", 12, 18_50_000, "jaipur", "black_cotton", "sowing"),
    Machine("M-003", "35", 3, 4_20_000, "nashik", "sandy", "off_season"),
]


def owner_cash_case(case: Machine, diesel: float) -> dict:
    """Season-blended net (30 % harvest, 30 % sowing, 40 % off-season hours),
    owner opex, and one drought year in four losing 40 % of hours."""
    mix = {"harvest_compressed": 0.3, "sowing": 0.3, "off_season": 0.4}
    blended = sum(w * net_hourly_to_owner(hourly_rate(Machine(case.machine_id, case.hp, case.age_years,
                  case.acquisition_cost_inr, case.district, case.soil_type, season), diesel))
                  for season, w in mix.items())
    cost, opex = case.acquisition_cost_inr, DEFAULT_OPEX
    drought = dict(drought_every=4, hour_loss=0.4)
    return {
        "note": "blended season mix; opex = operator ₹80/h + maintenance ₹55/h + ₹12,000/yr fixed (assumptions); "
                "drought = 1 year in 4 loses 40 % of hours",
        "blended_net_hourly_inr": _round2(blended),
        "payback_years": {
            str(h): {
                "no_opex": round(payback_years(cost, blended, h), 2),
                "with_opex": round(payback_with_opex(cost, blended, h, opex), 2),
                "with_opex_and_drought": round(payback_with_opex(cost, blended, drought_adjusted_hours(h, **drought), opex), 2),
            } for h in (250, 400, 620)
        },
        "hours_for_5yr_payback_with_opex_and_drought": round(breakeven_hours(cost, blended, opex, 5, **drought)),
    }


def main() -> int:
    out = Path(__file__).resolve().parent / "results"
    out.mkdir(parents=True, exist_ok=True)
    diesel = 91.0  # demo district price

    fleet = [
        Machine("M-101", "45", 5, 6_40_000, "jaipur", "loam", "harvest_compressed"),
        Machine("M-102", "75_4wd", 9, 17_20_000, "pune", "black_cotton", "harvest_compressed"),
        Machine("M-103", "55", 11, 9_80_000, "nashik", "sandy", "sowing"),
        Machine("M-104", "35", 2, 3_90_000, "indore", "loam", "off_season"),
    ]

    case = fleet[0]
    net = net_hourly_to_owner(hourly_rate(case, diesel))
    report = {
        "diesel_price_inr": diesel,
        "priced_on": date.today().isoformat(),
        "items": [pb.as_dict() for pb in batch_price(fleet, diesel)],
        "utilization_expansion_case": {
            "note": f"250h -> 620h owner payback for {case.machine_id} (45 HP, acquisition "
                    f"{case.acquisition_cost_inr:,.0f} INR); net-to-owner = (hourly_rate - fuel "
                    "pass-through) x (1 - 13.5% take-rate)",
            "net_hourly_to_owner_inr": net,
            "payback_at_250h": round(payback_years(case.acquisition_cost_inr, net, 250), 2),
            "payback_at_620h": round(payback_years(case.acquisition_cost_inr, net, 620), 2),
        },
        "owner_cash_case": owner_cash_case(case, diesel),
    }
    dest = out / "pricing_report.json"
    dest.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"wrote {dest} ({len(report['items'])} machines priced at diesel={diesel})")
    for it in report["items"]:
        print(f"  {it['machine_id']}  {it['hourly_rate_inr']:>8} INR/hr  "
              f"(base {it['base_component']} + wear {it['wear_component']} + fuel {it['fuel_component']})")
    uc = report["utilization_expansion_case"]
    print(f"  utilization case: payback {uc['payback_at_250h']}y @250h -> "
          f"{uc['payback_at_620h']}y @620h")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
