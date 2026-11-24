class ActivityLogItem(BaseModel):
    id: int
    user_id: int | None
    user_name: str | None
    user_role: str | None
    action: str
    entity_type: str
    entity_id: int | None
    entity_name: str | None
    category: str
    description: str | None
    before_data: dict[str, Any] | None
    after_data: dict[str, Any] | None
    created_at: datetime


class ActivityPage(BaseModel):
    items: list[ActivityLogItem]
    total: int
    limit: int
    offset: int


class ActivitySummary(BaseModel):
    total_activities: int
    total_users: int
    active_users: int
    activities_today: int
