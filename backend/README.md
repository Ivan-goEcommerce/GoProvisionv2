# GoProvisions Backend (FastAPI)

## Structure

- `api/`: HTTP routes
- `services/`: business rules
- `schemas/`: request/response models
- `core/`: config, logging, error handling

## Setup

1. Copy `.env.example` to `.env`
2. Install deps:
   - `pip install -r backend/requirements.txt`
3. Run API:
   - `uvicorn backend.main:app --reload --port 8000`

## Endpoints

- `GET /api/health`
- `POST /api/webhooks/commissions`

## Webhook auth

Set header:

`Authorization: Bearer <WEBHOOK_SECRET>`
