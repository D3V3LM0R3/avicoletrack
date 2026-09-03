import sys
import unittest
from pathlib import Path

from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.main import app  # noqa: E402
from app.models.daily_report import DailyReport  # noqa: E402
from app.schemas.conversation import ConversationCreate, MessageCreate  # noqa: E402
from app.schemas.event import EventCreate  # noqa: E402
from app.schemas.market_price import MarketPriceCreate, MarketPriceUpdate  # noqa: E402
from app.schemas.stock_movement import StockMovementCreate  # noqa: E402
from app.services.daily_reports import calculate_kpis  # noqa: E402


class BetaContractTests(unittest.TestCase):
    def test_core_routes_are_registered(self):
        paths = app.openapi()["paths"]
        required = (
            "/auth/login",
            "/auth/register",
            "/farms",
            "/daily-reports",
            "/notifications",
            "/events",
            "/market-prices",
            "/stock-movements",
            "/analytics/dashboard",
            "/analytics/farm-comparison",
            "/chat/conversations",
        )
        missing = [path for path in required if path not in paths]
        self.assertFalse(missing, msg=f"Missing routes: {missing}")

    def test_chat_rejects_blank_inputs(self):
        with self.assertRaises(ValidationError):
            MessageCreate(content="   ")
        with self.assertRaises(ValidationError):
            ConversationCreate(name="   ")

    def test_stock_requires_positive_quantity(self):
        with self.assertRaises(ValidationError):
            StockMovementCreate(
                farm_id=1,
                stock_type="Aliments",
                movement_type="Sortie",
                quantity=0,
                unit="kg",
            )

    def test_daily_report_kpis_are_calculated(self):
        report = DailyReport(
            farm_id=1,
            flock_id=None,
            report_date="2026-08-27",
            bird_count=100,
            mortality=5,
            eggs_produced=80,
            egg_stock=10,
            cartons=0,
            alveoli=0,
            remaining_eggs=0,
        )

        calculate_kpis(report)

        self.assertAlmostEqual(report.laying_percentage, 84.21052631578947, places=6)
        self.assertAlmostEqual(report.ratio, 0.8421052631578947, places=6)

    def test_event_and_market_price_schemas_accept_supported_values(self):
        event = EventCreate(
            farm_ids=[1],
            type="inspection",
            title="Contrôle",
            event_date="2030-01-01T10:00:00",
            financial_type="cost",
            financial_amount=2500,
        )
        self.assertEqual(event.financial_type, "cost")
        self.assertEqual(event.financial_amount, 2500.0)

        price = MarketPriceCreate(
            product="Aliment",
            product_key="feed",
            region="Centre",
            price=500,
            price_low=400,
            price_mid=500,
            price_high=600,
            unit="FCFA/kg",
            source="manual",
            price_date="2030-01-01",
        )
        self.assertEqual(price.product_key, "feed")
        self.assertEqual(MarketPriceUpdate(price_high=700).price_high, 700)

    def test_migrations_contain_beta_safeguards(self):
        migration_path = ROOT / "database/migrations/026_capital_pricing_ledger.sql"
        self.assertTrue(migration_path.exists(), "Missing capital pricing migration")

        migration = migration_path.read_text()
        for expected in ("price_low", "total_value", "financial_amount"):
            self.assertIn(expected, migration)

        self.assertTrue((ROOT / "database/migrations/027_repair_game_scores.sql").exists())


if __name__ == "__main__":
    unittest.main()
