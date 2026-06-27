"""Persist GEO audit reports.

Revision ID: 20260627_02
Revises: 20260624_01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260627_02"
down_revision = "20260624_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "geo_audits" in set(inspect(bind).get_table_names()):
        return
    op.create_table(
        "geo_audits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("source_audit_id", sa.Uuid(), nullable=True),
        sa.Column("requested_url", sa.Text(), nullable=False),
        sa.Column("final_url", sa.Text(), nullable=False),
        sa.Column("brand", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("use_ai", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("ai_model", sa.String(length=255), nullable=True),
        sa.Column("report", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["source_audit_id"], ["geo_audits.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_geo_audits_organization_id", "geo_audits", ["organization_id"])
    op.create_index("ix_geo_audits_user_id", "geo_audits", ["user_id"])
    op.create_index("ix_geo_audits_created_at", "geo_audits", ["created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    if "geo_audits" not in set(inspect(bind).get_table_names()):
        return
    op.drop_index("ix_geo_audits_created_at", table_name="geo_audits")
    op.drop_index("ix_geo_audits_user_id", table_name="geo_audits")
    op.drop_index("ix_geo_audits_organization_id", table_name="geo_audits")
    op.drop_table("geo_audits")
