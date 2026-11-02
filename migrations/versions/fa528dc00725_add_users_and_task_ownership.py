
"""Add users and task ownership

Revision ID: fa528dc00725
Revises:
Create Date: 2026-10-31 13:41:18.995418
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "fa528dc00725"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.add_column(
        "tasks",
        sa.Column("owner_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_tasks_owner_id_users",
        "tasks",
        "users",
        ["owner_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_tasks_owner_id_users",
        "tasks",
        type_="foreignkey",
    )

    op.drop_column("tasks", "owner_id")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")

    op.drop_table("users")
