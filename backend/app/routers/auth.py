import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import create_token, hash_password, verify_password
from app.db.session import get_db
from app.models.kyc import User
from app.schemas.kyc_schemas import TokenPair, UserCreate, UserOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    existing = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
) -> TokenPair:
    # OAuth2PasswordRequestForm exposes the submitted email in `.username` —
    # that's the spec's field name, not a typo; we treat it as the email.
    user = (await db.execute(select(User).where(User.email == form_data.username))).scalar_one_or_none()
    if user is None or not verify_password(form_data.password, user.password_hash):
        # Deliberately identical error for "no such user" and "wrong password" —
        # distinguishing them is a user-enumeration vector.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access = create_token(
        user.id, user.role, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), "access"
    )
    refresh = create_token(
        user.id, user.role, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), "refresh"
    )
    return TokenPair(access_token=access, refresh_token=refresh)
