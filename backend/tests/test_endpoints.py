"""
Tests de endpoints API para Escandallos.
Cubre ingredientes, recetas, categorías y dashboard.
"""

import os

# Set AUTH_PASSWORD_HASH before importing app so auth module picks it up
os.environ.setdefault(
    "AUTH_PASSWORD_HASH",
    "22559d6a99e77caeab5ea3898c12be0dd15f2de3e2966f6b9e063218d83c33e2",
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.auth import get_current_user
from app.database import Base, get_db
from app.main import app
from app.models import Categoria, HistorialPrecio, Ingrediente, LineaReceta, Receta


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def test_db():
    # Use a single connection for in-memory SQLite so that data is visible
    # across threads (TestClient runs endpoints in a worker thread).
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)

    connection = engine.connect()
    # Begin a non-ORM transaction that wraps the entire test
    transaction = connection.begin()

    session = Session(bind=connection)

    # Start a nested savepoint so that endpoint commits don't finalize
    # the outer transaction — they commit the savepoint instead.
    nested = connection.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(sess, trans):
        nonlocal nested
        if trans.nested and not trans._parent.nested:
            nested = connection.begin_nested()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(test_db):
    def _override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = lambda: True
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def seed_data(test_db):
    cat_ing = Categoria(nombre="Fruta", tipo="ingrediente")
    cat_rec = Categoria(nombre="Brunch", tipo="receta", margen_objetivo=65.0)
    test_db.add_all([cat_ing, cat_rec])
    test_db.flush()

    fresas = Ingrediente(
        nombre="Fresas",
        categoria_id=cat_ing.id,
        unidad_compra="kg",
        cantidad_compra=1,
        precio_compra=4.50,
        unidad_uso="g",
        merma_porcentaje=15.0,
    )
    test_db.add(fresas)
    test_db.flush()

    receta = Receta(
        nombre="Bowl Fresa",
        categoria_id=cat_rec.id,
        porciones_por_lote=1,
        precio_venta=12.0,
    )
    test_db.add(receta)
    test_db.flush()

    linea = LineaReceta(
        receta_id=receta.id,
        ingrediente_id=fresas.id,
        cantidad=100,
        unidad="g",
    )
    test_db.add(linea)
    test_db.flush()

    return {
        "cat_ing": cat_ing,
        "cat_rec": cat_rec,
        "fresas": fresas,
        "receta": receta,
    }


# ===========================================================================
# Auth
# ===========================================================================


def test_login_success(test_db):
    """POST /api/auth/login with correct password → 200 + token."""
    app.dependency_overrides[get_db] = lambda: test_db
    c = TestClient(app)
    res = c.post("/api/auth/login", json={"password": "bruteam"})
    assert res.status_code == 200
    assert "token" in res.json()
    app.dependency_overrides.clear()


def test_login_wrong_password(test_db):
    """POST /api/auth/login with wrong password → 401."""
    app.dependency_overrides[get_db] = lambda: test_db
    c = TestClient(app)
    res = c.post("/api/auth/login", json={"password": "wrong"})
    assert res.status_code == 401
    app.dependency_overrides.clear()


# ===========================================================================
# Ingredientes
# ===========================================================================


def test_listar_ingredientes(client, seed_data):
    """GET /api/ingredientes → 200, list with 1 item."""
    r = client.get("/api/ingredientes")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["nombre"] == "Fresas"


def test_buscar_ingredientes(client, seed_data):
    """GET /api/ingredientes?buscar=Fresa → 1 result."""
    r = client.get("/api/ingredientes", params={"buscar": "Fresa"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["nombre"] == "Fresas"


def test_buscar_ingredientes_sin_resultado(client, seed_data):
    """GET /api/ingredientes?buscar=XYZ → empty list."""
    r = client.get("/api/ingredientes", params={"buscar": "XYZ"})
    assert r.status_code == 200
    assert r.json() == []


def test_obtener_ingrediente(client, seed_data):
    """GET /api/ingredientes/{id} → 200, correct fields."""
    ing_id = seed_data["fresas"].id
    r = client.get(f"/api/ingredientes/{ing_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["nombre"] == "Fresas"
    assert data["unidad_compra"] == "kg"
    assert data["unidad_uso"] == "g"
    assert data["merma_porcentaje"] == 15.0
    assert data["precio_compra"] == 4.50
    assert data["coste_por_unidad_uso"] > 0
    assert data["num_recetas"] == 1
    assert data["categoria_nombre"] == "Fruta"


def test_ingrediente_no_encontrado(client):
    """GET /api/ingredientes/9999 → 404."""
    r = client.get("/api/ingredientes/9999")
    assert r.status_code == 404


def test_crear_ingrediente(client, seed_data):
    """POST /api/ingredientes → 201."""
    payload = {
        "nombre": "Leche",
        "categoria_id": seed_data["cat_ing"].id,
        "unidad_compra": "litro",
        "cantidad_compra": 1,
        "precio_compra": 1.20,
        "unidad_uso": "ml",
        "merma_porcentaje": 0,
    }
    r = client.post("/api/ingredientes", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["nombre"] == "Leche"
    assert data["id"] is not None


def test_crear_ingrediente_merma_invalida(client, seed_data):
    """POST with merma=200 → 422 (schema enforces ge=0, lt=100)."""
    payload = {
        "nombre": "Mala Merma",
        "categoria_id": seed_data["cat_ing"].id,
        "unidad_compra": "kg",
        "cantidad_compra": 1,
        "precio_compra": 5.0,
        "unidad_uso": "g",
        "merma_porcentaje": 200,
    }
    r = client.post("/api/ingredientes", json=payload)
    assert r.status_code == 422


def test_crear_ingrediente_cantidad_cero(client, seed_data):
    """POST with cantidad_compra=0 → 422 (schema enforces gt=0)."""
    payload = {
        "nombre": "Cantidad Cero",
        "categoria_id": seed_data["cat_ing"].id,
        "unidad_compra": "kg",
        "cantidad_compra": 0,
        "precio_compra": 5.0,
        "unidad_uso": "g",
        "merma_porcentaje": 0,
    }
    r = client.post("/api/ingredientes", json=payload)
    assert r.status_code == 422


def test_actualizar_ingrediente(client, seed_data):
    """PUT /api/ingredientes/{id} with new price → 200."""
    ing_id = seed_data["fresas"].id
    r = client.put(
        f"/api/ingredientes/{ing_id}",
        json={"precio_compra": 5.00},
    )
    assert r.status_code == 200
    assert r.json()["precio_compra"] == 5.00


def test_actualizar_precio_crea_historial(client, seed_data):
    """PUT with price change, then GET historial → entry exists."""
    ing_id = seed_data["fresas"].id

    # Change price
    r = client.put(
        f"/api/ingredientes/{ing_id}",
        json={"precio_compra": 6.00},
    )
    assert r.status_code == 200

    # Check history
    r = client.get(f"/api/ingredientes/{ing_id}/historial")
    assert r.status_code == 200
    historial = r.json()
    assert len(historial) >= 1
    entry = historial[0]
    assert entry["precio_anterior"] == 4.50
    assert entry["precio_nuevo"] == 6.00


def test_eliminar_ingrediente(client, seed_data, test_db):
    """DELETE /api/ingredientes/{id} → 200 (ingredient not used in recipes)."""
    # Create an ingredient that is NOT used in any recipe
    nuevo = Ingrediente(
        nombre="Canela",
        categoria_id=seed_data["cat_ing"].id,
        unidad_compra="kg",
        cantidad_compra=1,
        precio_compra=12.0,
        unidad_uso="g",
        merma_porcentaje=0,
    )
    test_db.add(nuevo)
    test_db.flush()

    r = client.delete(f"/api/ingredientes/{nuevo.id}")
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # Verify it's gone
    r = client.get(f"/api/ingredientes/{nuevo.id}")
    assert r.status_code == 404


def test_historial_precios(client, seed_data):
    """GET /api/ingredientes/{id}/historial → 200."""
    ing_id = seed_data["fresas"].id
    r = client.get(f"/api/ingredientes/{ing_id}/historial")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_recetas_con_ingrediente(client, seed_data):
    """GET /api/ingredientes/{id}/recetas → 200, returns Bowl Fresa."""
    ing_id = seed_data["fresas"].id
    r = client.get(f"/api/ingredientes/{ing_id}/recetas")
    assert r.status_code == 200
    recetas = r.json()
    assert len(recetas) >= 1
    nombres = [rec["nombre"] for rec in recetas]
    assert "Bowl Fresa" in nombres


# ===========================================================================
# Recetas
# ===========================================================================


def test_listar_recetas(client, seed_data):
    """GET /api/recetas → 200."""
    r = client.get("/api/recetas")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_filtrar_subrecetas(client, seed_data, test_db):
    """GET /api/recetas?es_subreceta=false → only non-sub-recipes."""
    # Add a sub-recipe
    sub = Receta(
        nombre="Salsa Base",
        categoria_id=seed_data["cat_rec"].id,
        porciones_por_lote=1,
        es_subreceta=True,
    )
    test_db.add(sub)
    test_db.flush()

    r = client.get("/api/recetas", params={"es_subreceta": "false"})
    assert r.status_code == 200
    data = r.json()
    for receta in data:
        assert receta["es_subreceta"] is False

    r_sub = client.get("/api/recetas", params={"es_subreceta": "true"})
    assert r_sub.status_code == 200
    data_sub = r_sub.json()
    for receta in data_sub:
        assert receta["es_subreceta"] is True


def test_obtener_receta(client, seed_data):
    """GET /api/recetas/{id} → 200 with lineas."""
    rec_id = seed_data["receta"].id
    r = client.get(f"/api/recetas/{rec_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["nombre"] == "Bowl Fresa"
    assert "lineas" in data
    assert len(data["lineas"]) == 1
    assert data["lineas"][0]["nombre_ingrediente"] == "Fresas"
    assert data["coste_total"] > 0
    assert data["margen_real"] is not None


def test_crear_receta(client, seed_data):
    """POST /api/recetas → 201."""
    payload = {
        "nombre": "Smoothie Fresa",
        "categoria_id": seed_data["cat_rec"].id,
        "porciones_por_lote": 1,
        "precio_venta": 6.50,
        "lineas": [
            {
                "ingrediente_id": seed_data["fresas"].id,
                "cantidad": 200,
                "unidad": "g",
            }
        ],
    }
    r = client.post("/api/recetas", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["nombre"] == "Smoothie Fresa"
    assert len(data["lineas"]) == 1
    assert data["id"] is not None


def test_actualizar_receta(client, seed_data):
    """PUT /api/recetas/{id} → 200."""
    rec_id = seed_data["receta"].id
    r = client.put(
        f"/api/recetas/{rec_id}",
        json={"nombre": "Bowl Fresa Premium", "precio_venta": 14.0},
    )
    assert r.status_code == 200
    assert r.json()["nombre"] == "Bowl Fresa Premium"
    assert r.json()["precio_venta"] == 14.0


def test_eliminar_receta(client, seed_data, test_db):
    """DELETE /api/recetas/{id} → 200."""
    # Create a separate recipe to delete (seed_data recipe is fine too,
    # but let's keep seed_data intact for other tests)
    rec = Receta(
        nombre="Para Borrar",
        categoria_id=seed_data["cat_rec"].id,
        porciones_por_lote=1,
    )
    test_db.add(rec)
    test_db.flush()

    r = client.delete(f"/api/recetas/{rec.id}")
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ===========================================================================
# Categorias
# ===========================================================================


def test_listar_categorias(client, seed_data):
    """GET /api/categorias → 200."""
    r = client.get("/api/categorias")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    nombres = [c["nombre"] for c in data]
    assert "Fruta" in nombres
    assert "Brunch" in nombres


def test_crear_categoria(client):
    """POST /api/categorias → 201."""
    payload = {
        "nombre": "Postre",
        "tipo": "receta",
        "margen_objetivo": 68.0,
    }
    r = client.post("/api/categorias", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["nombre"] == "Postre"
    assert data["tipo"] == "receta"
    assert data["margen_objetivo"] == 68.0


def test_eliminar_categoria_vacia(client, test_db):
    """Create empty category, DELETE → 200."""
    cat = Categoria(nombre="Vacia", tipo="ingrediente")
    test_db.add(cat)
    test_db.flush()

    r = client.delete(f"/api/categorias/{cat.id}")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_eliminar_categoria_con_ingredientes(client, seed_data):
    """DELETE category with ingredients → 400."""
    cat_id = seed_data["cat_ing"].id
    r = client.delete(f"/api/categorias/{cat_id}")
    assert r.status_code == 400


# ===========================================================================
# Dashboard
# ===========================================================================


def test_dashboard_alertas(client, seed_data):
    """GET /api/dashboard/alertas → 200."""
    r = client.get("/api/dashboard/alertas")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_dashboard_rankings(client, seed_data):
    """GET /api/dashboard/rankings → 200."""
    r = client.get("/api/dashboard/rankings")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    item = data[0]
    assert "nombre" in item
    assert "coste_por_porcion" in item
    assert "margen" in item
