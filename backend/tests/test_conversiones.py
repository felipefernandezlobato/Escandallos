import pytest

from app.services.conversiones import convertir, son_compatibles, cantidad_en_unidades_uso


def test_kg_a_g():
    assert convertir(1, "kg", "g") == 1000


def test_g_a_kg():
    assert convertir(500, "g", "kg") == 0.5


def test_litro_a_ml():
    assert convertir(1, "litro", "ml") == 1000


def test_litro_a_cl():
    assert convertir(1, "litro", "cl") == 100


def test_cl_a_ml():
    assert convertir(1, "cl", "ml") == 10


def test_misma_unidad():
    assert convertir(42, "kg", "kg") == 42


def test_unidad_a_unidad():
    assert convertir(5, "unidad", "unidad") == 5


def test_incompatibles():
    with pytest.raises(ValueError):
        convertir(1, "kg", "ml")


def test_son_compatibles_peso():
    assert son_compatibles("kg", "g") is True
    assert son_compatibles("g", "mg") is True


def test_son_compatibles_volumen():
    assert son_compatibles("litro", "ml") is True
    assert son_compatibles("cl", "litro") is True


def test_no_compatibles():
    assert son_compatibles("kg", "litro") is False
    assert son_compatibles("unidad", "g") is False


def test_cantidad_en_unidades_uso():
    assert cantidad_en_unidades_uso(25, "kg", "g") == 25000
    assert cantidad_en_unidades_uso(6, "litro", "ml") == 6000
