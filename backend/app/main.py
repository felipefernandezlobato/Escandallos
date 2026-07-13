from dotenv import load_dotenv
load_dotenv()

import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.auth import (
    AUTH_PASSWORD_HASH,
    create_token,
    get_current_user,
    verify_password,
)
from app.database import Base, engine, get_db, SessionLocal
from app.routers import categorias, ingredientes, recetas, importar, dashboard, backup, proveedores, inventario, pedidos
from app.models import Categoria

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Escandallos API",
    description="API de costeo de recetas para cafetería",
    version="1.0.0",
)

cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    password: str


@app.post("/api/auth/login")
def login(req: LoginRequest):
    if not verify_password(req.password, AUTH_PASSWORD_HASH):
        raise HTTPException(401, "Contraseña incorrecta")
    return {"token": create_token()}


@app.get("/api/auth/check")
def check_auth(user=Depends(get_current_user)):
    return {"ok": True}


app.include_router(categorias.router)
app.include_router(ingredientes.router)
app.include_router(recetas.router)
app.include_router(importar.router)
app.include_router(dashboard.router)
app.include_router(backup.router)
app.include_router(proveedores.router)
app.include_router(inventario.router)
app.include_router(pedidos.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.on_event("startup")
def seed_data():
    db = SessionLocal()
    try:
        if db.query(Categoria).count() == 0:
            categorias_ingrediente = [
                "Lácteo", "Fruta", "Verdura", "Seco", "Café", "Alcohol",
                "Carne", "Panadería", "Huevos", "Especias", "Bebidas", "Otros",
            ]
            categorias_receta = [
                ("Bebida", 70),
                ("Brunch", 65),
                ("Postre", 68),
                ("Snack", 65),
                ("Cafetería", 80),
            ]
            for nombre in categorias_ingrediente:
                db.add(Categoria(nombre=nombre, tipo="ingrediente"))
            for nombre, margen in categorias_receta:
                db.add(Categoria(nombre=nombre, tipo="receta", margen_objetivo=margen))
            db.commit()
    finally:
        db.close()
