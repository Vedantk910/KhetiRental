"""Unit tests for showcase/analytics/pricing.py and showcase/analytics/kpis.py.

Run: python3 -m unittest discover -s analytics -v
"""

import math
import unittest

import kpis
import pricing
from pricing import Machine


class PricingTest(unittest.TestCase):
    m = Machine("M-T", "45", 5, 6_40_000, "jaipur", "loam", "harvest_compressed")

    def test_hourly_rate_matches_formula(self):
        pb = pricing.hourly_rate(self.m, diesel_price_inr=91.0)
        base = pricing.BASE_RATE_BY_HP["45"] * pricing.SEASONAL_SURGE["harvest_compressed"] * pricing.SOIL_COEFF["loam"]
        wear = (6_40_000 / pricing.DEPRECIATION_HOURS) * (1 + 0.05 * 5)
        fuel = pricing.FUEL_PER_HOUR["45"] * 91.0
        self.assertAlmostEqual(pb.base_component, base, places=2)
        self.assertAlmostEqual(pb.wear_component, wear, places=2)
        self.assertAlmostEqual(pb.fuel_component, fuel, places=2)
        self.assertAlmostEqual(pb.hourly_rate_inr, base + wear + fuel, places=2)

    def test_unknown_inputs_rejected(self):
        bad = Machine("M-X", "999", 1, 1, "x", "loam", "sowing")
        with self.assertRaises(Exception):
            pricing.hourly_rate(bad, 91.0)

    def test_net_to_owner_excludes_fuel_pass_through(self):
        # Diesel is a zero-margin pass-through the owner spends (ADR-0004),
        # so it is not owner income; take-rate applies to the rest.
        pb = pricing.hourly_rate(self.m, 91.0)
        net = pricing.net_hourly_to_owner(pb, take_rate=0.135)
        self.assertAlmostEqual(net, (pb.hourly_rate_inr - pb.fuel_component) * 0.865, places=2)

    def test_payback(self):
        self.assertAlmostEqual(pricing.payback_years(600_000, 1_000, 300), 2.0)
        self.assertEqual(pricing.payback_years(600_000, 0, 300), math.inf)

    def test_more_utilization_pays_back_faster(self):
        net = pricing.net_hourly_to_owner(pricing.hourly_rate(self.m, 91.0))
        self.assertLess(pricing.payback_years(6_40_000, net, 620), pricing.payback_years(6_40_000, net, 250))


class OwnerEconomicsTest(unittest.TestCase):
    def test_opex_lowers_annual_cash_and_lengthens_payback(self):
        opex = pricing.OwnerOpex(per_hour_inr=135, fixed_per_year_inr=12_000)
        self.assertAlmostEqual(pricing.annual_owner_cash(500, 400, opex), (500 - 135) * 400 - 12_000)
        self.assertGreater(pricing.payback_with_opex(640_000, 500, 400, opex), pricing.payback_years(640_000, 500, 400))

    def test_cash_never_covers_the_tractor_returns_infinity(self):
        opex = pricing.OwnerOpex(per_hour_inr=600, fixed_per_year_inr=0)
        self.assertEqual(pricing.payback_with_opex(640_000, 500, 400, opex), math.inf)

    def test_drought_years_reduce_average_hours(self):
        # One year in four loses 40 % of hours: average = 0.75 + 0.25 * 0.6 = 90 %.
        self.assertAlmostEqual(pricing.drought_adjusted_hours(620, drought_every=4, hour_loss=0.4), 558)
        self.assertEqual(pricing.drought_adjusted_hours(620, drought_every=4, hour_loss=0.0), 620)

    def test_breakeven_hours_hit_the_target_payback(self):
        opex = pricing.OwnerOpex(per_hour_inr=135, fixed_per_year_inr=12_000)
        h = pricing.breakeven_hours(640_000, 503.35, opex, target_years=5, drought_every=4, hour_loss=0.4)
        hours = pricing.drought_adjusted_hours(h, drought_every=4, hour_loss=0.4)
        self.assertAlmostEqual(pricing.payback_with_opex(640_000, 503.35, hours, opex), 5, places=6)

    def test_rejects_hostile_inputs(self):
        with self.assertRaises(ValueError):
            pricing.OwnerOpex(per_hour_inr=-1, fixed_per_year_inr=0)
        with self.assertRaises(ValueError):
            pricing.drought_adjusted_hours(620, drought_every=0, hour_loss=0.4)
        with self.assertRaises(ValueError):
            pricing.drought_adjusted_hours(620, drought_every=4, hour_loss=1.5)


class KpiTest(unittest.TestCase):
    def test_liquidity_index_balanced_market_is_higher(self):
        balanced = kpis.DistrictSnapshot("d", 100, 100, 10.0)
        skewed = kpis.DistrictSnapshot("d", 100, 10, 10.0)
        self.assertGreater(kpis.liquidity_index(balanced), kpis.liquidity_index(skewed))

    def test_time_to_fulfill_is_median_minutes(self):
        b = [kpis.BookingTiming(str(i), 0, s) for i, s in enumerate([600, 1200, 6000])]
        self.assertEqual(kpis.time_to_fulfill_minutes(b), 20.0)


if __name__ == "__main__":
    unittest.main()
