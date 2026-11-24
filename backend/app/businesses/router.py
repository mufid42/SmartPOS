from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.audit.service import record_audit, snapshot
from app.auth.dependencies import (
    authorize_business_access,
    get_current_user,
    require_roles,
)
from app.auth.models import User
from app.businesses.models import Business
from app.businesses.schemas import BusinessResponse, BusinessUpdate
from app.core.database import get_db

router = APIRouter(
    prefix="/businesses/{business_id}",
    tags=["Businesses"],
    dependencies=[Depends(authorize_business_access)],
)


@router.get("", response_model=BusinessResponse)
def get_business(business: Business = Depends(authorize_business_access)):
    return business


@router.patch(
    "",
    response_model=BusinessResponse,
    dependencies=[Depends(require_roles("OWNER"))],
)
def update_business(
    business_data: BusinessUpdate,
    business: Business = Depends(authorize_business_access),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fields = ("name", "category", "location")
    before = snapshot(business, fields)
    business.name = business_data.name
    business.category = business_data.category
    business.location = business_data.location
    after = snapshot(business, fields)
    if after != before:
        record_audit(
            db,
            business_id=business.id,
            user_id=current_user.id,
            action="UPDATE",
            entity_type="BUSINESS",
            entity_id=business.id,
            description="Mengubah profil toko",
            before_data=before,
            after_data=after,
        )
    db.commit()
    db.refresh(business)
    return business


