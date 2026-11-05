from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.database import get_db
from backend.models import User
from backend.schemas import UserRegister, UserLogin, UserResponse, Token, SupabaseSyncRequest
from backend.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    get_current_user_optional
)
from backend.services.activity_logger import log_activity

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name or user_in.email.split("@")[0].capitalize(),
        role=user_in.role or "member",
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await log_activity(
        action="USER_REGISTERED",
        message=f"User {user.email} registered with role {user.role}.",
        level="INFO"
    )
    return user

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    cred_target = credentials.email.strip().lower()
    result = await db.execute(
        select(User).where(
            (User.email.ilike(cred_target)) | (User.full_name.ilike(credentials.email.strip()))
        )
    )
    users = result.scalars().all()
    user = None
    for candidate in users:
        if verify_password(credentials.password, candidate.hashed_password):
            user = candidate
            break

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    await log_activity(
        action="USER_LOGIN",
        message=f"User {user.email} logged in successfully.",
        level="INFO"
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/token", response_model=Token)
async def login_oauth(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """OAuth2 form compliant endpoint for Swagger UI & token standard."""
    result = await db.execute(
        select(User).where(
            (User.email.ilike(form_data.username.strip())) | (User.full_name.ilike(form_data.username.strip()))
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/supabase-sync", response_model=Token)
async def supabase_sync(
    payload: SupabaseSyncRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where((User.id == payload.id) | (User.email == payload.email)))
    user = result.scalar_one_or_none()

    hashed_pwd = get_password_hash(payload.password) if payload.password else "supabase-managed"

    if not user:
        user = User(
            id=payload.id,
            email=payload.email,
            full_name=payload.username or payload.email.split("@")[0].capitalize(),
            hashed_password=hashed_pwd,
            role=payload.role or "member",
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        await log_activity(
            action="USER_REGISTERED_SUPABASE",
            message=f"User {user.email} synchronized from Supabase.",
            level="INFO"
        )
    else:
        changed = False
        if payload.password and (user.hashed_password == "supabase-managed" or not verify_password(payload.password, user.hashed_password)):
            user.hashed_password = hashed_pwd
            changed = True
        if payload.username and user.full_name != payload.username:
            user.full_name = payload.username
            changed = True
        if changed:
            await db.commit()
            await db.refresh(user)

    access_token = create_access_token(data={"sub": user.id, "email": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }
