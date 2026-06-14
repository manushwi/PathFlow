# PatchFlow

AI-powered open source contribution platform.

## Quick Start

1. Copy `.env` to set your credentials
2. `make install`
3. `make migrate`
4. `make dev`
5. Open http://localhost:3000

## Credentials needed
- GitHub OAuth App
- Neon PostgreSQL (free)
- Upstash Redis (free)
- Qdrant Cloud (free)
- OpenRouter API key (free tier)

## Stack
- Frontend: Next.js 16, TypeScript, Tailwind, shadcn/ui, Monaco, React Flow
- Backend: FastAPI, SQLAlchemy, Alembic, GitPython
- Workers: Celery, Redis
- AI: OpenRouter (gpt-4o-mini free tier)
- Vector: Qdrant
