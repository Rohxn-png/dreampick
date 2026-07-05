"""Dream Pick — FastAPI backend main entry."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from routes import auth_router, public_router, order_router, customer_router, admin_router
from db import get_client
import seed

app = FastAPI(title="Dream Pick API")

# Combine all routes under /api
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(public_router)
api_router.include_router(order_router)
api_router.include_router(customer_router)
api_router.include_router(admin_router)


@api_router.get("/")
async def root():
    return {"message": "Dream Pick API", "status": "ok"}


app.include_router(api_router)

# CORS
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
        logger.info("Seed completed successfully.")
    except Exception as e:
        logger.exception(f"Seed failed: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    get_client().close()
