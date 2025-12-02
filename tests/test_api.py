import copy
import os
import sys

import pytest
from fastapi.testclient import TestClient

# make sure tests can import `src` when running under pytest
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.app import app, activities


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_activities():
    # snapshot and restore activities to avoid test inter-dependencies
    orig = copy.deepcopy(activities)
    yield
    activities.clear()
    activities.update(copy.deepcopy(orig))


def test_get_activities():
    res = client.get("/activities")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    # known activity from the sample data
    assert "Chess Club" in data


def test_signup_and_unregister_flow():
    activity = "Chess Club"
    email = "testuser@example.com"

    # ensure clean start
    if email in activities[activity]["participants"]:
        activities[activity]["participants"].remove(email)

    # signup should succeed
    r = client.post(f"/activities/{activity}/signup?email={email}")
    assert r.status_code == 200
    assert email in activities[activity]["participants"]

    # signing up again should fail (already signed up)
    r2 = client.post(f"/activities/{activity}/signup?email={email}")
    assert r2.status_code == 400

    # unregister should succeed
    r3 = client.delete(f"/activities/{activity}/participants?email={email}")
    assert r3.status_code == 200
    assert email not in activities[activity]["participants"]

    # unregistering again should return 404
    r4 = client.delete(f"/activities/{activity}/participants?email={email}")
    assert r4.status_code == 404


def test_signup_and_delete_nonexistent_activity():
    # signup to missing activity
    r = client.post("/activities/NoSuchActivity/signup?email=a@b.com")
    assert r.status_code == 404

    # delete from missing activity
    r2 = client.delete("/activities/NoSuchActivity/participants?email=a@b.com")
    assert r2.status_code == 404
