"""Miscellaneous helper utilities."""


def slugify(text):
    """Turn a string into a URL-friendly slug."""
    return text.strip().lower().replace(" ", "-")
