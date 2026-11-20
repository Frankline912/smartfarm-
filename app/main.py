import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import engine, SessionLocal
from . import models
from .models import MarketPrice
from .routers import (
    auth,
    weather,
    crops,
    market,
    irrigation,
    analytics,
    farms,
    crop_disease,
    alerts,
    advisory,
    calendar,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AgriHub API",
    description="Smart Agriculture Platform Backend",
    version="1.0.0",
)

default_origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]

extra_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins + extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(farms.router, prefix="/api")
app.include_router(weather.router, prefix="/api")
app.include_router(crops.router, prefix="/api")
app.include_router(market.router, prefix="/api")
app.include_router(irrigation.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(crop_disease.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(advisory.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")


@app.on_event("startup")
def seed_initial_data():
    db: Session = SessionLocal()
    try:
        if db.query(MarketPrice).count() == 0:
            sample_prices = [
                MarketPrice(crop_name="Maize", price_per_kg=48.0, market_location="Nairobi (Wakulima)"),
                MarketPrice(crop_name="Beans", price_per_kg=110.0, market_location="Eldoret"),
                MarketPrice(crop_name="Tomatoes", price_per_kg=95.0, market_location="Mombasa"),
                MarketPrice(crop_name="Irish Potatoes", price_per_kg=55.0, market_location="Nakuru"),
                MarketPrice(crop_name="Sorghum", price_per_kg=40.0, market_location="Kisumu"),
            ]
            db.add_all(sample_prices)
            db.commit()
    finally:
        db.close()