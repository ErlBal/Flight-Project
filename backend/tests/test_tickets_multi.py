from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.flight import Flight
from app.models.user import User
from app.core.security import get_password_hash

client = TestClient(app)

def ensure_user(email: str, password: str = "testpass"):
    db = SessionLocal()
    u = db.query(User).filter(User.email == email).first()
    if not u:
        u = User(email=email, full_name=email.split("@")[0], hashed_password=get_password_hash(password), role="user", is_active=True)
        db.add(u)
        db.commit()
    db.close()

def login(email: str = "user1@example.com"):
    ensure_user(email)
    r = client.post("/auth/login-json", json={"email": email, "password": "testpass"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def seed_flight(seats: int = 5, price: float = 100.0):
    db = SessionLocal()
    f = Flight(
        airline="DemoAir",
        flight_number="DA100",
        origin="AAA",
        destination="BBB",
        departure="2099-01-01T10:00:00Z",
        arrival="2099-01-01T12:00:00Z",
        price=price,
        seats_total=seats,
        seats_available=seats,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    db.close()
    return f.id


def test_multi_purchase_success():
    flight_id = seed_flight(seats=6)
    token = login()
    r = client.post(
        "/tickets",
        json={"flight_id": flight_id, "quantity": 3},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["quantity"] == 3
    assert len(data["confirmation_ids"]) == 3

    # seats should have decremented to 3 now
    r2 = client.get(f"/flights/{flight_id}")
    assert r2.status_code == 200
    assert r2.json()["seats_available"] == 3


def test_multi_purchase_not_enough_seats():
    flight_id = seed_flight(seats=2)
    token = login("user2@example.com")
    r = client.post(
        "/tickets",
        json={"flight_id": flight_id, "quantity": 5},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400
    assert "Not enough seats" in r.text


def test_multi_purchase_partial_then_exhaust():
    flight_id = seed_flight(seats=4)
    token = login("user3@example.com")

    r1 = client.post(
        "/tickets",
        json={"flight_id": flight_id, "quantity": 3},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r1.status_code == 200

    # Now only 1 seat left, try to buy 2 -> fail
    r2 = client.post(
        "/tickets",
        json={"flight_id": flight_id, "quantity": 2},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r2.status_code == 400

    # Buy the last 1 successfully
    r3 = client.post(
        "/tickets",
        json={"flight_id": flight_id, "quantity": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r3.status_code == 200

    # Seats now 0
    r4 = client.get(f"/flights/{flight_id}")
    assert r4.status_code == 200
    assert r4.json()["seats_available"] == 0
