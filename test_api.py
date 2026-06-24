"""GEOTrack AI — Script de test des API endpoints.

Usage:
    python3 test_api.py                          # Test complet
    python3 test_api.py --base https://domaine.fr/api  # Sur un déploiement distant
"""

import sys, json, os

try:
    import requests
except ImportError:
    print("pip install requests")
    sys.exit(1)

BASE = os.environ.get("API_BASE", "http://localhost:8000/api")

def req(method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = f"{BASE}{path}"
    try:
        r = requests.request(method, url, json=data, headers=headers, timeout=15)
        ok = "✅" if r.status_code < 400 else "❌"
        print(f"  {ok} {method} {path} -> {r.status_code}")
        if r.status_code < 400:
            return r.json()
        print(f"     {r.text[:300]}")
    except Exception as e:
        print(f"  ❌ {method} {path} -> {e}")
    return None

def main():
    # ── Health ──
    print("\n1️⃣  Health check")
    req("GET", "/health")

    # ── Login (le compte doit déjà exister) ──
    print("\n2️⃣  Login")
    login = req("POST", "/auth/login", {
        "email": "admin@geotrack.ai",
        "password": os.environ.get("ADMIN_PASSWORD", "admin123"),
    })
    if not login or not login.get("access_token"):
        print("   ❌ Login failed. Registering new account…")
        reg = req("POST", "/auth/register", {
            "email": "admin@geotrack.ai",
            "password": "admin123",
            "full_name": "Admin GEOTrack",
            "organization_name": "GEOTrack AI",
        })
        if not reg:
            print("   ❌ Cannot continue")
            return
        login = reg

    token = login["access_token"]
    print(f"   Token: {token[:40]}…")

    # ── Me ──
    print("\n3️⃣  Get current user")
    me = req("GET", "/auth/me", token=token)

    # ── Projects ──
    print("\n4️⃣  Create project")
    project = req("POST", "/projects", {
        "name": "Cabesto Piscine",
        "target_url": "www.cabesto.com",
        "brand_names": ["Cabesto"],
        "enabled_models": ["chatgpt", "claude", "perplexity", "gemini"],
    }, token=token)

    print("\n5️⃣  List projects")
    req("GET", "/projects", token=token)

    if project and project.get("id"):
        pid = project["id"]

        print(f"\n6️⃣  Get project {pid[:8]}…")
        req("GET", f"/projects/{pid}", token=token)

        print("\n7️⃣  Add prompts (questions)")
        req("POST", f"/projects/{pid}/prompts", {
            "texts": [
                "constructeur piscine Aubagne",
                "prix piscine coque Marseille",
                "entretien piscine pas cher",
            ]
        }, token=token)

        print("\n8️⃣  List prompts")
        req("GET", f"/projects/{pid}/prompts", token=token)

        print("\n9️⃣  Trigger scan")
        req("POST", f"/projects/{pid}/scan", token=token)

        print("\n🔟  Get latest results")
        req("GET", f"/projects/{pid}/results/latest", token=token)

        print("\n1️⃣1️⃣  Update project")
        req("PATCH", f"/projects/{pid}", {
            "name": "Cabesto Piscine (prod)",
            "frequency": "weekly",
        }, token=token)

        # Cleanup: delete test project
        print(f"\n🧹  Delete project {pid[:8]}…")
        req("DELETE", f"/projects/{pid}", token=token)

    print("\n✅ All tests done!")

if __name__ == "__main__":
    # Parse --base argument
    for i, a in enumerate(sys.argv[1:]):
        if a.startswith("--base="):
            BASE = a.split("=", 1)[1]
        elif a == "--base" and i + 1 < len(sys.argv):
            BASE = sys.argv[i + 2]
    main()
