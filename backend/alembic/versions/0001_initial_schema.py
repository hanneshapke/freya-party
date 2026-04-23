"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-22

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", postgresql.CITEXT(), nullable=False, unique=True),
        sa.Column("stripe_customer_id", sa.String(), unique=True),
        sa.Column("stripe_subscription_id", sa.String()),
        sa.Column("subscription_status", sa.String()),
        sa.Column("current_period_end", sa.DateTime(timezone=True)),
        sa.Column("billing_exempt", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "parties",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "owner_user_id",
            sa.String(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("welcome_message", sa.String(2000)),
        sa.Column("join_code", postgresql.CITEXT(), nullable=False, unique=True),
        sa.Column("locale", sa.String(8), nullable=False, server_default=sa.text("'de'")),
        sa.Column("starts_at", sa.DateTime(timezone=True)),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
        sa.Column("frozen_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("id", "owner_user_id", name="uq_parties_id_owner"),
    )
    op.create_index("ix_parties_owner_user_id", "parties", ["owner_user_id"])

    op.create_table(
        "quests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "party_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("parties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.String(1000)),
        sa.Column("icon", sa.String(64)),
        sa.Column("xp", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.UniqueConstraint("id", "party_id", name="uq_quests_id_party"),
    )
    op.create_index("ix_quests_party_position", "quests", ["party_id", "position"])

    op.create_table(
        "guests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "party_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("parties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("session_token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("consent_recorded_at", sa.DateTime(timezone=True)),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("id", "party_id", name="uq_guests_id_party"),
    )
    op.create_index("ix_guests_party_id", "guests", ["party_id"])

    op.create_table(
        "submissions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "party_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("parties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("guest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message", sa.String(500)),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("flagged_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(
            ["party_id", "quest_id"],
            ["quests.party_id", "quests.id"],
            name="fk_submissions_party_quest",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["party_id", "guest_id"],
            ["guests.party_id", "guests.id"],
            name="fk_submissions_party_guest",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("quest_id", "guest_id", name="uq_submissions_quest_guest"),
    )
    op.create_index(
        "ix_submissions_party_submitted_at",
        "submissions",
        ["party_id", "submitted_at"],
    )

    op.create_table(
        "submission_photos",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "submission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("submissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("s3_key", sa.String(500), nullable=False, unique=True),
        sa.Column("content_type", sa.String(80), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer()),
        sa.Column("height", sa.Integer()),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_submission_photos_submission_id", "submission_photos", ["submission_id"]
    )

    op.create_table(
        "stripe_events",
        sa.Column("event_id", sa.String(), primary_key=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_stripe_events_received_at", "stripe_events", ["received_at"])


def downgrade() -> None:
    op.drop_index("ix_stripe_events_received_at", table_name="stripe_events")
    op.drop_table("stripe_events")

    op.drop_index("ix_submission_photos_submission_id", table_name="submission_photos")
    op.drop_table("submission_photos")

    op.drop_index("ix_submissions_party_submitted_at", table_name="submissions")
    op.drop_table("submissions")

    op.drop_index("ix_guests_party_id", table_name="guests")
    op.drop_table("guests")

    op.drop_index("ix_quests_party_position", table_name="quests")
    op.drop_table("quests")

    op.drop_index("ix_parties_owner_user_id", table_name="parties")
    op.drop_table("parties")

    op.drop_table("users")
