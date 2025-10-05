"""add notifications table

Revision ID: 0002_notifications
Revises: 0001_initial
Create Date: 2025-10-04
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_notifications'
down_revision = '0001_initial'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_email', sa.String(length=255), nullable=False),  # explicit index created below
        sa.Column('type', sa.String(length=64), nullable=False),
        sa.Column('message', sa.String(length=1024), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('read', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.create_index('ix_notifications_user_email', 'notifications', ['user_email'])

def downgrade():
    op.drop_index('ix_notifications_user_email', table_name='notifications')
    op.drop_table('notifications')
