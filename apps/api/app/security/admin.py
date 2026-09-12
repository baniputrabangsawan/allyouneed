from dataclasses import dataclass
from hashlib import sha256
from secrets import token_urlsafe


@dataclass(frozen=True)
class AdminIdentity:
    admin_id: str
    email: str
    identity_provider: str = "password"


def new_token() -> str:
    return token_urlsafe(32)


def token_hash(token: str) -> str:
    return sha256(token.encode()).hexdigest()
