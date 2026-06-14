import sys
import os

# Add backend and root directories to path for imports to resolve correctly
backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Run Alembic migrations automatically on startup
try:
    from alembic.config import Config
    from alembic import command
    print("Applying database migrations...")
    alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    command.upgrade(alembic_cfg, "head")
    print("Migrations applied successfully.")
except Exception as e:
    print(f"Auto-migration failed or database not ready: {e}")

# Import the FastAPI app instance from backend
from backend.main import app
