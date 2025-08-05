import requests
import json

def test_discussions():
    base_url = "http://localhost:3001"
    
    # Test health check
    print("Testing discussions health check...")
    try:
        response = requests.get(f"{base_url}/api/health")
        print(f"Health check status: {response.status_code}")
        print(f"Health check response: {response.json()}")
    except Exception as e:
        print(f"Health check failed: {e}")
        return
    
    # Test fetching discussions
    print("\nFetching discussions...")
    try:
        response = requests.get(f"{base_url}/api/discussions")
        print(f"Fetch discussions status: {response.status_code}")
        discussions = response.json()
        print(f"Found {len(discussions)} discussions:")
        for discussion in discussions:
            print(f"  - {discussion['title']}: {discussion['content']}")
    except Exception as e:
        print(f"Fetch discussions failed: {e}")

if __name__ == "__main__":
    test_discussions() 