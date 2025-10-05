"""add ticket_reminders table

Revision ID: 0008_ticket_reminders
Revises: 0007_offer_extensions
Create Date: 2025-10-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0008_ticket_reminders'
down_revision: Union[str, None] = '0007_offer_extensions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'ticket_reminders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ticket_id', sa.Integer(), sa.ForeignKey('tickets.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('user_email', sa.String(length=255), index=True, nullable=False),
        sa.Column('hours_before', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=16), nullable=False, server_default='custom'),
        sa.Column('scheduled_at', sa.DateTime(), nullable=False),
        sa.Column('sent', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    # useful composite index for due scanning
    op.create_index('ix_ticket_reminders_due', 'ticket_reminders', ['sent','scheduled_at'])


def downgrade() -> None:
    op.drop_index('ix_ticket_reminders_due', table_name='ticket_reminders')
    op.drop_table('ticket_reminders')
