def test_health_endpoint_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_app_boots_without_api_keys(client, no_api_keys):
    """The app must start even with no AI providers configured.
    It should fail at inference time, not at boot time."""
    response = client.get("/health")
    assert response.status_code == 200
