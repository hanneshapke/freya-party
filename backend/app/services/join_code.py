"""Generate human-typable party join codes.

8 characters from an unambiguous alphabet (no 0/O/1/I/L) gives roughly
10^12 codes — ample headroom. The caller retries on unique-violation;
see services/parties.create_party.
"""

from __future__ import annotations

import secrets

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LENGTH = 8


def generate() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))
