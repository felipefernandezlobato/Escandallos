from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine, get_db, SessionLocal
from app.routers import categorias, ingredientes, recetas, importar, dashboard, backup
from app.models import Categoria

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Escandallos API",
    description="API de costeo de recetas para cafetería",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categorias.router)
app.include_router(ingredientes.router)
app.include_router(recetas.router)
app.include_router(importar.router)
app.include_router(dashboard.router)
app.include_router(backup.router)


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
