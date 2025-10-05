"""offers table

Revision ID: 0004_offers
Revises: 0003_banners
Create Date: 2025-10-05
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0004_offers'
down_revision = '0003_banners'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'offers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('subtitle', sa.String(length=300), nullable=True),
        sa.Column('price_from', sa.Numeric(10,2), nullable=True),
        sa.Column('flight_ref', sa.String(length=50), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('TRUE')),
    # SQLite не поддерживает NOW(); используем CURRENT_TIMESTAMP для кросс-СУБД простоты
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_offers_position', 'offers', ['position'])


def downgrade():
    op.drop_index('ix_offers_position', table_name='offers')
    op.drop_table('offers')
