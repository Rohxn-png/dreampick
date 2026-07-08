"""Dreampick — FastAPI backend main entry."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from routes import auth_router, public_router, order_router, customer_router, admin_router, media_serve_router
from db import get_client
import seed
import scheduler

app = FastAPI(title="Dreampick API")

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(public_router)
api_router.include_router(order_router)
api_router.include_router(customer_router)
api_router.include_router(admin_router)
api_router.include_router(media_serve_router)


@api_router.get("/")
async def root():
    return {"message": "Dreampick API", "status": "ok"}


app.include_router(api_router)

_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("dreampick")


@app.on_event("startup")
async def on_startup():
    try:
        await seed.seed_all()
        logger.info("Seed completed.")
    except Exception as e:
        logger.exception(f"Seed failed: {e}")
    try:
        scheduler.start(int(os.environ.get("SCHEDULER_INTERVAL_MINUTES", 60)))
    except Exception as e:
        logger.exception(f"Scheduler start failed: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    scheduler.stop()
    get_client().close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host=os.environ.get("BACKEND_HOST", "0.0.0.0"),
        port=int(os.environ.get("BACKEND_PORT", "8000")),
        reload=False,
    )
