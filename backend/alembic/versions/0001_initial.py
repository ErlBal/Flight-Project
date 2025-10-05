"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2025-10-04
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('companies',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False, unique=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true'))
    )
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=32), nullable=False, server_default='user'),
    sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.UniqueConstraint('email'),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_table('flights',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('airline', sa.String(length=255), nullable=False),
        sa.Column('flight_number', sa.String(length=50), nullable=False),
        sa.Column('origin', sa.String(length=32), nullable=False),
        sa.Column('destination', sa.String(length=32), nullable=False),
        sa.Column('departure', sa.DateTime(), nullable=False),
        sa.Column('arrival', sa.DateTime(), nullable=False),
        sa.Column('price', sa.Numeric(10,2), nullable=False),
        sa.Column('seats_total', sa.Integer(), nullable=False),
        sa.Column('seats_available', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id')),
    )
    op.create_table('tickets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('confirmation_id', sa.String(length=32), nullable=False),
        sa.Column('user_email', sa.String(length=255), nullable=False),
        sa.Column('flight_id', sa.Integer(), sa.ForeignKey('flights.id')),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='paid'),
        sa.Column('purchased_at', sa.DateTime(), nullable=False),
        sa.Column('price_paid', sa.Numeric(10,2), nullable=False),
        sa.UniqueConstraint('confirmation_id'),
    )
    op.create_index('ix_tickets_confirmation_id', 'tickets', ['confirmation_id'])
    op.create_index('ix_tickets_user_email', 'tickets', ['user_email'])
    op.create_table('company_managers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id')),
    )

def downgrade():
    op.drop_table('company_managers')
    op.drop_index('ix_tickets_user_email', table_name='tickets')
    op.drop_index('ix_tickets_confirmation_id', table_name='tickets')
    op.drop_table('tickets')
    op.drop_table('flights')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
    op.drop_table('companies')
