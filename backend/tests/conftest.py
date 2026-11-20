import os
import tempfile

import pytest

# Configure BEFORE the app is imported: throwaway DB, fast hashing, fixed secret.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["PASSWORD_HASH_ITERATIONS"] = "1000"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256-0123456789"
os.environ["FRONTEND_DIST"] = _tmp  # no SPA in tests

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)  # fresh seeded DB per test
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def login(client):
    def _login(username: str, password: str = "revel123") -> dict:
        r = client.post("/api/auth/login", json={"username": username, "password": password})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}
    return _login
