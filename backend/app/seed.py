from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Categoria

CATEGORIAS_INGREDIENTES = [
    "Lacteo",
    "Fruta",
    "Verdura",
    "Seco",
    "Cafe",
    "Alcohol",
    "Carne",
    "Pescado",
    "Panaderia",
    "Especias",
    "Aceites",
    "Bebidas",
    "Otros",
]

CATEGORIAS_RECETAS = [
    ("Bebida", 70.0),
    ("Brunch", 65.0),
    ("Postre", 68.0),
    ("Snack", 65.0),
    ("Cocktail", 75.0),
]


def seed_categorias(db: Session) -> None:
    existentes = {c.nombre for c in db.query(Categoria).all()}

    for nombre in CATEGORIAS_INGREDIENTES:
        if nombre not in existentes:
            db.add(Categoria(nombre=nombre, tipo="ingrediente"))

    for nombre, margen in CATEGORIAS_RECETAS:
        if nombre not in existentes:
            db.add(Categoria(nombre=nombre, tipo="receta", margen_objetivo=margen))

    db.commit()


def run_seed() -> None:
    db = SessionLocal()
    try:
        seed_categorias(db)
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
    print("Seed data cargada correctamente.")
