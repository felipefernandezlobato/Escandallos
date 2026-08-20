"""
Tests de endpoints de inventario y pedidos.
"""

import os
from datetime import date

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
from app.models import Categoria, Ingrediente, InventarioRegistro, LineaPedido, Pedido


@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)

    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
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
def seed(test_db):
    cat = Categoria(nombre="Fruta", tipo="ingrediente")
    test_db.add(cat)
    test_db.flush()

    fresas = Ingrediente(
        nombre="Fresas",
        categoria_id=cat.id,
        unidad_compra="kg",
        cantidad_compra=1,
        precio_compra=4.50,
        unidad_uso="g",
        merma_porcentaje=15.0,
        proveedor="Pfaff",
    )
    leche = Ingrediente(
        nombre="Leche",
        categoria_id=cat.id,
        unidad_compra="litro",
        cantidad_compra=1,
        precio_compra=1.80,
        unidad_uso="ml",
        merma_porcentaje=0.0,
        proveedor="Prodega",
    )
    test_db.add_all([fresas, leche])
    test_db.flush()
    return {"fresas": fresas, "leche": leche, "cat": cat}


# --- Inventario ---


class TestInventarioRegistrar:
    def test_registrar_snapshot(self, client, seed):
        resp = client.post("/api/inventario", json={
            "registros": [
                {"ingrediente_id": seed["fresas"].id, "cantidad": 2.5, "unidad": "kg"},
                {"ingrediente_id": seed["leche"].id, "cantidad": 10, "unidad": "litro"},
            ]
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["ok"] is True
        assert data["registros_creados"] == 2

    def test_registrar_ignora_ingrediente_invalido(self, client, seed):
        resp = client.post("/api/inventario", json={
            "registros": [
                {"ingrediente_id": 9999, "cantidad": 1, "unidad": "kg"},
            ]
        })
        assert resp.status_code == 201
        assert resp.json()["registros_creados"] == 0


class TestInventarioListar:
    def test_listar_vacio(self, client, seed):
        resp = client.get("/api/inventario")
        assert resp.status_code == 200
        data = resp.json()
        assert data["fechas"] == []
        assert data["semanas"] == []
        assert data["snapshot"] is None

    def test_listar_con_datos(self, client, seed):
        client.post("/api/inventario", json={
            "registros": [
                {"ingrediente_id": seed["fresas"].id, "cantidad": 5, "unidad": "kg"},
            ]
        })
        resp = client.get("/api/inventario")
        data = resp.json()
        assert len(data["fechas"]) == 1
        assert len(data["semanas"]) == 1
        assert data["snapshot"]["total_items"] == 1
        assert data["snapshot"]["registros"][0]["ingrediente_nombre"] == "Fresas"

    def test_listar_por_semana(self, client, seed):
        """Filtering by semana returns all records from that week."""
        client.post("/api/inventario", json={
            "registros": [
                {"ingrediente_id": seed["fresas"].id, "cantidad": 5, "unidad": "kg"},
                {"ingrediente_id": seed["leche"].id, "cantidad": 10, "unidad": "litro"},
            ]
        })
        # Get the week key from the listing
        listing = client.get("/api/inventario").json()
        semana = listing["semanas"][0]

        resp = client.get(f"/api/inventario?semana={semana}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["snapshot"]["total_items"] == 2
        assert data["snapshot"]["fecha"] == semana

    def test_listar_por_semana_inexistente(self, client, seed):
        """Filtering by a non-existent week returns empty snapshot."""
        client.post("/api/inventario", json={
            "registros": [
                {"ingrediente_id": seed["fresas"].id, "cantidad": 5, "unidad": "kg"},
            ]
        })
        resp = client.get("/api/inventario?semana=w99.99")
        assert resp.status_code == 200
        data = resp.json()
        assert data["snapshot"]["total_items"] == 0


class TestStockActual:
    def test_stock_actual(self, client, seed):
        client.post("/api/inventario", json={
            "registros": [
                {"ingrediente_id": seed["fresas"].id, "cantidad": 3, "unidad": "kg"},
            ]
        })
        resp = client.get("/api/inventario/actual")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["cantidad"] == 3
        assert data[0]["ingrediente_nombre"] == "Fresas"


class TestRecomendacion:
    def test_recomendacion_sin_datos(self, client, seed):
        resp = client.get("/api/inventario/recomendacion")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []


class TestAlertasStock:
    def test_alertas_vacio(self, client, seed):
        resp = client.get("/api/inventario/alertas-stock")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestCosteSemanal:
    def test_coste_semanal_vacio(self, client, seed):
        resp = client.get("/api/inventario/coste-semanal")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_coste_semanal_con_datos(self, client, seed):
        create = client.post("/api/pedidos", json={
            "proveedor": "Pfaff",
            "lineas": [
                {"ingrediente_id": seed["fresas"].id, "cantidad_pedida": 5, "unidad": "kg", "precio_unitario": 4.50},
            ]
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 5, "precio_unitario": 4.50}]
        })
        resp = client.get("/api/inventario/coste-semanal")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["total"] > 0


class TestConsumo:
    def test_consumo_ingrediente(self, client, seed):
        resp = client.get(f"/api/inventario/consumo/{seed['fresas'].id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ingrediente_nombre"] == "Fresas"
        assert data["consumo_medio"] == 0.0

    def test_consumo_ingrediente_inexistente(self, client, seed):
        resp = client.get("/api/inventario/consumo/9999")
        assert resp.status_code == 404


# --- Pedidos ---


class TestPedidoCrear:
    def test_crear_pedido(self, client, seed):
        resp = client.post("/api/pedidos", json={
            "proveedor": "Pfaff",
            "lineas": [
                {"ingrediente_id": seed["fresas"].id, "cantidad_pedida": 5, "unidad": "kg"},
            ]
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["proveedor"] == "Pfaff"
        assert data["estado"] == "borrador"
        assert data["num_lineas"] == 1
        assert len(data["lineas"]) == 1
        assert data["lineas"][0]["ingrediente_nombre"] == "Fresas"

    def test_crear_pedido_sin_lineas(self, client, seed):
        resp = client.post("/api/pedidos", json={"proveedor": "Test"})
        assert resp.status_code == 201
        assert resp.json()["num_lineas"] == 0


class TestPedidoListar:
    def test_listar_vacio(self, client, seed):
        resp = client.get("/api/pedidos")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_listar_con_filtro(self, client, seed):
        client.post("/api/pedidos", json={"proveedor": "Pfaff"})
        client.post("/api/pedidos", json={"proveedor": "Prodega"})

        resp = client.get("/api/pedidos?proveedor=Pfaff")
        assert len(resp.json()) == 1
        assert resp.json()[0]["proveedor"] == "Pfaff"

        resp = client.get("/api/pedidos?estado=borrador")
        assert len(resp.json()) == 2


class TestPedidoDetalle:
    def test_obtener_pedido(self, client, seed):
        create = client.post("/api/pedidos", json={
            "proveedor": "Pfaff",
            "lineas": [
                {"ingrediente_id": seed["fresas"].id, "cantidad_pedida": 5, "unidad": "kg"},
            ]
        })
        pid = create.json()["id"]
        resp = client.get(f"/api/pedidos/{pid}")
        assert resp.status_code == 200
        assert resp.json()["proveedor"] == "Pfaff"
        assert len(resp.json()["lineas"]) == 1

    def test_pedido_no_existe(self, client, seed):
        resp = client.get("/api/pedidos/9999")
        assert resp.status_code == 404


class TestPedidoActualizar:
    def test_actualizar_pedido(self, client, seed):
        create = client.post("/api/pedidos", json={"proveedor": "Pfaff"})
        pid = create.json()["id"]
        resp = client.put(f"/api/pedidos/{pid}", json={"notas": "Urgente"})
        assert resp.status_code == 200
        assert resp.json()["notas"] == "Urgente"

    def test_recibido_solo_notas(self, client, seed):
        """Received orders allow only notas/fecha_recepcion updates."""
        create = client.post("/api/pedidos", json={
            "proveedor": "Pfaff",
            "lineas": [
                {"ingrediente_id": seed["fresas"].id, "cantidad_pedida": 5, "unidad": "kg"},
            ]
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 5}]
        })
        # Notas update should work on received orders
        resp = client.put(f"/api/pedidos/{pid}", json={"notas": "test"})
        assert resp.status_code == 200
        assert resp.json()["notas"] == "test"
        # Proveedor update should be silently ignored on received orders
        resp = client.put(f"/api/pedidos/{pid}", json={"proveedor": "Otro"})
        assert resp.status_code == 200
        assert resp.json()["proveedor"] == "Pfaff"  # unchanged


class TestPedidoEliminar:
    def test_eliminar_borrador(self, client, seed):
        create = client.post("/api/pedidos", json={"proveedor": "Pfaff"})
        pid = create.json()["id"]
        resp = client.delete(f"/api/pedidos/{pid}")
        assert resp.status_code == 200
        assert client.get(f"/api/pedidos/{pid}").status_code == 404


class TestPedidoEnviar:
    def test_enviar_pedido(self, client, seed):
        create = client.post("/api/pedidos", json={"proveedor": "Pfaff"})
        pid = create.json()["id"]
        resp = client.post(f"/api/pedidos/{pid}/enviar")
        assert resp.status_code == 200
        assert client.get(f"/api/pedidos/{pid}").json()["estado"] == "enviado"

    def test_no_enviar_ya_enviado(self, client, seed):
        create = client.post("/api/pedidos", json={"proveedor": "Pfaff"})
        pid = create.json()["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        resp = client.post(f"/api/pedidos/{pid}/enviar")
        assert resp.status_code == 400


class TestPedidoRecibir:
    def test_recibir_pedido(self, client, seed):
        create = client.post("/api/pedidos", json={
            "proveedor": "Pfaff",
            "lineas": [
                {"ingrediente_id": seed["fresas"].id, "cantidad_pedida": 5, "unidad": "kg"},
            ]
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")

        resp = client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [
                {"linea_id": lid, "cantidad_recibida": 4.8},
            ]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True

        pedido = client.get(f"/api/pedidos/{pid}").json()
        assert pedido["estado"] == "recibido"
        assert pedido["lineas"][0]["cantidad_recibida"] == 4.8

    def test_recibir_crea_inventario(self, client, seed):
        """Receiving an order creates inventory records for each line."""
        # Register initial stock
        client.post("/api/inventario", json={
            "registros": [
                {"ingrediente_id": seed["fresas"].id, "cantidad": 2, "unidad": "kg"},
            ]
        })
        # Create, send, and receive order
        create = client.post("/api/pedidos", json={
            "proveedor": "Pfaff",
            "lineas": [
                {"ingrediente_id": seed["fresas"].id, "cantidad_pedida": 5, "unidad": "kg"},
            ]
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 5}]
        })
        # Stock should be initial (2) + received (5) = 7
        # The recibir endpoint creates a new record with the summed quantity
        stock = client.get("/api/inventario/actual").json()
        fresas_stock = [s for s in stock if s["ingrediente_id"] == seed["fresas"].id]
        assert any(s["cantidad"] == 7 for s in fresas_stock)

    def test_no_recibir_ya_recibido(self, client, seed):
        create = client.post("/api/pedidos", json={
            "proveedor": "Pfaff",
            "lineas": [
                {"ingrediente_id": seed["fresas"].id, "cantidad_pedida": 5, "unidad": "kg"},
            ]
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 5}]
        })
        resp = client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 5}]
        })
        assert resp.status_code == 400


class TestPedidoRecibirCafeFrozen:
    """Receiving an order for one frozen-tube flavor must not zero out its
    siblings that weren't part of the delivery (the bug reported 2026-08-20)."""

    @pytest.fixture
    def frozen(self, test_db):
        cafe_cat = Categoria(id=5, nombre="Café", tipo="ingrediente")
        test_db.add(cafe_cat)
        test_db.flush()

        parent = Ingrediente(
            nombre="Tubos Frozen Bru1", categoria_id=5,
            unidad_compra="unidad", cantidad_compra=1, precio_compra=0,
            unidad_uso="unidad", merma_porcentaje=0.0,
        )
        test_db.add(parent)
        test_db.flush()

        karamo = Ingrediente(
            nombre="Frozen Karamo Bru1", categoria_id=5,
            unidad_compra="unidad", cantidad_compra=1, precio_compra=3.0,
            unidad_uso="unidad", merma_porcentaje=0.0,
            grupo_ingrediente_id=parent.id,
        )
        perla = Ingrediente(
            nombre="Frozen Perla Bru1", categoria_id=5,
            unidad_compra="unidad", cantidad_compra=1, precio_compra=3.0,
            unidad_uso="unidad", merma_porcentaje=0.0,
            grupo_ingrediente_id=parent.id,
        )
        test_db.add_all([karamo, perla])
        test_db.flush()

        # Both flavors counted together in the last real counting session.
        test_db.add_all([
            InventarioRegistro(
                ingrediente_id=karamo.id, cantidad=5, unidad="unidad",
                fecha_registro=date(2026, 1, 1), ubicacion="BRU1",
            ),
            InventarioRegistro(
                ingrediente_id=perla.id, cantidad=3, unidad="unidad",
                fecha_registro=date(2026, 1, 1), ubicacion="BRU1",
            ),
        ])
        test_db.flush()
        return {"parent": parent, "karamo": karamo, "perla": perla}

    def test_recibir_no_zera_hermanos(self, client, test_db, frozen):
        from app.services.consumo import stock_actual, stock_base_recepcion_pedido

        create = client.post("/api/pedidos", json={
            "proveedor": "Dabov",
            "lineas": [
                {"ingrediente_id": frozen["karamo"].id, "cantidad_pedida": 10, "unidad": "unidad"},
            ],
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")

        resp = client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 10}],
        })
        assert resp.status_code == 200

        # Karamo: last real count (5) + received (10) = 15.
        karamo_stock = stock_actual(frozen["karamo"].id, test_db)
        assert karamo_stock["cantidad"] == 15

        # Perla was untouched by the order — must still show its last real
        # count (3), not be zeroed just because Karamo got a delivery today.
        perla_stock = stock_actual(frozen["perla"].id, test_db)
        assert perla_stock["cantidad"] == 3

        # The parent group total must reflect both, not just the delivery.
        group_stock = stock_actual(frozen["parent"].id, test_db)
        assert group_stock["cantidad"] == 18

    def test_recibir_usa_ultimo_conteo_como_base_si_sabor_no_estaba_en_sesion(
        self, client, test_db, frozen
    ):
        """If a flavor already missed the latest counting session (so its true
        current stock is 0 per the zero-if-uncounted rule), a later delivery
        must add on top of 0, not on top of its stale pre-session quantity."""
        from app.services.consumo import stock_actual

        # A newer session recounts only Perla — Karamo is now "missed" and
        # should read as 0 going forward.
        test_db.add(InventarioRegistro(
            ingrediente_id=frozen["perla"].id, cantidad=4, unidad="unidad",
            fecha_registro=date(2026, 1, 8), ubicacion="BRU1",
        ))
        test_db.flush()

        create = client.post("/api/pedidos", json={
            "proveedor": "Dabov",
            "lineas": [
                {"ingrediente_id": frozen["karamo"].id, "cantidad_pedida": 6, "unidad": "unidad"},
            ],
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 6}],
        })

        # 0 (missed session) + 6 received = 6, not 5 (stale) + 6 = 11.
        karamo_stock = stock_actual(frozen["karamo"].id, test_db)
        assert karamo_stock["cantidad"] == 6

    def test_recibir_mismo_dia_que_conteo_no_duplica(self, client, test_db, frozen):
        """A manual count and an order delivery landing on the same calendar
        date must not be double-counted as if "Pedido recibido" (ubicacion
        unset) were a third distinct location alongside BRU1/BRU2."""
        from app.services.consumo import stock_actual

        # Today's manual count for Karamo at BRU1.
        client.post("/api/inventario", json={
            "registros": [
                {
                    "ingrediente_id": frozen["karamo"].id, "cantidad": 7,
                    "unidad": "unidad", "ubicacion": "BRU1",
                },
            ]
        })

        create = client.post("/api/pedidos", json={
            "proveedor": "Dabov",
            "lineas": [
                {"ingrediente_id": frozen["karamo"].id, "cantidad_pedida": 10, "unidad": "unidad"},
            ],
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 10}],
        })

        # 7 (today's count) + 10 received = 17, not 7 + 17 = 24 from treating
        # the order-received row as an extra "None" location.
        karamo_stock = stock_actual(frozen["karamo"].id, test_db)
        assert karamo_stock["cantidad"] == 17

    def test_batch_latest_stocks_no_zera_hermanos(self, client, test_db, frozen):
        """Same rule, verified against menu.py's independent implementation
        (_batch_latest_stocks feeds /api/menu/frozen) — the duplicated stock
        logic must be fixed in all 3 places, not just consumo.py."""
        from app.routers.menu import _batch_latest_stocks

        create = client.post("/api/pedidos", json={
            "proveedor": "Dabov",
            "lineas": [
                {"ingrediente_id": frozen["karamo"].id, "cantidad_pedida": 10, "unidad": "unidad"},
            ],
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 10}],
        })

        group_of = {
            frozen["karamo"].id: frozen["parent"].id,
            frozen["perla"].id: frozen["parent"].id,
        }
        stocks = _batch_latest_stocks(
            [frozen["karamo"].id, frozen["perla"].id], test_db, group_of=group_of
        )
        assert stocks[frozen["karamo"].id]["total"] == 15
        assert stocks[frozen["perla"].id]["total"] == 3


class TestInventarioActualizar:
    def test_actualizar_cantidad(self, client, seed):
        client.post("/api/inventario", json={
            "registros": [
                {"ingrediente_id": seed["fresas"].id, "cantidad": 5, "unidad": "kg"},
            ]
        })
        inv = client.get("/api/inventario").json()
        reg_id = inv["snapshot"]["registros"][0]["id"]
        resp = client.put(f"/api/inventario/{reg_id}", json={"cantidad": 3.5})
        assert resp.status_code == 200
        assert resp.json()["cantidad"] == 3.5
        assert resp.json()["ingrediente_nombre"] == "Fresas"

    def test_actualizar_notas(self, client, seed):
        client.post("/api/inventario", json={
            "registros": [
                {"ingrediente_id": seed["fresas"].id, "cantidad": 2, "unidad": "kg"},
            ]
        })
        inv = client.get("/api/inventario").json()
        reg_id = inv["snapshot"]["registros"][0]["id"]
        resp = client.put(f"/api/inventario/{reg_id}", json={"notas": "conteo parcial"})
        assert resp.status_code == 200
        assert resp.json()["notas"] == "conteo parcial"

    def test_actualizar_no_existe(self, client, seed):
        resp = client.put("/api/inventario/9999", json={"cantidad": 1})
        assert resp.status_code == 404


class TestLineaPedidoActualizar:
    def test_actualizar_linea_borrador(self, client, seed):
        create = client.post("/api/pedidos", json={
            "proveedor": "Pfaff",
            "lineas": [
                {"ingrediente_id": seed["fresas"].id, "cantidad_pedida": 5, "unidad": "kg"},
            ]
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        resp = client.put(f"/api/pedidos/{pid}/lineas/{lid}", json={"cantidad_pedida": 10})
        assert resp.status_code == 200
        assert resp.json()["cantidad_pedida"] == 10

    def test_actualizar_linea_recibido(self, client, seed):
        """Can edit lines even on received orders."""
        create = client.post("/api/pedidos", json={
            "proveedor": "Pfaff",
            "lineas": [
                {"ingrediente_id": seed["fresas"].id, "cantidad_pedida": 5, "unidad": "kg"},
            ]
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 5}]
        })
        resp = client.put(f"/api/pedidos/{pid}/lineas/{lid}", json={
            "cantidad_recibida": 4.5, "precio_unitario": 3.20
        })
        assert resp.status_code == 200
        assert resp.json()["cantidad_recibida"] == 4.5
        assert resp.json()["precio_unitario"] == 3.20

    def test_actualizar_linea_no_existe(self, client, seed):
        create = client.post("/api/pedidos", json={"proveedor": "Pfaff"})
        pid = create.json()["id"]
        resp = client.put(f"/api/pedidos/{pid}/lineas/9999", json={"cantidad_pedida": 1})
        assert resp.status_code == 404

    def test_actualizar_linea_pedido_no_existe(self, client, seed):
        resp = client.put("/api/pedidos/9999/lineas/1", json={"cantidad_pedida": 1})
        assert resp.status_code == 404


class TestPedidoPorProveedor:
    def test_por_proveedor(self, client, seed):
        resp = client.get("/api/pedidos/por-proveedor")
        assert resp.status_code == 200
