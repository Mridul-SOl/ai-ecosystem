import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.config import settings
from backend.database import get_db
from backend.models import User

ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    if not token:
        return None
    user_id = None
    email = None
    user_metadata = {}
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        # Check if this is a Supabase JWT
        try:
            claims = jwt.get_unverified_claims(token)
            user_id = claims.get("sub")
            email = claims.get("email")
            user_metadata = claims.get("user_metadata") or {}
        except Exception:
            return None

    if not user_id:
        return None

    result = await db.execute(select(User).where((User.id == user_id) | (User.email == email) if email else (User.id == user_id)))
    user = result.scalar_one_or_none()

    # Auto-provision Supabase user in local SQLite if not already present
    if not user and email:
        username = user_metadata.get("username") or user_metadata.get("full_name") or email.split("@")[0]
        user = User(
            id=user_id,
            email=email,
            hashed_password="supabase-managed",
            full_name=username,
            role="member",
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if user is None or not user.is_active:
        return None
    return user

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user = await get_current_user_optional(token=token, db=db)
    if not user:
        raise credentials_exception
    return user
