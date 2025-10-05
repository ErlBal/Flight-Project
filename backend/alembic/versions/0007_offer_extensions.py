"""extend offer with tag, description, mode, click_count

Revision ID: 0007_offer_extensions
Revises: 0006_banner_url_text
Create Date: 2025-10-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0007_offer_extensions'
down_revision: Union[str, None] = '0006_banner_url_text'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('offers', sa.Column('tag', sa.String(length=32), nullable=True))
    op.add_column('offers', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('offers', sa.Column('mode', sa.String(length=16), server_default='interactive', nullable=False))
    op.add_column('offers', sa.Column('click_count', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('offers', 'click_count')
    op.drop_column('offers', 'mode')
    op.drop_column('offers', 'description')
    op.drop_column('offers', 'tag')
