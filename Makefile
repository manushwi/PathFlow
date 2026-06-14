install:
	cd frontend && npm install
	cd backend && pip install -r requirements.txt

migrate:
	cd backend && alembic upgrade head

dev-backend:
	cd backend && uvicorn main:app --reload --port 8000

dev-worker:
	cd worker && celery -A celery_app worker --loglevel=info --pool=solo

dev-frontend:
	cd frontend && npm run dev

dev:
	$(MAKE) dev-backend &
	$(MAKE) dev-worker &
	$(MAKE) dev-frontend

stop:
	pkill -f uvicorn || true
	pkill -f celery || true
