FABRICATED_TELEMETRY_KEYS = ("gpu_utilization_pct", "model_uptime_pct", "memory_pct")


def test_dashboard_reports_no_fabricated_gpu_or_uptime(auth_client):
    response = auth_client.get("/api/dashboard/stats")
    assert response.status_code == 200, response.text
    health = response.json().get("system_health", {})
    for key in FABRICATED_TELEMETRY_KEYS:
        assert key not in health, f"{key} is fabricated telemetry — remove it"


def test_dashboard_api_latency_is_measured_not_hardcoded(auth_client):
    response = auth_client.get("/api/dashboard/stats")
    health = response.json().get("system_health", {})
    if "api_latency_ms" in health:
        assert health["api_latency_ms"] != 42, "42 was the hardcoded value"


def test_agent_performance_reports_no_invented_accuracy(auth_client):
    response = auth_client.get("/api/dashboard/stats")
    for agent in response.json().get("agent_performance", []):
        assert "accuracy" not in agent, "accuracy was invented from confidence"
