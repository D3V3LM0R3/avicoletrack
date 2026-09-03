import sys
import unittest
import uuid
from datetime import datetime
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.security import hash_password  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models.enterprise import Enterprise  # noqa: E402
from app.models.farm import Farm  # noqa: E402
from app.models.farm_membership import FarmMembership  # noqa: E402
from app.models.flock import Flock  # noqa: E402
from app.models.user import User  # noqa: E402


class NeonBackendApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.created_emails: list[str] = []

    def tearDown(self):
        with SessionLocal() as db:
            for email in self.created_emails:
                user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
                if user is None:
                    continue

                db.execute(FarmMembership.__table__.delete().where(FarmMembership.user_id == user.id))

                enterprises = db.execute(
                    select(Enterprise.id).where(Enterprise.owner_id == user.id)
                ).scalars().all()
                if enterprises:
                    for enterprise_id in enterprises:
                        db.execute(Farm.__table__.delete().where(Farm.enterprise_id == enterprise_id))
                    db.execute(Enterprise.__table__.delete().where(Enterprise.owner_id == user.id))

                db.execute(User.__table__.delete().where(User.id == user.id))

            db.commit()

    def _create_user(self, name: str, email: str, password: str, role: str = "OWNER") -> User:
        now = datetime.utcnow()
        user = User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            role=role,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        with SessionLocal() as db:
            db.add(user)
            db.commit()
            db.refresh(user)
            return user

    def _create_enterprise_and_farm(self, owner_user: User, enterprise_name: str, farm_name: str) -> Farm:
        now = datetime.utcnow()
        with SessionLocal() as db:
            enterprise = Enterprise(
                name=enterprise_name,
                owner_id=owner_user.id,
                created_at=now,
                updated_at=now,
                is_active=True,
            )
            db.add(enterprise)
            db.commit()
            db.refresh(enterprise)

            farm = Farm(
                enterprise_id=enterprise.id,
                name=farm_name,
                location="Yaoundé",
                active=True,
                food_type="Maïs",
                food_quantity=100,
                food_unit="kg",
                water_quantity=250,
                water_unit="L",
                created_at=now,
            )
            db.add(farm)
            db.commit()
            db.refresh(farm)
            return farm

    def _login(self, email: str, password: str):
        response = self.client.post(
            "/auth/login",
            data={
                "username": email,
                "password": password,
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["access_token"]

    def test_owner_registration_and_login_flow(self):
        email = f"owner_{uuid.uuid4().hex[:10]}@example.com"
        self.created_emails.append(email)

        payload = {
            "name": "Neon Owner",
            "email": email,
            "password": "StrongPass123!",
            "enterprise_name": "Neon Test Enterprise",
        }

        response = self.client.post("/auth/register", json=payload)
        self.assertEqual(response.status_code, 201, response.text)

        login = self.client.post(
            "/auth/login",
            data={
                "username": email,
                "password": "StrongPass123!",
            },
        )
        self.assertEqual(login.status_code, 200, login.text)

        body = login.json()
        self.assertIn("access_token", body)
        self.assertEqual(body["user"]["email"], email)

    def test_owner_can_create_and_list_a_farm(self):
        email = f"owner_{uuid.uuid4().hex[:10]}@example.com"
        self.created_emails.append(email)

        register = self.client.post(
            "/auth/register",
            json={
                "name": "Farm Owner",
                "email": email,
                "password": "StrongPass123!",
                "enterprise_name": "Farm Listing Enterprise",
            },
        )
        self.assertEqual(register.status_code, 201, register.text)

        token = self._login(email, "StrongPass123!")
        headers = {"Authorization": f"Bearer {token}"}

        farm_name = "Neon Test Farm"
        created = self.client.post(
            "/farms",
            json={
                "name": farm_name,
                "location": "Yaoundé",
                "food_type": "Maïs",
                "food_quantity": 150,
                "food_unit": "kg",
                "water_quantity": 400,
                "water_unit": "L",
            },
            headers=headers,
        )
        self.assertEqual(created.status_code, 201, created.text)

        listed = self.client.get("/farms", headers=headers)
        self.assertEqual(listed.status_code, 200, listed.text)
        farm_names = {farm["name"] for farm in listed.json()}
        self.assertIn(farm_name, farm_names)

    def test_manager_and_worker_permissions_are_enforced(self):
        owner_email = f"owner_{uuid.uuid4().hex[:10]}@example.com"
        manager_email = f"manager_{uuid.uuid4().hex[:10]}@example.com"
        worker_email = f"worker_{uuid.uuid4().hex[:10]}@example.com"
        outsider_email = f"outsider_{uuid.uuid4().hex[:10]}@example.com"
        self.created_emails.extend([owner_email, manager_email, worker_email, outsider_email])

        owner = self._create_user("Owner", owner_email, "StrongPass123!", role="OWNER")
        manager = self._create_user("Manager", manager_email, "StrongPass123!", role="MANAGER")
        worker = self._create_user("Worker", worker_email, "StrongPass123!", role="WORKER")
        outsider = self._create_user("Outsider", outsider_email, "StrongPass123!", role="WORKER")

        farm = self._create_enterprise_and_farm(owner, "Permission Enterprise", "Permission Farm")

        with SessionLocal() as db:
            db.add_all(
                [
                    FarmMembership(
                        user_id=manager.id,
                        farm_id=farm.id,
                        role="MANAGER",
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                        is_active=True,
                    ),
                    FarmMembership(
                        user_id=worker.id,
                        farm_id=farm.id,
                        role="WORKER",
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                        is_active=True,
                    ),
                ]
            )
            db.commit()

        owner_token = self._login(owner_email, "StrongPass123!")
        manager_token = self._login(manager_email, "StrongPass123!")
        worker_token = self._login(worker_email, "StrongPass123!")
        outsider_token = self._login(outsider_email, "StrongPass123!")

        for token in (owner_token, manager_token, worker_token):
            response = self.client.get(f"/farms/{farm.id}", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(response.status_code, 200, response.text)

        forbidden = self.client.get(
            f"/farms/{farm.id}",
            headers={"Authorization": f"Bearer {outsider_token}"},
        )
        self.assertEqual(forbidden.status_code, 403, forbidden.text)

    def test_daily_report_can_be_created_and_updated(self):
        owner_email = f"owner_{uuid.uuid4().hex[:10]}@example.com"
        self.created_emails.append(owner_email)

        owner = self._create_user("Report Owner", owner_email, "StrongPass123!", role="OWNER")
        farm = self._create_enterprise_and_farm(owner, "Report Enterprise", "Report Farm")

        with SessionLocal() as db:
            flock = Flock(
                farm_id=farm.id,
                name="Ligne Test",
                bird_count=100,
                initial_bird_count=100,
                breed="ISA Brown",
                start_date="2026-09-01",
                archived=False,
                updated_at=datetime.utcnow(),
            )
            db.add(flock)
            db.commit()
            db.refresh(flock)
            flock_id = flock.id

        token = self._login(owner_email, "StrongPass123!")
        headers = {"Authorization": f"Bearer {token}"}

        create_payload = {
            "farm_id": farm.id,
            "flock_id": flock_id,
            "report_date": "2026-09-03",
            "bird_count": 100,
            "mortality": 5,
            "eggs_produced": 80,
            "egg_stock": 15,
            "cartons": 0,
            "alveoli": 0,
            "remaining_eggs": 12,
            "feed_used_bags": 12.5,
            "water_used_liters": 80,
            "notes": "Initial report",
        }

        created = self.client.post("/daily-reports", json=create_payload, headers=headers)
        self.assertEqual(created.status_code, 201, created.text)
        created_body = created.json()
        self.assertEqual(created_body["farm_id"], farm.id)
        self.assertEqual(created_body["flock_id"], flock_id)
        self.assertAlmostEqual(created_body["laying_percentage"], 84.21, places=2)

        updated = self.client.patch(
            f"/daily-reports/{created_body['id']}",
            json={
                "mortality": 10,
                "eggs_produced": 90,
                "egg_stock": 20,
                "notes": "Updated report",
            },
            headers=headers,
        )
        self.assertEqual(updated.status_code, 200, updated.text)
        updated_body = updated.json()
        self.assertEqual(updated_body["eggs_produced"], 90)
        self.assertEqual(updated_body["mortality"], 10)
        self.assertEqual(updated_body["notes"], "Updated report")
        self.assertAlmostEqual(updated_body["laying_percentage"], 100.0, places=2)
        self.assertAlmostEqual(updated_body["ratio"], 1.0, places=2)


if __name__ == "__main__":
    unittest.main()
