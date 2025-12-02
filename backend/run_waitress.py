from waitress import serve
from app import app

if __name__ == "__main__":
    print("Starting Waitress on port 8084...")
    serve(app, host="0.0.0.0", port=8084)
