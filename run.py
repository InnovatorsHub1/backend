from app import create_app
from flask import jsonify

app = create_app()

@app.route('/')
def home():
    return jsonify({
        "message": "Flask API is running",
    }), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)