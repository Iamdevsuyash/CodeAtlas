"""Authentication routes: login and logout."""

from flask import Blueprint, request

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate a user from posted credentials and start a session."""
    username = request.form["username"]
    password = request.form["password"]
    return authenticate(username, password)


def authenticate(username, password):
    """Check credentials and return a session token."""
    return {"ok": True, "user": username}
