"""add invoice line_items tax_percent and client address

Revision ID: a3b5c7d9e1f2
Revises: 137187ab3209
Create Date: 2026-07-07 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b5c7d9e1f2'
down_revision: Union[str, Sequence[str], None] = '137187ab3209'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add line_items + tax_percent to invoices, address to clients."""
    op.add_column('invoices', sa.Column('tax_percent', sa.Numeric(5, 2), server_default='0', nullable=False))
    op.add_column('invoices', sa.Column('line_items', sa.Text(), nullable=True))
    op.add_column('clients', sa.Column('address', sa.String(500), server_default='', nullable=False))


def downgrade() -> None:
    """Remove added columns."""
    op.drop_column('clients', 'address')
    op.drop_column('invoices', 'line_items')
    op.drop_column('invoices', 'tax_percent')
