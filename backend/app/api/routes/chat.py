from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, and_, desc, func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.permissions import require_farm_access, require_enterprise_access
from app.db.session import get_db
from app.models.conversation import Conversation, ConversationMember, Message
from app.models.user import User
from app.models.enterprise import Enterprise
from app.models.farm import Farm
from app.models.farm_membership import FarmMembership
from app.schemas.conversation import (
    ConversationCreate,
    ConversationResponse,
    ConversationDetailResponse,
    MessageCreate,
    MessageResponse,
    ConversationMemberResponse,
)

router = APIRouter(prefix="/chat", tags=["Chat"])
MAX_MESSAGES_PER_CONVERSATION = 200


@router.get("/contacts")
def list_chat_contacts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    enterprise = _get_user_enterprise(current_user, db)
    if not enterprise:
        raise HTTPException(status_code=403, detail="No active enterprise access")
    member_ids = db.execute(
        select(FarmMembership.user_id).join(Farm, FarmMembership.farm_id == Farm.id).join(Enterprise, Farm.enterprise_id == Enterprise.id).where(
            Farm.enterprise_id == enterprise.id, FarmMembership.is_active.is_(True), Farm.active.is_(True)
        )
    ).scalars().all()
    ids = set(member_ids) | {enterprise.owner_id}
    return [{"id": user.id, "name": user.name, "email": user.email, "role": user.role} for user in db.execute(select(User).where(User.id.in_(ids), User.is_active.is_(True)).order_by(User.name)).scalars().all()]


def _get_user_enterprise(user: User, db: Session) -> Enterprise | None:
    """Resolve the enterprise for owners and farm members."""
    if user.role == "OWNER":
        return db.execute(select(Enterprise).where(Enterprise.owner_id == user.id, Enterprise.is_active.is_(True))).scalars().first()
    return db.execute(
        select(Enterprise).join(Farm, Farm.enterprise_id == Enterprise.id).join(FarmMembership, FarmMembership.farm_id == Farm.id)
        .where(FarmMembership.user_id == user.id, FarmMembership.is_active.is_(True), Farm.active.is_(True), Enterprise.is_active.is_(True))
    ).scalars().first()


def _can_access_conversation(user: User, conversation: Conversation, db: Session) -> bool:
    """Check if user can access a conversation"""
    member = db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation.id,
                ConversationMember.user_id == user.id,
            )
        )
    ).scalars().first()
    return member is not None


def _get_unread_count(conversation_id: int, user_id: int, db: Session) -> int:
    """Get unread message count for a user in a conversation"""
    member = db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
            )
        )
    ).scalars().first()

    if not member or not member.last_read_at:
        return db.execute(
            select(func.count(Message.id)).where(
                and_(
                    Message.conversation_id == conversation_id,
                    Message.deleted_at.is_(None),
                )
            )
        ).scalar() or 0

    return db.execute(
        select(func.count(Message.id)).where(
            and_(
                Message.conversation_id == conversation_id,
                Message.created_at > member.last_read_at,
                Message.deleted_at.is_(None),
            )
        )
    ).scalar() or 0


def _get_last_message(conversation_id: int, db: Session) -> MessageResponse | None:
    """Get the last message in a conversation"""
    message = db.execute(
        select(Message)
        .where(
            and_(
                Message.conversation_id == conversation_id,
                Message.deleted_at.is_(None),
            )
        )
        .order_by(desc(Message.created_at))
        .limit(1)
    ).scalars().first()

    if not message:
        return None

    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=message.sender.name,
        content=message.content,
        message_type=message.message_type,
        read_at=message.read_at,
        created_at=message.created_at,
    )


@router.get("/conversations", response_model=list[ConversationResponse])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all conversations for the current user"""
    members = db.execute(
        select(ConversationMember).where(
            ConversationMember.user_id == current_user.id
        )
    ).scalars().all()

    conversations = []
    for member in members:
        conversation = member.conversation
        last_message = _get_last_message(conversation.id, db)
        unread_count = _get_unread_count(conversation.id, current_user.id, db)

        # Convert members
        member_responses = []
        for m in conversation.members:
            member_responses.append(
                ConversationMemberResponse(
                    id=m.id,
                    user_id=m.user_id,
                    user_name=m.user.name,
                    joined_at=m.joined_at,
                    last_read_at=m.last_read_at,
                )
            )

        conversations.append(
            ConversationResponse(
                id=conversation.id,
                enterprise_id=conversation.enterprise_id,
                farm_id=conversation.farm_id,
                name=conversation.name,
                description=conversation.description,
                conversation_type=conversation.conversation_type,
                created_by=conversation.created_by,
                created_at=conversation.created_at,
                updated_at=conversation.updated_at,
                members=member_responses,
                last_message=last_message,
                unread_count=unread_count,
            )
        )

    # Sort by last message date
    conversations.sort(
        key=lambda c: c.last_message.created_at if c.last_message else c.created_at,
        reverse=True,
    )

    return conversations


@router.post("/conversations", response_model=ConversationResponse, status_code=201)
def create_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new conversation"""
    enterprise = _get_user_enterprise(current_user, db)

    if not enterprise:
        raise HTTPException(status_code=403, detail="No active enterprise access")

    valid_ids = set(db.execute(
        select(FarmMembership.user_id).join(Farm, FarmMembership.farm_id == Farm.id).where(
            Farm.enterprise_id == enterprise.id, FarmMembership.is_active.is_(True), Farm.active.is_(True)
        )
    ).scalars().all()) | {enterprise.owner_id}
    if any(user_id not in valid_ids for user_id in data.member_ids):
        raise HTTPException(status_code=400, detail="All conversation members must belong to this enterprise")

    # Validate farm if provided
    if data.farm_id:
        try:
            require_farm_access(current_user, data.farm_id, db)
        except HTTPException:
            raise HTTPException(status_code=403, detail="No access to this farm")

    # Create conversation
    conversation = Conversation(
        enterprise_id=enterprise.id,
        farm_id=data.farm_id,
        name=data.name,
        description=data.description,
        conversation_type=data.conversation_type,
        created_by=current_user.id,
    )
    db.add(conversation)
    db.flush()

    # Add members
    members_to_add = list(dict.fromkeys(data.member_ids or []))
    if current_user.id not in members_to_add:
        members_to_add.append(current_user.id)
    if data.conversation_type == "DIRECT" and len(members_to_add) != 2:
        raise HTTPException(status_code=422, detail="A direct conversation must have exactly two members")
    if data.conversation_type != "DIRECT" and len(members_to_add) < 2:
        raise HTTPException(status_code=422, detail="A group conversation must have at least two members")

    requested_members = set(members_to_add)
    existing_conversations = db.execute(
        select(Conversation).where(
            Conversation.enterprise_id == enterprise.id,
            Conversation.conversation_type == data.conversation_type,
            Conversation.farm_id == data.farm_id,
        )
    ).scalars().all()
    for existing in existing_conversations:
        if {member.user_id for member in existing.members} == requested_members:
            raise HTTPException(status_code=409, detail="This conversation already exists")

    for user_id in members_to_add:
        member = ConversationMember(
            conversation_id=conversation.id,
            user_id=user_id,
        )
        db.add(member)

    db.commit()
    db.refresh(conversation)

    return ConversationResponse(
        id=conversation.id,
        enterprise_id=conversation.enterprise_id,
        farm_id=conversation.farm_id,
        name=conversation.name,
        description=conversation.description,
        conversation_type=conversation.conversation_type,
        created_by=conversation.created_by,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        members=[
            ConversationMemberResponse(
                id=m.id,
                user_id=m.user_id,
                user_name=m.user.name,
                joined_at=m.joined_at,
                last_read_at=m.last_read_at,
            )
            for m in conversation.members
        ],
        last_message=None,
        unread_count=0,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: int,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get conversation details with messages"""
    conversation = db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    ).scalars().first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not _can_access_conversation(current_user, conversation, db):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get messages
    messages = db.execute(
        select(Message)
        .where(
            and_(
                Message.conversation_id == conversation_id,
                Message.deleted_at.is_(None),
            )
        )
        .order_by(desc(Message.created_at))
        .limit(limit)
    ).scalars().all()

    messages.reverse()  # Show oldest first

    message_responses = [
        MessageResponse(
            id=m.id,
            conversation_id=m.conversation_id,
            sender_id=m.sender_id,
            sender_name=m.sender.name,
            content=m.content,
            message_type=m.message_type,
            read_at=m.read_at,
            created_at=m.created_at,
        )
        for m in messages
    ]

    # Update last_read_at for current user
    member = db.execute(
        select(ConversationMember).where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == current_user.id,
            )
        )
    ).scalars().first()

    if member:
        member.last_read_at = datetime.utcnow()
        db.commit()

    member_responses = [
        ConversationMemberResponse(
            id=m.id,
            user_id=m.user_id,
            user_name=m.user.name,
            joined_at=m.joined_at,
            last_read_at=m.last_read_at,
        )
        for m in conversation.members
    ]

    return ConversationDetailResponse(
        id=conversation.id,
        enterprise_id=conversation.enterprise_id,
        farm_id=conversation.farm_id,
        name=conversation.name,
        description=conversation.description,
        conversation_type=conversation.conversation_type,
        created_by=conversation.created_by,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        members=member_responses,
        messages=message_responses,
        last_message=message_responses[-1] if message_responses else None,
        unread_count=0,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=201)
def send_message(
    conversation_id: int,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to a conversation"""
    conversation = db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    ).scalars().first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if not _can_access_conversation(current_user, conversation, db):
        raise HTTPException(status_code=403, detail="Access denied")

    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=data.content,
        message_type=data.message_type,
    )
    db.add(message)
    conversation.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(message)

    old_message_ids = db.execute(
        select(Message.id)
        .where(
            Message.conversation_id == conversation_id,
            Message.deleted_at.is_(None),
        )
        .order_by(desc(Message.created_at), desc(Message.id))
        .offset(MAX_MESSAGES_PER_CONVERSATION)
    ).scalars().all()
    if old_message_ids:
        db.execute(
            update(Message)
            .where(Message.id.in_(old_message_ids))
            .values(deleted_at=datetime.utcnow())
        )
        db.commit()

    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=current_user.name,
        content=message.content,
        message_type=message.message_type,
        read_at=message.read_at,
        created_at=message.created_at,
    )


@router.delete("/messages/{message_id}", status_code=204)
def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a message (soft delete)"""
    message = db.execute(
        select(Message).where(Message.id == message_id)
    ).scalars().first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete own messages")

    message.deleted_at = datetime.utcnow()
    db.commit()

    return None
