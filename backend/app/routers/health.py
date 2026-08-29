from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(tags=["Administration"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)) -> dict:
    """NFR-02: process and database ready; contains no secrets."""
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
