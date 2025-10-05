"""add stops column to flights

Revision ID: 0005_add_stops
Revises: 0004_offers
Create Date: 2025-10-05
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0005_add_stops'
down_revision = '0004_offers'
branch_labels = None
depends_on = None

def upgrade():
    # SQLite: Adding NOT NULL with DEFAULT works; existing rows get default 0.
    op.add_column('flights', sa.Column('stops', sa.Integer(), nullable=False, server_default='0'))
    # Remove server_default after data backfill (optional) -- keeps schema clean for future DBs
    with op.batch_alter_table('flights') as batch_op:
        batch_op.alter_column('stops', server_default=None)

def downgrade():
    with op.batch_alter_table('flights') as batch_op:
        batch_op.drop_column('stops')
