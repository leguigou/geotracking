import httpx, json, sys

BASE = "http://localhost:8000/api"
results = []

def test(name, method, path, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "POST":
            r = httpx.post(f"{BASE}{path}", json=data, headers=headers, timeout=10)
        elif method == "GET":
            r = httpx.get(f"{BASE}{path}", headers=headers, timeout=10)
        else:
            r = httpx.request(method, f"{BASE}{path}", json=data, headers=headers, timeout=10)
        
        status = "✅" if r.status_code < 400 else "❌"
        print(f"  {status} {method} {path} -> {r.status_code}")
        if r.status_code < 400:
            return r.json()
        else:
            print(f"     Error: {r.text[:200]}")
            return None
    except Exception as e:
        print(f"  ❌ {method} {path} -> ERROR: {e}")
        return None

# Test 1: Health
print("\n1. Health check")
test("health", "GET", "/health")

# Test 2: Register
print("\n2. Register")
reg = test("register", "POST", "/auth/register", {
    "email": "admin@geotrack.ai",
    "password": "Test123!",
    "full_name": "Admin GEOTrack",
    "organization_name": "GEOTrack AI"
})

# Test 3: Login
print("\n3. Login")
if reg:
    login = test("login", "POST", "/auth/login", {
        "email": "admin@geotrack.ai",
        "password": "Test123!"
    })
else:
    login = test("login", "POST", "/auth/login", {
        "email": "admin@geotrack.ai",
        "password": "Test123!"
    })

token = login.get("access_token") if login and isinstance(login, dict) else None
if not token:
    print("  ❌ No token, stopping")
    sys.exit(1)

print(f"  Token: {token[:40]}...")

# Test 4: Me
print("\n4. Get current user")
test("me", "GET", "/auth/me", token=token)

# Test 5: Create project
print("\n5. Create project")
project = test("create", "POST", "/projects/", {
    "name": "Test Site Piscines",
    "target_url": "https://www.monsite-piscine.com",
    "brand_names": ["Monsite Piscine", "Piscines Pro"],
    "enabled_models": ["chatgpt", "claude", "gemini", "perplexity"],
    "frequency": "daily"
}, token=token)

# Test 6: List projects
print("\n6. List projects")
test("list", "GET", "/projects/", token=token)

# Test 7: Get project
if project and isinstance(project, dict):
    pid = project.get("id")
    print(f"\n7. Get project {pid}")
    test("get", "GET", f"/projects/{pid}", token=token)
    
    # Test 8: Add prompts
    print("\n8. Add prompts")
    prompts = test("add_prompts", "POST", f"/projects/{pid}/prompts", {
        "texts": [
            "Je cherche un constructeur de piscine sur Aubagne, des recommandations ?",
            "Quelle entreprise de piscine est la meilleure pres de Marseille ?",
            "Piscine coque ou beton ? Quel professionnel choisir ?"
        ]
    }, token=token)
    
    # Test 9: List prompts
    print("\n9. List prompts")
    test("list_prompts", "GET", f"/projects/{pid}/prompts", token=token)

print("\n✅ All tests completed!")
