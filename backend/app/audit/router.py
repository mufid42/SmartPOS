from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, desc, func, or_
from sqlalchemy.orm import Session

from app.audit.categories import (
    ActivityCategory,
    category_filter,
    category_for,
    entity_name_for,
)
from app.audit.models import AuditLog
from app.audit.schemas import (
    ActivityLogItem,
    ActivityPage,
    ActivitySummary,
    AuditLogResponse,
)
from app.auth.dependencies import require_roles
from app.auth.models import User
from app.businesses.models import Business
from app.core.config import settings
from app.core.dates import utc_naive_bounds
from app.core.database import get_db
from app.members.models import ROLE_OWNER, BusinessMember

router = APIRouter(
    prefix="/businesses/{business_id}/audit",
    tags=["Audit"],
    dependencies=[Depends(require_roles("OWNER", "MANAGER"))],
)


@router.get("/", response_model=list[AuditLogResponse])
def list_audit_logs(
    business_id: int,
    entity_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).filter(AuditLog.business_id == business_id)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if action:
        query = query.filter(AuditLog.action == action)
    return (
        query.order_by(desc(AuditLog.created_at), desc(AuditLog.id))
        .offset(offset)
        .limit(limit)
        .all()
    )


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("/activity", response_model=ActivityPage)
def list_activity(
    business_id: int,
    q: str | None = Query(default=None, max_length=100),
    category: ActivityCategory | None = Query(default=None),
    role: str | None = Query(default=None, pattern="^(OWNER|MANAGER|CASHIER)$"),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Riwayat aktivitas dengan nama/role pengguna, pencarian (nama pengguna atau
    isi aktivitas), filter, dan paginasi.

    Hanya OWNER/MANAGER (dependensi router) dan hanya untuk ``business_id``
    pada path, yang sudah diverifikasi terhadap keanggotaan pengguna.
    """
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="Tanggal mulai tidak boleh setelah tanggal akhir",
        )

    role_expr = case(
        (AuditLog.user_id == Business.owner_user_id, ROLE_OWNER),
        else_=BusinessMember.role,
    )
    base = (
        db.query(AuditLog, User.full_name, role_expr.label("user_role"))
        .join(Business, Business.id == AuditLog.business_id)
        .outerjoin(User, User.id == AuditLog.user_id)
        .outerjoin(
            BusinessMember,
            (BusinessMember.business_id == AuditLog.business_id)
            & (BusinessMember.user_id == AuditLog.user_id),
        )
        .filter(AuditLog.business_id == business_id)
    )

    term = (q or "").strip()
    if term:
        pattern = f"%{_escape_like(term)}%"
        base = base.filter(
            or_(
                User.full_name.ilike(pattern, escape="\\"),
                AuditLog.description.ilike(pattern, escape="\\"),
            )
        )
    if category:
        base = base.filter(category_filter(category))
    if role:
        base = base.filter(role_expr == role)
    start_at, end_before = utc_naive_bounds(start_date, end_date)
    if start_at:
        base = base.filter(AuditLog.created_at >= start_at)
    if end_before:
        base = base.filter(AuditLog.created_at < end_before)

    total = base.with_entities(func.count(AuditLog.id)).order_by(None).scalar() or 0
    rows = (
        base.order_by(desc(AuditLog.created_at), desc(AuditLog.id))
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [
        ActivityLogItem(
            id=log.id,
            user_id=log.user_id,
            user_name=user_name,
            user_role=user_role,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            entity_name=entity_name_for(
                log.entity_type, log.before_data, log.after_data
            ),
            category=category_for(log.entity_type, log.action),
            description=log.description,
            before_data=log.before_data,
            after_data=log.after_data,
            created_at=log.created_at,
        )
        for log, user_name, user_role in rows
    ]
    return ActivityPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/summary", response_model=ActivitySummary)
def activity_summary(business_id: int, db: Session = Depends(get_db)):
    business = db.query(Business).filter(Business.id == business_id).first()
    if business is None:
        raise HTTPException(status_code=404, detail="Bisnis tidak ditemukan")

    scope = AuditLog.business_id == business_id
    total_activities = db.query(func.count(AuditLog.id)).filter(scope).scalar() or 0
    active_users = (
        db.query(func.count(func.distinct(AuditLog.user_id)))
        .filter(scope, AuditLog.user_id.isnot(None))
        .scalar()
        or 0
    )

    member_ids = {
        user_id
        for (user_id,) in db.query(BusinessMember.user_id).filter(
            BusinessMember.business_id == business_id,
            BusinessMember.is_active.is_(True),
        )
    }
    member_ids.add(business.owner_user_id)

    today = datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()
    start_at, end_before = utc_naive_bounds(today, today)
    activities_today = (
        db.query(func.count(AuditLog.id))
        .filter(scope, AuditLog.created_at >= start_at, AuditLog.created_at < end_before)
        .scalar()
        or 0
    )

    return ActivitySummary(
        total_activities=total_activities,
        total_users=len(member_ids),
        active_users=active_users,
        activities_today=activities_today,
    )
