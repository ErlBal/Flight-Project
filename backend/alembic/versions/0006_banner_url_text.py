"""widen banner url columns to TEXT

Revision ID: 0006_banner_url_text
Revises: 0005_add_stops
Create Date: 2025-10-05
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0006_banner_url_text'
down_revision = '0005_add_stops'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Widen image_url and link_url from VARCHAR(500) to TEXT (Postgres: no length limit) for long marketing / tracking links.
    with op.batch_alter_table('banners') as batch:
        batch.alter_column('image_url', existing_type=sa.String(length=500), type_=sa.Text(), existing_nullable=True)
        batch.alter_column('link_url', existing_type=sa.String(length=500), type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    # Narrow back to VARCHAR(500). Data longer than 500 would be truncated if present; safer to raise if exists, but we keep simple.
    with op.batch_alter_table('banners') as batch:
        batch.alter_column('image_url', existing_type=sa.Text(), type_=sa.String(length=500), existing_nullable=True)
        batch.alter_column('link_url', existing_type=sa.Text(), type_=sa.String(length=500), existing_nullable=True)
