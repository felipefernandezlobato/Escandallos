import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Categoria, Ingrediente, LineaReceta, Receta
from app.services.costes import (
    coste_por_racion,
    coste_por_unidad_uso,
    coste_total_receta,
    margen_real,
    recetas_afectadas_por_ingrediente,
)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def datos_base(db):
    cat_ing = Categoria(nombre="Fruta", tipo="ingrediente")
    cat_rec = Categoria(nombre="Brunch", tipo="receta", margen_objetivo=65.0)
    db.add_all([cat_ing, cat_rec])
    db.flush()

    fresas = Ingrediente(
        nombre="Fresas",
        categoria_id=cat_ing.id,
        unidad_compra="kg",
        cantidad_compra=1,
        precio_compra=4.50,
        unidad_uso="g",
        merma_porcentaje=15.0,
        proveedor="FrutaFresca",
    )
    huevos = Ingrediente(
        nombre="Huevos",
        categoria_id=cat_ing.id,
        unidad_compra="unidad",
        cantidad_compra=12,
        precio_compra=3.60,
        unidad_uso="unidad",
        merma_porcentaje=0.0,
    )
    db.add_all([fresas, huevos])
    db.flush()

    return {
        "cat_ing": cat_ing,
        "cat_rec": cat_rec,
        "fresas": fresas,
        "huevos": huevos,
    }


def test_coste_por_unidad_uso_con_merma(datos_base):
    fresas = datos_base["fresas"]
    cpu = coste_por_unidad_uso(fresas)
    # 4.50 / 1000g / (1 - 0.15) = 0.005294...
    assert abs(cpu - 0.005294) < 0.0001


def test_coste_por_unidad_uso_sin_merma(datos_base):
    huevos = datos_base["huevos"]
    cpu = coste_por_unidad_uso(huevos)
    # 3.60 / 12 / (1 - 0) = 0.30
    assert cpu == pytest.approx(0.30)


def test_coste_total_receta(db, datos_base):
    receta = Receta(
        nombre="Tostada de fresas",
        categoria_id=datos_base["cat_rec"].id,
        porciones_por_lote=2,
        precio_venta=8.50,
    )
    db.add(receta)
    db.flush()

    linea_fresas = LineaReceta(
        receta_id=receta.id,
        ingrediente_id=datos_base["fresas"].id,
        cantidad=150,
        unidad="g",
    )
    linea_huevos = LineaReceta(
        receta_id=receta.id,
        ingrediente_id=datos_base["huevos"].id,
        cantidad=2,
        unidad="unidad",
    )
    db.add_all([linea_fresas, linea_huevos])
    db.flush()

    receta.lineas = [linea_fresas, linea_huevos]
    linea_fresas.ingrediente_rel = datos_base["fresas"]
    linea_huevos.ingrediente_rel = datos_base["huevos"]

    total = coste_total_receta(receta, db)
    # fresas: 0.005294 * 150 = 0.7941
    # huevos: 0.30 * 2 = 0.60
    # total = 1.3941
    assert total == pytest.approx(1.3941, abs=0.01)


def test_coste_por_racion_ok(db, datos_base):
    receta = Receta(
        nombre="Tostada de fresas",
        categoria_id=datos_base["cat_rec"].id,
        porciones_por_lote=2,
        precio_venta=8.50,
    )
    db.add(receta)
    db.flush()

    linea = LineaReceta(
        receta_id=receta.id,
        ingrediente_id=datos_base["huevos"].id,
        cantidad=4,
        unidad="unidad",
    )
    db.add(linea)
    db.flush()

    receta.lineas = [linea]
    linea.ingrediente_rel = datos_base["huevos"]

    cpr = coste_por_racion(receta, db)
    # 0.30 * 4 / 2 = 0.60
    assert cpr == pytest.approx(0.60)


def test_margen_real_ok(db, datos_base):
    receta = Receta(
        nombre="Tostada",
        categoria_id=datos_base["cat_rec"].id,
        porciones_por_lote=1,
        precio_venta=10.0,
    )
    db.add(receta)
    db.flush()

    linea = LineaReceta(
        receta_id=receta.id,
        ingrediente_id=datos_base["huevos"].id,
        cantidad=2,
        unidad="unidad",
    )
    db.add(linea)
    db.flush()

    receta.lineas = [linea]
    linea.ingrediente_rel = datos_base["huevos"]

    margen = margen_real(receta, db)
    # coste = 0.60, precio = 10.0 → margen = (10 - 0.60) / 10 * 100 = 94%
    assert margen == pytest.approx(94.0)


def test_margen_real_sin_precio(db, datos_base):
    receta = Receta(
        nombre="Test",
        categoria_id=datos_base["cat_rec"].id,
        porciones_por_lote=1,
    )
    db.add(receta)
    db.flush()
    receta.lineas = []
    assert margen_real(receta, db) is None


def test_subreceta_coste(db, datos_base):
    subreceta = Receta(
        nombre="Salsa Holandesa",
        categoria_id=datos_base["cat_rec"].id,
        porciones_por_lote=4,
        es_subreceta=True,
    )
    db.add(subreceta)
    db.flush()

    linea_sub = LineaReceta(
        receta_id=subreceta.id,
        ingrediente_id=datos_base["huevos"].id,
        cantidad=3,
        unidad="unidad",
    )
    db.add(linea_sub)
    db.flush()

    subreceta.lineas = [linea_sub]
    linea_sub.ingrediente_rel = datos_base["huevos"]

    receta = Receta(
        nombre="Eggs Benedict",
        categoria_id=datos_base["cat_rec"].id,
        porciones_por_lote=1,
        precio_venta=14.50,
    )
    db.add(receta)
    db.flush()

    linea_receta = LineaReceta(
        receta_id=receta.id,
        subreceta_id=subreceta.id,
        cantidad=1,
        unidad="unidad",
    )
    db.add(linea_receta)
    db.flush()

    receta.lineas = [linea_receta]
    linea_receta.subreceta_rel = subreceta

    total = coste_total_receta(receta, db)
    # subreceta: 0.30 * 3 = 0.90 total / 4 porciones = 0.225 per porcion
    # receta uses 1 porcion = 0.225
    assert total == pytest.approx(0.225)


def test_recetas_afectadas_cascada(db, datos_base):
    subreceta = Receta(
        nombre="Base",
        categoria_id=datos_base["cat_rec"].id,
        porciones_por_lote=1,
        es_subreceta=True,
    )
    receta = Receta(
        nombre="Plato",
        categoria_id=datos_base["cat_rec"].id,
        porciones_por_lote=1,
    )
    db.add_all([subreceta, receta])
    db.flush()

    linea1 = LineaReceta(
        receta_id=subreceta.id,
        ingrediente_id=datos_base["fresas"].id,
        cantidad=100,
        unidad="g",
    )
    linea2 = LineaReceta(
        receta_id=receta.id,
        subreceta_id=subreceta.id,
        cantidad=1,
        unidad="unidad",
    )
    db.add_all([linea1, linea2])
    db.commit()

    afectadas = recetas_afectadas_por_ingrediente(datos_base["fresas"].id, db)
    nombres = {r.nombre for r in afectadas}
    assert "Base" in nombres
    assert "Plato" in nombres
