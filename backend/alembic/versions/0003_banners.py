"""banners table

Revision ID: 0003_banners
Revises: 0002_notifications
Create Date: 2025-10-04
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0003_banners'
down_revision = '0002_notifications'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'banners',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column('link_url', sa.String(length=500), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('ix_banners_position', 'banners', ['position'])


def downgrade():
    op.drop_index('ix_banners_position', table_name='banners')
    op.drop_table('banners')
