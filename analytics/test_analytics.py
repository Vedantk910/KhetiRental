"""Unit tests for analytics/pricing.py and analytics/kpis.py.

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
