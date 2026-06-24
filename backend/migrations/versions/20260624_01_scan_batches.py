"""Add reliable scan batches and align project/result columns."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20260624_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())

    # A fresh database gets the complete current schema in one pass.
    if "projects" not in tables:
        from app.database import Base
        import app.models  # noqa: F401

        Base.metadata.create_all(bind)
        return

    project_columns = {column["name"] for column in inspector.get_columns("projects")}
    if "description" not in project_columns:
        op.add_column("projects", sa.Column("description", sa.Text(), nullable=True))
    if "last_scheduled_scan_at" not in project_columns:
        op.add_column("projects", sa.Column("last_scheduled_scan_at", sa.DateTime(timezone=True), nullable=True))

    if "scan_batches" not in tables:
        op.create_table(
            "scan_batches",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("project_id", sa.Uuid(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="queued"),
            sa.Column("requested_model", sa.String(length=255), nullable=True),
            sa.Column("total_jobs", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("completed_jobs", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("failed_jobs", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_scan_batches_project_id", "scan_batches", ["project_id"])
        op.create_index("ix_scan_batches_status", "scan_batches", ["status"])
        op.create_index("ix_scan_batches_created_at", "scan_batches", ["created_at"])

    inspector = inspect(bind)
    result_columns = {column["name"] for column in inspector.get_columns("scan_results")}
    with op.batch_alter_table("scan_results") as batch_op:
        if "batch_id" not in result_columns:
            batch_op.add_column(sa.Column("batch_id", sa.Uuid(), nullable=True))
        if "error" not in result_columns:
            batch_op.add_column(sa.Column("error", sa.Text(), nullable=True))
        batch_op.alter_column("model", existing_type=sa.String(length=50), type_=sa.String(length=255))

    inspector = inspect(bind)
    result_indexes = {index["name"] for index in inspector.get_indexes("scan_results")}
    if "ix_scan_results_batch_id" not in result_indexes:
        op.create_index("ix_scan_results_batch_id", "scan_results", ["batch_id"])

    foreign_keys = {fk.get("name") for fk in inspector.get_foreign_keys("scan_results")}
    if "fk_scan_results_batch_id" not in foreign_keys:
        with op.batch_alter_table("scan_results") as batch_op:
            batch_op.create_foreign_key("fk_scan_results_batch_id", "scan_batches", ["batch_id"], ["id"])

    inspector = inspect(bind)
    unique_constraints = {constraint.get("name") for constraint in inspector.get_unique_constraints("scan_results")}
    if "uq_scan_result_batch_prompt_model" not in unique_constraints:
        with op.batch_alter_table("scan_results") as batch_op:
            batch_op.create_unique_constraint(
                "uq_scan_result_batch_prompt_model", ["batch_id", "prompt_id", "model"]
            )


def downgrade() -> None:
    with op.batch_alter_table("scan_results") as batch_op:
        batch_op.drop_constraint("uq_scan_result_batch_prompt_model", type_="unique")
        batch_op.drop_constraint("fk_scan_results_batch_id", type_="foreignkey")
        batch_op.drop_index("ix_scan_results_batch_id")
        batch_op.drop_column("error")
        batch_op.drop_column("batch_id")
        batch_op.alter_column("model", existing_type=sa.String(length=255), type_=sa.String(length=50))
    op.drop_table("scan_batches")
    op.drop_column("projects", "last_scheduled_scan_at")
    op.drop_column("projects", "description")
