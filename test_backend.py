import requests
import json

def test_backend():
    base_url = "http://localhost:5000"
    
    # Test health check
    print("Testing health check...")
    try:
        response = requests.get(f"{base_url}/api/health")
        print(f"Health check status: {response.status_code}")
        print(f"Health check response: {response.json()}")
    except Exception as e:
        print(f"Health check failed: {e}")
        return
    
    # Test creating sample posts
    print("\nCreating sample posts...")
    try:
        response = requests.post(f"{base_url}/api/test/create-sample-posts")
        print(f"Create sample posts status: {response.status_code}")
        print(f"Create sample posts response: {response.json()}")
    except Exception as e:
        print(f"Create sample posts failed: {e}")
    
    # Test fetching posts
    print("\nFetching posts...")
    try:
        response = requests.get(f"{base_url}/api/posts")
        print(f"Fetch posts status: {response.status_code}")
        posts = response.json()
        print(f"Found {len(posts)} posts:")
        for post in posts:
            print(f"  - {post['repo_name']}: {post['idea']}")
    except Exception as e:
        print(f"Fetch posts failed: {e}")

if __name__ == "__main__":
    test_backend() 