"""Short-lived walk tickets: the web server vouches for the logged-in account name to the multiplayer server.

Format: base64url(JSON {"name", "exp"}) + "." + hex HMAC-SHA256 of that base64 text, keyed with
WALK_TICKET_SECRET shared by both servers. The multiplayer server takes the player's name only from a valid ticket.
"""
import base64
import hashlib
import hmac
import json
import time

TTL_SECONDS = 60


def make_ticket(name, secret, now=None, ttl=TTL_SECONDS):
    payload = base64.urlsafe_b64encode(json.dumps({'name': name, 'exp': int((now or time.time()) + ttl)}, ensure_ascii=False).encode()).decode().rstrip('=')
    signature = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f'{payload}.{signature}'
