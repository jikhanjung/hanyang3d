"""The host backup tool is also the implementation used by management commands."""
from deploy.host.backup_content import backup_database

__all__ = ['backup_database']
