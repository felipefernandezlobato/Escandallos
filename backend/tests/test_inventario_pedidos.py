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


class TestMovimientos:
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
        return {"parent": parent, "karamo": karamo, "perla": perla}

    def test_movimientos_leaf_incluye_conteo_pedido_y_merma(self, client, test_db, frozen):
        # Conteo inicial.
        test_db.add(InventarioRegistro(
            ingrediente_id=frozen["karamo"].id, cantidad=5, unidad="unidad",
            fecha_registro=date(2026, 1, 1), ubicacion="BRU1",
        ))
        test_db.flush()

        # Pedido recibido.
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

        # Merma.
        client.post("/api/mermas", json={
            "ingrediente_id": frozen["karamo"].id, "cantidad": 2, "unidad": "unidad",
            "motivo": "roto",
        })

        # Segundo conteo manual, muy posterior al pedido (que usa la fecha de
        # hoy) — no debe incluir el bump del pedido en su delta.
        test_db.add(InventarioRegistro(
            ingrediente_id=frozen["karamo"].id, cantidad=20, unidad="unidad",
            fecha_registro=date(2030, 1, 1), ubicacion="BRU1",
        ))
        test_db.flush()

        movimientos = client.get(f"/api/ingredientes/{frozen['karamo'].id}/movimientos").json()
        tipos = {m["tipo"]: m for m in movimientos}

        assert tipos["pedido"]["cantidad"] == 10
        assert tipos["pedido"]["cantidad_actual"] == 15  # 5 base + 10 recibidos
        assert tipos["merma"]["cantidad"] == -2
        assert tipos["merma"]["cantidad_actual"] is None
        # Conteo del 2026-01-01: delta = 5 - 0 = 5 (primer conteo).
        # Conteo del 2030-01-01: delta = 20 - 15 (base 5 + pedido 10) = 5,
        # no 20 - 5 = 15 (eso duplicaría el pedido).
        conteos = sorted(
            [m for m in movimientos if m["tipo"] == "conteo"], key=lambda m: m["fecha"]
        )
        assert [c["cantidad"] for c in conteos] == [5, 5]
        assert [c["cantidad_actual"] for c in conteos] == [5, 20]

    def test_movimientos_padre_incluye_sabor(self, client, test_db, frozen):
        test_db.add_all([
            InventarioRegistro(
                ingrediente_id=frozen["karamo"].id, cantidad=5, unidad="unidad",
                fecha_registro=date(2026, 1, 1), ubicacion="BRU1",
            ),
            InventarioRegistro(
                ingrediente_id=frozen["perla"].id, cantidad=3, unidad="unidad",
                fecha_registro=date(2026, 1, 1), ubicacion="BRU1",
            ),
        ])
        test_db.flush()

        movimientos = client.get(f"/api/ingredientes/{frozen['parent'].id}/movimientos").json()
        sabores = {m["sabor"] for m in movimientos}
        assert sabores == {"Frozen Karamo Bru1", "Frozen Perla Bru1"}

    def test_movimientos_ingrediente_no_existe(self, client, seed):
        resp = client.get("/api/ingredientes/999999/movimientos")
        assert resp.status_code == 404


class TestHistorialFrozen:
    @pytest.fixture
    def tubos(self, test_db):
        """Mirrors the real production model: every frozen flavor has TWO
        separate child ingredients, one per parent/location (e.g. "Frozen
        Karamo Bru1" under parent 289, "Frozen Karamo Bru2" under parent
        290) — location lives in which parent a flavor belongs to, not in
        the `ubicacion` column on its InventarioRegistro rows."""
        cafe_cat = Categoria(id=5, nombre="Café", tipo="ingrediente")
        test_db.add(cafe_cat)
        test_db.flush()

        bru1 = Ingrediente(
            id=289, nombre="Tubos Frozen Bru1", categoria_id=5,
            unidad_compra="unidad", cantidad_compra=1, precio_compra=0,
            unidad_uso="unidad", merma_porcentaje=0.0,
        )
        bru2 = Ingrediente(
            id=290, nombre="Tubos Frozen Bru2", categoria_id=5,
            unidad_compra="unidad", cantidad_compra=1, precio_compra=0,
            unidad_uso="unidad", merma_porcentaje=0.0,
        )
        test_db.add_all([bru1, bru2])
        test_db.flush()

        karamo_bru1 = Ingrediente(
            nombre="Frozen Karamo Bru1", categoria_id=5,
            unidad_compra="unidad", cantidad_compra=1, precio_compra=3.0,
            unidad_uso="unidad", merma_porcentaje=0.0,
            grupo_ingrediente_id=289, suplemento_frozen=1.5, coste_kg_frozen=20.0,
        )
        karamo_bru2 = Ingrediente(
            nombre="Frozen Karamo Bru2", categoria_id=5,
            unidad_compra="unidad", cantidad_compra=1, precio_compra=3.0,
            unidad_uso="unidad", merma_porcentaje=0.0,
            grupo_ingrediente_id=290, suplemento_frozen=1.5, coste_kg_frozen=20.0,
        )
        # No suplemento_frozen/coste_kg_frozen set — mirrors the real
        # "Frozen Nicaragua El Suspiro missing frozen pricing columns" gap.
        # A flavor still counted in inventory must show up here regardless
        # of whether its retail pricing has been configured.
        perla_bru1 = Ingrediente(
            nombre="Frozen Perla Bru1", categoria_id=5,
            unidad_compra="unidad", cantidad_compra=1, precio_compra=3.0,
            unidad_uso="unidad", merma_porcentaje=0.0,
            grupo_ingrediente_id=289,
        )
        perla_bru2 = Ingrediente(
            nombre="Frozen Perla Bru2", categoria_id=5,
            unidad_compra="unidad", cantidad_compra=1, precio_compra=3.0,
            unidad_uso="unidad", merma_porcentaje=0.0,
            grupo_ingrediente_id=290,
        )
        test_db.add_all([karamo_bru1, karamo_bru2, perla_bru1, perla_bru2])
        test_db.flush()
        return {
            "bru1": bru1, "bru2": bru2,
            "karamo_bru1": karamo_bru1, "karamo_bru2": karamo_bru2,
            "perla_bru1": perla_bru1, "perla_bru2": perla_bru2,
        }

    def test_sin_tubos_frozen(self, client, seed):
        resp = client.get("/api/ingredientes/1/historial-frozen?ubicacion=BRU1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ubicacion"] == "BRU1"
        assert data["fechas"] == []
        assert data["sabores"] == []

    def test_ubicacion_invalida(self, client, tubos):
        resp = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU3")
        assert resp.status_code == 422

    def test_ingrediente_no_existe(self, client, tubos):
        resp = client.get("/api/ingredientes/999999/historial-frozen?ubicacion=BRU1")
        assert resp.status_code == 404

    def test_incluye_sabor_sin_precio_frozen_configurado(self, client, test_db, tubos):
        """Regression: a flavor missing suplemento_frozen/coste_kg_frozen
        (pricing not set up yet) must still show its counts — resolution is
        via grupo_ingrediente_id, not the pricing fields."""
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["perla_bru2"].id, cantidad=10, unidad="unidad",
            fecha_registro=date(2026, 8, 20),
        ))
        test_db.flush()

        data = client.get(f"/api/ingredientes/{tubos['perla_bru2'].id}/historial-frozen?ubicacion=BRU2").json()
        assert data["fechas"] == ["2026-08-20"]
        assert {s["nombre"] for s in data["sabores"]} == {"Frozen Perla Bru2"}
        assert data["sabores"][0]["valores"]["2026-08-20"]["cantidad"] == 10

    def test_excluye_sabores_inactivos(self, client, test_db, tubos):
        """A discontinued flavor (activo=False) keeps its historical
        InventarioRegistro rows, but must not show up here — matches the
        active-only "Stock Frozen Tubes" table (backed by /api/menu/frozen)
        right above it on the same page."""
        tubos["karamo_bru1"].activo = False
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["karamo_bru1"].id, cantidad=12, unidad="unidad",
            fecha_registro=date(2026, 8, 1),
        ))
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["perla_bru1"].id, cantidad=6, unidad="unidad",
            fecha_registro=date(2026, 8, 1),
        ))
        test_db.flush()

        data = client.get(f"/api/ingredientes/{tubos['perla_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        assert {s["nombre"] for s in data["sabores"]} == {"Frozen Perla Bru1"}

    def test_ubicacion_columna_ignorada_solo_importa_el_parent(self, client, test_db, tubos):
        """Regression for the 2026-08-20 bug: a record's `ubicacion` column
        must NOT gate visibility — only which parent (289/290) the flavor
        belongs to. A Bru1 flavor counted with ubicacion left null (as
        recibir_pedido() does when it inherits a null base) must still show
        under BRU1, and never under BRU2."""
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["karamo_bru1"].id, cantidad=12, unidad="unidad",
            fecha_registro=date(2026, 8, 20), ubicacion=None,
        ))
        test_db.flush()

        bru1 = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        assert bru1["fechas"] == ["2026-08-20"]
        assert bru1["sabores"][0]["valores"]["2026-08-20"]["cantidad"] == 12

        bru2 = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU2").json()
        assert bru2["fechas"] == []

    def test_conteos_por_ubicacion_y_carry_forward(self, client, test_db, tubos):
        test_db.add_all([
            InventarioRegistro(
                ingrediente_id=tubos["karamo_bru1"].id, cantidad=12, unidad="unidad",
                fecha_registro=date(2026, 8, 1),
            ),
            InventarioRegistro(
                ingrediente_id=tubos["karamo_bru1"].id, cantidad=9, unidad="unidad",
                fecha_registro=date(2026, 8, 5),
            ),
            # Perla only counted at BRU2 — must not leak into BRU1's response.
            InventarioRegistro(
                ingrediente_id=tubos["perla_bru2"].id, cantidad=4, unidad="unidad",
                fecha_registro=date(2026, 8, 3),
            ),
        ])
        test_db.flush()

        bru1 = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        assert bru1["fechas"] == ["2026-08-01", "2026-08-05"]
        sabores = {s["nombre"]: s for s in bru1["sabores"]}
        assert set(sabores) == {"Frozen Karamo Bru1"}  # Perla-Bru2 excluded
        assert sabores["Frozen Karamo Bru1"]["valores"]["2026-08-01"]["cantidad"] == 12
        assert sabores["Frozen Karamo Bru1"]["valores"]["2026-08-05"]["cantidad"] == 9

        bru2 = client.get(f"/api/ingredientes/{tubos['perla_bru2'].id}/historial-frozen?ubicacion=BRU2").json()
        assert bru2["fechas"] == ["2026-08-03"]
        assert {s["nombre"] for s in bru2["sabores"]} == {"Frozen Perla Bru2"}
        assert bru2["sabores"][0]["valores"]["2026-08-03"]["cantidad"] == 4

    def test_cero_si_no_forma_parte_de_la_ultima_sesion(self, client, test_db, tubos):
        """Flavors at a location are counted together in one synchronized
        session (per CLAUDE.md). A flavor left out of the most recent
        session shows 0 for that date, not its stale prior value."""
        test_db.add_all([
            InventarioRegistro(
                ingrediente_id=tubos["karamo_bru1"].id, cantidad=12, unidad="unidad",
                fecha_registro=date(2026, 8, 1),
            ),
            InventarioRegistro(
                ingrediente_id=tubos["perla_bru1"].id, cantidad=6, unidad="unidad",
                fecha_registro=date(2026, 8, 3),
            ),
        ])
        test_db.flush()

        data = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        assert data["fechas"] == ["2026-08-01", "2026-08-03"]
        sabores = {s["nombre"]: s for s in data["sabores"]}
        # On 08-01, Karamo IS the latest session — shows its real count.
        assert sabores["Frozen Karamo Bru1"]["valores"]["2026-08-01"]["cantidad"] == 12
        # By 08-03, Perla's count makes that the latest session — Karamo
        # wasn't part of it, so it reads 0, not the stale 12.
        assert sabores["Frozen Karamo Bru1"]["valores"]["2026-08-03"]["cantidad"] == 0
        # Perla had no count before 08-01 — no data yet for that date.
        assert sabores["Frozen Perla Bru1"]["valores"]["2026-08-01"]["cantidad"] is None
        assert sabores["Frozen Perla Bru1"]["valores"]["2026-08-03"]["cantidad"] == 6

    def test_pedido_exento_del_cero_aunque_no_sea_la_ultima_sesion(self, client, test_db, tubos):
        """A delivery for a flavor left out of the latest counting session
        must still show its own bumped total, not get zeroed — mirrors the
        es_recibido carve-out in stock_actual() (TestPedidoRecibirCafeFrozen)."""
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["karamo_bru1"].id, cantidad=5, unidad="unidad",
            fecha_registro=date(2026, 8, 1),
        ))
        test_db.flush()

        create = client.post("/api/pedidos", json={
            "proveedor": "Dabov",
            "lineas": [
                {"ingrediente_id": tubos["karamo_bru1"].id, "cantidad_pedida": 10, "unidad": "unidad"},
            ],
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 10}],
        })

        # Perla gets recounted after the delivery, becoming the latest session.
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["perla_bru1"].id, cantidad=6, unidad="unidad",
            fecha_registro=date(2026, 8, 10),
        ))
        test_db.flush()

        data = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        sabores = {s["nombre"]: s for s in data["sabores"]}
        pedido_date = [d for d in data["fechas"] if d not in ("2026-08-01", "2026-08-10")][0]
        # The delivery day itself: exempt, shows the bumped total (15).
        assert sabores["Frozen Karamo Bru1"]["valores"][pedido_date]["cantidad"] == 15
        # By 08-10 Karamo is genuinely stale (no delivery or count that day,
        # and Perla's count is now the latest session) — zeroed.
        assert sabores["Frozen Karamo Bru1"]["valores"]["2026-08-10"]["cantidad"] == 0
        assert sabores["Frozen Perla Bru1"]["valores"]["2026-08-10"]["cantidad"] == 6

    def test_pedido_marker_con_ubicacion_heredada_null(self, client, test_db, tubos):
        """Reproduces the exact 2026-08-20 bug: the initial manual count has
        no ubicacion set (as many real historical records don't), so
        recibir_pedido() inherits ubicacion=None for the auto-inserted
        "Pedido recibido" row too. The delivery must still show up and be
        marked as a pedido, purely because Karamo Bru1 belongs to parent 289."""
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["karamo_bru1"].id, cantidad=5, unidad="unidad",
            fecha_registro=date(2026, 8, 1), ubicacion=None,
        ))
        test_db.flush()

        create = client.post("/api/pedidos", json={
            "proveedor": "Dabov",
            "lineas": [
                {"ingrediente_id": tubos["karamo_bru1"].id, "cantidad_pedida": 10, "unidad": "unidad"},
            ],
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        recibir = client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": 10}],
        })
        assert recibir.status_code == 200

        data = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        today = data["fechas"][-1]
        karamo = data["sabores"][0]
        assert karamo["valores"][today]["cantidad"] == 15  # 5 base + 10 recibidos
        tipos = {e["tipo"] for e in karamo["valores"][today]["eventos"]}
        assert "pedido" in tipos

    def test_merma_marker_no_afecta_conteo(self, client, test_db, tubos):
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["karamo_bru1"].id, cantidad=8, unidad="unidad",
            fecha_registro=date(2026, 8, 1),
        ))
        test_db.flush()

        merma = client.post("/api/mermas", json={
            "ingrediente_id": tubos["karamo_bru1"].id, "cantidad": 2, "unidad": "unidad",
            "motivo": "roto", "fecha": "2026-08-04",
        })
        assert merma.status_code in (200, 201)

        data = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        assert "2026-08-04" in data["fechas"]
        karamo = data["sabores"][0]
        # No recount on 08-04 — quantity carries forward from the last count (8).
        assert karamo["valores"]["2026-08-04"]["cantidad"] == 8
        eventos = karamo["valores"]["2026-08-04"]["eventos"]
        assert len(eventos) == 1
        assert eventos[0]["tipo"] == "merma"
        assert eventos[0]["cantidad"] == -2

    def _recibir(self, client, ingrediente_id, cantidad):
        create = client.post("/api/pedidos", json={
            "proveedor": "Dabov",
            "lineas": [{"ingrediente_id": ingrediente_id, "cantidad_pedida": cantidad, "unidad": "unidad"}],
        })
        pid = create.json()["id"]
        lid = create.json()["lineas"][0]["id"]
        client.post(f"/api/pedidos/{pid}/enviar")
        client.post(f"/api/pedidos/{pid}/recibir", json={
            "lineas": [{"linea_id": lid, "cantidad_recibida": cantidad}],
        })

    def test_anadido_expone_la_cantidad_entregada(self, client, test_db, tubos):
        """The delivery's InventarioRegistro only stores the resulting total,
        so `anadido` has to be resolved from the pedido line the notas points
        at — that's what lets the cell render "15 (5+10)"."""
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["karamo_bru1"].id, cantidad=5, unidad="unidad",
            fecha_registro=date(2026, 8, 1),
        ))
        test_db.flush()
        self._recibir(client, tubos["karamo_bru1"].id, 10)

        data = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        entrega = data["fechas"][-1]
        celda = data["sabores"][0]["valores"][entrega]
        assert celda["cantidad"] == 15
        assert celda["anadido"] == 10
        # The count-only day has nothing added.
        assert data["sabores"][0]["valores"]["2026-08-01"]["anadido"] is None

    def test_anadido_suma_dos_entregas_el_mismo_dia(self, client, test_db, tubos):
        """Two pedidos can land on one flavor the same day (Mexico Geisha got
        #111 and #121 on 2026-09-23). per_child_days keeps only the last
        record, so the added amounts must be summed separately or the cell
        under-reports the day's gain."""
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["karamo_bru1"].id, cantidad=1, unidad="unidad",
            fecha_registro=date(2026, 8, 1),
        ))
        test_db.flush()
        self._recibir(client, tubos["karamo_bru1"].id, 6)
        self._recibir(client, tubos["karamo_bru1"].id, 6)

        data = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        entrega = data["fechas"][-1]
        assert data["sabores"][0]["valores"][entrega]["anadido"] == 12

    def test_totales_stock_anadido_consumido(self, client, test_db, tubos):
        """Footer rows. Consumido = stock previo + añadido − stock actual,
        so a day where everything delivered stays in the freezer reads 0."""
        test_db.add_all([
            InventarioRegistro(
                ingrediente_id=tubos["karamo_bru1"].id, cantidad=10, unidad="unidad",
                fecha_registro=date(2026, 8, 1),
            ),
            InventarioRegistro(
                ingrediente_id=tubos["perla_bru1"].id, cantidad=4, unidad="unidad",
                fecha_registro=date(2026, 8, 1),
            ),
            # Both recounted together on 08-05: 14 -> 9, so 5 tubes went out.
            InventarioRegistro(
                ingrediente_id=tubos["karamo_bru1"].id, cantidad=6, unidad="unidad",
                fecha_registro=date(2026, 8, 5),
            ),
            InventarioRegistro(
                ingrediente_id=tubos["perla_bru1"].id, cantidad=3, unidad="unidad",
                fecha_registro=date(2026, 8, 5),
            ),
        ])
        test_db.flush()

        data = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        totales = data["totales"]
        assert totales["2026-08-01"] == {"stock": 14.0, "anadido": 0.0, "consumido": None}
        assert totales["2026-08-05"] == {"stock": 9.0, "anadido": 0.0, "consumido": 5.0}

    def test_consumido_cero_cuando_solo_hubo_entrega(self, client, test_db, tubos):
        """A delivery-only day leaves every other flavor's value intact, so
        the whole gain lands in stock and nothing reads as consumed."""
        test_db.add(InventarioRegistro(
            ingrediente_id=tubos["karamo_bru1"].id, cantidad=5, unidad="unidad",
            fecha_registro=date(2026, 8, 1),
        ))
        test_db.flush()
        self._recibir(client, tubos["karamo_bru1"].id, 10)

        data = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        entrega = data["fechas"][-1]
        assert data["totales"][entrega] == {"stock": 15.0, "anadido": 10.0, "consumido": 0.0}

    def test_totales_solo_suman_sabores_visibles(self, client, test_db, tubos):
        """Totals are summed over the flavors actually returned, so the column
        adds up to what's rendered. An inactive flavor contributes nothing."""
        tubos["perla_bru1"].activo = False
        test_db.add_all([
            InventarioRegistro(
                ingrediente_id=tubos["karamo_bru1"].id, cantidad=10, unidad="unidad",
                fecha_registro=date(2026, 8, 1),
            ),
            InventarioRegistro(
                ingrediente_id=tubos["perla_bru1"].id, cantidad=7, unidad="unidad",
                fecha_registro=date(2026, 8, 1),
            ),
        ])
        test_db.flush()

        data = client.get(f"/api/ingredientes/{tubos['karamo_bru1'].id}/historial-frozen?ubicacion=BRU1").json()
        assert {s["nombre"] for s in data["sabores"]} == {"Frozen Karamo Bru1"}
        assert data["totales"]["2026-08-01"]["stock"] == 10.0


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


class TestPivotDesgloseUbicaciones:
    """The historial pivot shows a (BRU1, BRU2) breakdown next to each café
    cell, but only when both shops were counted that day and the two parts add
    up to the total shown next to them."""

    @pytest.fixture
    def cafe(self, test_db):
        cafe_cat = Categoria(id=5, nombre="Café", tipo="ingrediente")
        test_db.add(cafe_cat)
        test_db.flush()

        parent = Ingrediente(
            nombre="Café en grano ROJO", categoria_id=5,
            unidad_compra="kg", cantidad_compra=1, precio_compra=0,
            unidad_uso="kg", merma_porcentaje=0.0,
        )
        test_db.add(parent)
        test_db.flush()

        helena = Ingrediente(
            nombre="1kg DABOV Helena", categoria_id=5,
            unidad_compra="kg", cantidad_compra=1, precio_compra=20.0,
            unidad_uso="kg", merma_porcentaje=0.0,
            grupo_ingrediente_id=parent.id,
        )
        ethiopia = Ingrediente(
            nombre="1kg DABOV Ethiopia", categoria_id=5,
            unidad_compra="kg", cantidad_compra=1, precio_compra=22.0,
            unidad_uso="kg", merma_porcentaje=0.0,
            grupo_ingrediente_id=parent.id,
        )
        test_db.add_all([helena, ethiopia])
        test_db.flush()

        def reg(ing, cantidad, fecha, ubicacion):
            return InventarioRegistro(
                ingrediente_id=ing.id, cantidad=cantidad, unidad="kg",
                fecha_registro=fecha, ubicacion=ubicacion,
            )

        semana_a = date(2026, 1, 5)
        semana_b = date(2026, 1, 12)
        semana_c = date(2026, 1, 19)
        test_db.add_all([
            # Both shops counted: both leaves and the parent get a breakdown.
            reg(helena, 4, semana_a, "BRU1"),
            reg(helena, 2, semana_a, "BRU2"),
            reg(ethiopia, 3, semana_a, "BRU1"),
            reg(ethiopia, 1, semana_a, "BRU2"),
            # Only BRU1 counted Helena, both shops counted Ethiopia.
            reg(helena, 5, semana_b, "BRU1"),
            reg(ethiopia, 2, semana_b, "BRU1"),
            reg(ethiopia, 2, semana_b, "BRU2"),
            # Same shop twice the same day = correction, not two locations.
            reg(helena, 3, semana_c, "BRU1"),
            reg(helena, 7, semana_c, "BRU1"),
        ])
        test_db.flush()
        return {
            "parent": parent, "helena": helena, "ethiopia": ethiopia,
            "semana_a": semana_a, "semana_b": semana_b, "semana_c": semana_c,
        }

    @staticmethod
    def _fila(data, nombre):
        return next(r for r in data["ingredientes"] if r["ingrediente_nombre"] == nombre)

    def test_desglose_cuando_ambas_tiendas_contaron(self, client, cafe):
        from app.services.conversiones import to_week_key

        data = client.get("/api/inventario/pivot").json()
        semana = to_week_key(cafe["semana_a"])

        helena = self._fila(data, "1kg DABOV Helena")
        assert helena["fechas"][semana] == 6
        assert helena["fechas_ubic"][semana] == {"BRU1": 4, "BRU2": 2}

        ethiopia = self._fila(data, "1kg DABOV Ethiopia")
        assert ethiopia["fechas"][semana] == 4
        assert ethiopia["fechas_ubic"][semana] == {"BRU1": 3, "BRU2": 1}

    def test_sin_desglose_si_solo_conto_una_tienda(self, client, cafe):
        from app.services.conversiones import to_week_key

        data = client.get("/api/inventario/pivot").json()
        semana = to_week_key(cafe["semana_b"])

        helena = self._fila(data, "1kg DABOV Helena")
        assert helena["fechas"][semana] == 5
        assert semana not in helena["fechas_ubic"]

    def test_correccion_misma_tienda_no_es_desglose(self, client, cafe):
        from app.services.conversiones import to_week_key

        data = client.get("/api/inventario/pivot").json()
        semana = to_week_key(cafe["semana_c"])

        helena = self._fila(data, "1kg DABOV Helena")
        assert helena["fechas"][semana] == 7
        assert semana not in helena["fechas_ubic"]

    def test_fila_total_suma_desglose_de_hijos(self, client, cafe):
        from app.services.conversiones import to_week_key

        data = client.get("/api/inventario/pivot").json()
        parent = self._fila(data, "Café en grano ROJO")
        semana = to_week_key(cafe["semana_a"])

        assert parent["fechas"][semana] == 10
        assert parent["fechas_ubic"][semana] == {"BRU1": 7, "BRU2": 3}

    def test_fila_total_sin_desglose_si_un_hijo_no_lo_tiene(self, client, cafe):
        from app.services.conversiones import to_week_key

        data = client.get("/api/inventario/pivot").json()
        parent = self._fila(data, "Café en grano ROJO")
        semana = to_week_key(cafe["semana_b"])

        # Helena solo se conto en BRU1 esa semana, asi que el total no puede
        # mostrar un desglose que sume menos de lo que se ve al lado.
        assert parent["fechas"][semana] == 9
        assert semana not in parent["fechas_ubic"]

    def test_no_cafe_nunca_lleva_desglose(self, client, test_db, seed):
        test_db.add(InventarioRegistro(
            ingrediente_id=seed["fresas"].id, cantidad=3, unidad="kg",
            fecha_registro=date(2026, 1, 5), ubicacion="BRU1",
        ))
        test_db.add(InventarioRegistro(
            ingrediente_id=seed["fresas"].id, cantidad=2, unidad="kg",
            fecha_registro=date(2026, 1, 5), ubicacion="BRU2",
        ))
        test_db.flush()

        data = client.get("/api/inventario/pivot").json()
        fresas = self._fila(data, "Fresas")
        # Cocina es de una sola ubicacion: gana el ultimo registro, sin desglose.
        assert fresas["fechas_ubic"] == {}


class TestConsumoSemanalMismaUbicacion:
    """Two records at the SAME ubicacion on the same day are a correction
    (latest wins), not two locations to add up. `_consumo_semanal_leaf` used
    to sum every same-day record raw, so a re-count inflated that day's stock
    and the following interval's consumption.

    Reported 2026-09-30 on /ingredientes/73 (Café en grano MARRÓN): the
    "Consumo Semanal" bar for w39.26 read 31 kg while the stock line only
    dropped 43 -> 30. Ruanda Mahembe had two BRU1 rows of 18 on 2026-09-17,
    summed to 36, so its consumption came out 36 - 9 = 27 instead of 9."""

    @pytest.fixture
    def cafe_leaf(self, test_db):
        test_db.add(Categoria(id=5, nombre="Café", tipo="ingrediente", seccion="cafe"))
        test_db.flush()
        ing = Ingrediente(
            nombre="1kg DABOV Ruanda Mahembe", categoria_id=5,
            unidad_compra="kg", cantidad_compra=1, precio_compra=20.0,
            unidad_uso="kg", merma_porcentaje=0.0,
        )
        otro = Ingrediente(
            nombre="Otro", categoria_id=5,
            unidad_compra="kg", cantidad_compra=1, precio_compra=1.0,
            unidad_uso="kg", merma_porcentaje=0.0,
        )
        test_db.add_all([ing, otro])
        test_db.flush()

        # Un pedido recibido cualquiera fija la ventana temporal que usa
        # _consumo_semanal_leaf; es de OTRO ingrediente para no aportar
        # cantidad recibida a este.
        pedido = Pedido(
            fecha=date(2026, 9, 23), proveedor="Dabov",
            estado="recibido", fecha_recepcion=date(2026, 9, 23),
        )
        test_db.add(pedido)
        test_db.flush()
        test_db.add(LineaPedido(
            pedido_id=pedido.id, ingrediente_id=otro.id,
            cantidad_pedida=1, cantidad_recibida=1, unidad="kg",
        ))

        test_db.add_all([
            # Sesion del 17: se cuenta BRU1=18, se corrige a 18 otra vez, BRU2=0.
            InventarioRegistro(
                ingrediente_id=ing.id, cantidad=18, unidad="kg",
                fecha_registro=date(2026, 9, 17), ubicacion="BRU1",
            ),
            InventarioRegistro(
                ingrediente_id=ing.id, cantidad=18, unidad="kg",
                fecha_registro=date(2026, 9, 17), ubicacion="BRU1",
            ),
            InventarioRegistro(
                ingrediente_id=ing.id, cantidad=0, unidad="kg",
                fecha_registro=date(2026, 9, 17), ubicacion="BRU2",
            ),
            # Sesion del 23: BRU1=9, BRU2=0.
            InventarioRegistro(
                ingrediente_id=ing.id, cantidad=9, unidad="kg",
                fecha_registro=date(2026, 9, 23), ubicacion="BRU1",
            ),
            InventarioRegistro(
                ingrediente_id=ing.id, cantidad=0, unidad="kg",
                fecha_registro=date(2026, 9, 23), ubicacion="BRU2",
            ),
        ])
        test_db.flush()
        return ing

    def test_duplicado_misma_ubicacion_no_infla_consumo(self, test_db, cafe_leaf):
        from app.services.consumo import consumo_semanal

        data = {x["semana"]: x["cantidad"] for x in consumo_semanal(cafe_leaf.id, test_db)}
        # 18 (no 36) - 9 = 9, coherente con lo que muestra la serie de stock.
        assert data["w39.26"] == 9

    def test_consumo_cuadra_con_la_serie_de_stock(self, test_db, cafe_leaf):
        from app.services.consumo import consumo_semanal, stock_actual

        data = {x["semana"]: x["cantidad"] for x in consumo_semanal(cafe_leaf.id, test_db)}
        stock_17 = 18  # lo que reporta _day_total para el 17
        assert stock_actual(cafe_leaf.id, test_db)["cantidad"] == 9
        assert data["w39.26"] == stock_17 - 9

    def test_ubicaciones_distintas_siguen_sumando(self, test_db, cafe_leaf):
        """La corrección no debe romper el caso normal BRU1 + BRU2."""
        from app.services.consumo import consumo_semanal

        test_db.query(InventarioRegistro).filter(
            InventarioRegistro.ingrediente_id == cafe_leaf.id,
            InventarioRegistro.fecha_registro == date(2026, 9, 23),
            InventarioRegistro.ubicacion == "BRU2",
        ).update({"cantidad": 4})
        test_db.flush()

        data = {x["semana"]: x["cantidad"] for x in consumo_semanal(cafe_leaf.id, test_db)}
        # 18 - (9 + 4) = 5
        assert data["w39.26"] == 5

    def test_batch_coincide_con_la_version_individual(self, test_db, cafe_leaf):
        """consumo_medio_batch() duplica la lógica de consumo_medio_semanal();
        si una aplica la regla de corrección y la otra no, el listado de
        inventario y la ficha del ingrediente muestran cifras distintas."""
        from app.services.consumo import consumo_medio_batch, consumo_medio_semanal

        batch = consumo_medio_batch([cafe_leaf.id], test_db)
        assert batch[cafe_leaf.id]["consumo_medio"] == consumo_medio_semanal(
            cafe_leaf.id, test_db
        )

    def test_catalogo_cafe_no_infla_el_stock(self, client, test_db, cafe_leaf):
        """/api/cafe/catalogo tenía el mismo raw-sum. El catálogo solo mira el
        último día contado, así que la corrección tiene que estar ahí: se
        recuenta BRU1 del 23 y pasa de 9 a 7. Correcto = 7 + 0 (BRU2); el
        raw-sum daría 9 + 0 + 7 = 16."""
        test_db.add(InventarioRegistro(
            ingrediente_id=cafe_leaf.id, cantidad=7, unidad="kg",
            fecha_registro=date(2026, 9, 23), ubicacion="BRU1",
        ))
        test_db.flush()

        items = client.get("/api/cafe/catalogo").json()

        encontrado = None
        stack = [items]
        while stack:
            cur = stack.pop()
            if isinstance(cur, dict):
                if cur.get("id") == cafe_leaf.id:
                    encontrado = cur
                    break
                stack.extend(cur.values())
            elif isinstance(cur, list):
                stack.extend(cur)

        assert encontrado is not None, "el ingrediente no aparece en el catalogo"
        assert encontrado["stock"] == 7
