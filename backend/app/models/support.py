from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel, Field

TicketCategory = str
TicketStatus = Literal["open", "in_progress", "resolved", "closed"]
TicketPriority = str

class SupportTicket(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    category: TicketCategory
    subject: str
    description: str
    priority: TicketPriority = "normal"
    screenshot_url: Optional[str] = None
    status: TicketStatus = "open"
    admin_response: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: str
    updated_at: str

class SupportTicketCreate(BaseModel):
    category: TicketCategory = "bug"
    subject: str = Field(..., min_length=3, max_length=150)
    description: str = Field(..., min_length=10, max_length=3000)
    priority: TicketPriority = "normal"
    screenshot_url: Optional[str] = None

class SupportTicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    admin_response: Optional[str] = None
    priority: Optional[TicketPriority] = None
