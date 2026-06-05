import sys
import requests

def test_admin_flow():
    base_url = "http://127.0.0.1:8000"
    
    # 1. Test Admin Login
    print("Testing admin login...")
    login_url = f"{base_url}/api/auth/login"
    login_payload = {
        "email": "admin@example.com",
        "password": "ChangeMe123@"
    }
    
    try:
        response = requests.post(login_url, json=login_payload)
        if response.status_code != 200:
            print(f"FAILED: Login response status code is {response.status_code}")
            print(response.text)
            sys.exit(1)
            
        data = response.json()
        token = data.get("token")
        user = data.get("user", {})
        
        print(f"SUCCESS: Logged in! Token: {token[:15]}...")
        print(f"User profile in response: {user}")
        
        if user.get("role") != "admin":
            print(f"FAILED: Expected role to be 'admin', got '{user.get('role')}'")
            sys.exit(1)
            
    except Exception as e:
        print(f"FAILED: Connection error during login: {e}")
        sys.exit(1)
        
    # 2. Test Get Me Profile
    print("\nTesting GET /api/auth/me profile...")
    me_url = f"{base_url}/api/auth/me"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        me_response = requests.get(me_url, headers=headers)
        if me_response.status_code != 200:
            print(f"FAILED: Profile status is {me_response.status_code}")
            sys.exit(1)
            
        me_user = me_response.json()
        print(f"SUCCESS: Got profile: {me_user}")
        if me_user.get("role") != "admin":
            print(f"FAILED: Expected profile role to be 'admin', got '{me_user.get('role')}'")
            sys.exit(1)
    except Exception as e:
        print(f"FAILED: Connection error during profile fetch: {e}")
        sys.exit(1)

    # 3. Test Admin Stats Route (Authorized)
    print("\nTesting GET /api/admin/stats (Authorized)...")
    stats_url = f"{base_url}/api/admin/stats"
    
    try:
        stats_response = requests.get(stats_url, headers=headers)
        if stats_response.status_code != 200:
            print(f"FAILED: Stats response status is {stats_response.status_code}")
            print(stats_response.text)
            sys.exit(1)
            
        stats_data = stats_response.json()
        print("SUCCESS: Retrieved stats data:")
        print(stats_data)
    except Exception as e:
        print(f"FAILED: Connection error during stats fetch: {e}")
        sys.exit(1)

    # 4. Test Admin Stats Route (Unauthorized without Token)
    print("\nTesting GET /api/admin/stats (Unauthorized - no token)...")
    try:
        unauth_response = requests.get(stats_url)
        print(f"Response code (expected 401/403): {unauth_response.status_code}")
        if unauth_response.status_code not in [401, 403]:
            print("FAILED: Expected unauthorized status code.")
            sys.exit(1)
        print("SUCCESS: Properly blocked unauthorized access.")
    except Exception as e:
        print(f"FAILED: Connection error: {e}")
        sys.exit(1)

    # 5. Test Admin Stats Route (Forbidden - standard user token)
    # Let's register a temp user, login, and try to access admin route
    print("\nTesting GET /api/admin/stats (Forbidden - standard user token)...")
    reg_url = f"{base_url}/api/auth/register"
    reg_payload = {
        "name": "Standard User Test",
        "email": "test_standard_user@pashucare.ai",
        "password": "UserPassword123!"
    }
    
    user_token = None
    try:
        # Register if not exists
        reg_res = requests.post(reg_url, json=reg_payload)
        if reg_res.status_code == 200:
            user_token = reg_res.json().get("token")
        else:
            # Try login
            login_res = requests.post(login_url, json={"email": reg_payload["email"], "password": reg_payload["password"]})
            if login_res.status_code == 200:
                user_token = login_res.json().get("token")
                
        if not user_token:
            print("Skipping step 5: Could not obtain standard user token")
        else:
            forb_response = requests.get(stats_url, headers={"Authorization": f"Bearer {user_token}"})
            print(f"Response code (expected 403): {forb_response.status_code}")
            if forb_response.status_code != 403:
                print("FAILED: Expected 403 Forbidden for standard user.")
                sys.exit(1)
            print("SUCCESS: Properly blocked standard user from accessing admin route.")
    except Exception as e:
        print(f"FAILED: Connection error: {e}")
        sys.exit(1)

    print("\nALL ADMIN TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_admin_flow()
