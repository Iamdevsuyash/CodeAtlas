"""Application factory for the sample service."""

from flask import Flask

from auth.routes import auth_bp


def create_app():
    """Build and configure the Flask application."""
    app = Flask(__name__)
    app.register_blueprint(auth_bp)
    return app
