"""Business-rule tests. Each test name maps to a rule in docs/TECHNICAL_REQUIREMENTS.md."""


def users(client, h):
    return {u["display_name"].split()[0].lower(): u for u in client.get("/api/people", headers=h).json()}


def balance(client, h, name):
    return next(u["balance"] for u in client.get("/api/bucks/balances", headers=h).json()
                if u["display_name"].lower().startswith(name))


def test_login_and_roles(client, login):
    assert client.post("/api/auth/login", json={"username": "alex", "password": "bad"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    me = client.get("/api/auth/me", headers=login("alex")).json()
    assert me["role"] == "user" and me["is_council"] is True
    assert client.get("/api/auth/me", headers=login("admin", "admin123")).json()["role"] == "admin"


def test_guest_is_read_only(client):
    tok = client.post("/api/auth/guest").json()["access_token"]
    g = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/badges", headers=g).status_code == 200
    assert client.get("/api/bucks/balances", headers=g).status_code == 200
    assert client.get("/api/bucks/transactions?scope=studio", headers=g).status_code == 403
    assert client.post("/api/bucks/transactions", headers=g,
                       json={"target_id": 3, "type": "give", "amount": 1, "reason": "hi!"}).status_code == 403
    assert client.get("/api/goals", headers=g).status_code == 403
    assert client.get("/api/admin/users", headers=g).status_code == 403


def test_learner_cannot_use_admin_api(client, login):
    assert client.get("/api/admin/users", headers=login("alex")).status_code == 403


def test_studio_balances_exclude_guides(client, login):
    names = [u["display_name"] for u in client.get("/api/bucks/balances", headers=login("alex")).json()]
    assert "Guide Sarah" not in names and "Maya Lin" in names


def test_give_moves_bucks_and_take_moves_back(client, login):
    alex, maya = login("alex"), login("maya")
    ids = users(client, alex)
    a0, m0 = balance(client, alex, "alex"), balance(client, alex, "maya")
    r = client.post("/api/bucks/transactions", headers=alex,
                    json={"target_id": ids["maya"]["id"], "type": "give", "amount": 5, "reason": "thanks!"})
    assert r.status_code == 201
    assert balance(client, alex, "alex") == a0 - 5 and balance(client, alex, "maya") == m0 + 5
    r = client.post("/api/bucks/transactions", headers=maya,
                    json={"target_id": ids["alex"]["id"], "type": "take", "amount": 3, "reason": "messy desk"})
    assert r.status_code == 201
    assert balance(client, alex, "alex") == a0 - 8 and balance(client, alex, "maya") == m0 + 8


def test_cannot_overspend_or_self_transact(client, login):
    alex = login("alex")
    ids = users(client, alex)
    big = {"target_id": ids["maya"]["id"], "type": "give", "amount": 500, "reason": "too much"}
    assert client.post("/api/bucks/transactions", headers=alex, json=big).status_code == 400
    me = {"target_id": ids["alex"]["id"], "type": "give", "amount": 1, "reason": "me me"}
    assert client.post("/api/bucks/transactions", headers=alex, json=me).status_code == 400


def _take(client, actor_h, target_id, amount=7):
    r = client.post("/api/bucks/transactions", headers=actor_h,
                    json={"target_id": target_id, "type": "take", "amount": amount, "reason": "test take"})
    assert r.status_code == 201
    return r.json()


def _slot(client, h):
    return client.get("/api/bucks/time-slots", headers=h).json()[0]["id"]


def test_only_the_person_taken_from_can_appeal(client, login):
    """Liam takes from Maya -> only Maya can appeal. Liam can't, nor can anyone else."""
    liam, maya, alex = login("liam"), login("maya"), login("alex")
    tx = _take(client, liam, users(client, liam)["maya"]["id"])
    assert tx["can_appeal"] is False  # Liam's view
    maya_view = next(t for t in client.get("/api/bucks/transactions", headers=maya).json() if t["id"] == tx["id"])
    assert maya_view["can_appeal"] is True
    body = {"transaction_id": tx["id"], "reason": "I did clean it", "time_slot_id": _slot(client, maya)}
    assert client.post("/api/bucks/appeals", headers=liam, json=body).status_code == 403
    assert client.post("/api/bucks/appeals", headers=alex, json=body).status_code == 403
    assert client.post("/api/bucks/appeals", headers=maya, json=body).status_code == 201
    # one appeal per transaction
    assert client.post("/api/bucks/appeals", headers=maya, json=body).status_code == 400


def test_give_cannot_be_appealed(client, login):
    alex, maya = login("alex"), login("maya")
    r = client.post("/api/bucks/transactions", headers=alex,
                    json={"target_id": users(client, alex)["maya"]["id"], "type": "give", "amount": 1, "reason": "gift"})
    body = {"transaction_id": r.json()["id"], "reason": "why not", "time_slot_id": _slot(client, maya)}
    assert client.post("/api/bucks/appeals", headers=maya, json=body).status_code == 400


def test_time_slot_removed_when_booked_and_returned_when_resolved(client, login):
    liam, maya, sarah = login("liam"), login("maya"), login("sarah", "guide123")
    tx = _take(client, liam, users(client, liam)["maya"]["id"])
    before = {s["id"] for s in client.get("/api/bucks/time-slots", headers=maya).json()}
    slot = sorted(before)[0]
    ap = client.post("/api/bucks/appeals", headers=maya,
                     json={"transaction_id": tx["id"], "reason": "unfair!", "time_slot_id": slot}).json()
    assert slot not in {s["id"] for s in client.get("/api/bucks/time-slots", headers=maya).json()}
    client.post(f"/api/bucks/appeals/{ap['id']}/resolve", headers=sarah, json={"decision": "deny"})
    assert slot in {s["id"] for s in client.get("/api/bucks/time-slots", headers=maya).json()}


def test_council_resolves_and_approve_reverses(client, login):
    liam, maya, alex = login("liam"), login("maya"), login("alex")
    ids = users(client, alex)
    m0, l0 = balance(client, alex, "maya"), balance(client, alex, "liam")
    tx = _take(client, liam, ids["maya"]["id"], amount=10)
    ap = client.post("/api/bucks/appeals", headers=maya,
                     json={"transaction_id": tx["id"], "reason": "unfair!", "time_slot_id": _slot(client, maya)}).json()
    # Maya isn't on Council; Liam is but he's a party to the appeal.
    assert client.post(f"/api/bucks/appeals/{ap['id']}/resolve", headers=maya, json={"decision": "approve"}).status_code == 403
    assert client.post(f"/api/bucks/appeals/{ap['id']}/resolve", headers=liam, json={"decision": "approve"}).status_code == 403
    r = client.post(f"/api/bucks/appeals/{ap['id']}/resolve", headers=alex, json={"decision": "approve"})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert r.json()["transaction"]["is_reversed"] is True
    assert balance(client, alex, "maya") == m0 and balance(client, alex, "liam") == l0
    # resolved appeals leave the pending queue but status stays visible on the transaction
    assert all(a["id"] != ap["id"] for a in client.get("/api/bucks/appeals", headers=alex).json())


def test_goal_milestones_progress(client, login):
    alex = login("alex")
    g = client.post("/api/goals", headers=alex, json={"title": "Test", "milestones": ["a", "b"]}).json()
    assert g["progress"] == 0
    g = client.post(f"/api/goals/{g['id']}/milestones/{g['milestones'][0]['id']}/toggle", headers=alex).json()
    assert g["progress"] == 50
    assert client.get("/api/goals", headers=login("maya")).json() == [] or all(
        x["id"] != g["id"] for x in client.get("/api/goals", headers=login("maya")).json())


def test_badge_submit_and_review(client, login):
    maya, sarah = login("maya"), login("sarah", "guide123")
    badge = next(b for b in client.get("/api/badges", headers=maya).json() if b["my_status"] is None)
    r = client.post(f"/api/badges/{badge['id']}/submissions", headers=maya, json={"reflection": "I did it!"})
    assert r.status_code == 201
    sub = next(s for s in client.get("/api/badges/submissions", headers=sarah).json() if s["user"]["display_name"] == "Maya Lin")
    xp0 = client.get("/api/auth/me", headers=maya).json()["xp"]
    client.post(f"/api/badges/submissions/{sub['id']}/review", headers=sarah, json={"decision": "approve"})
    assert client.get("/api/auth/me", headers=maya).json()["xp"] == xp0 + badge["xp"]
