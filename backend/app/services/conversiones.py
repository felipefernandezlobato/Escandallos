CONVERSIONES: dict[str, dict[str, float]] = {
    "kg": {"kg": 1, "g": 1000, "mg": 1_000_000},
    "g": {"kg": 0.001, "g": 1, "mg": 1000},
    "mg": {"kg": 0.000001, "g": 0.001, "mg": 1},
    "litro": {"litro": 1, "ml": 1000, "cl": 100},
    "ml": {"litro": 0.001, "ml": 1, "cl": 0.1},
    "cl": {"litro": 0.01, "ml": 10, "cl": 1},
    "unidad": {"unidad": 1},
}

FAMILIAS: dict[str, str] = {}
for unidad, conversiones in CONVERSIONES.items():
    familia = sorted(conversiones.keys())[0]
    for u in conversiones:
        if u not in FAMILIAS:
            FAMILIAS[u] = familia


def son_compatibles(unidad_a: str, unidad_b: str) -> bool:
    a = unidad_a.lower()
    b = unidad_b.lower()
    return a in CONVERSIONES and b in CONVERSIONES.get(a, {})


def convertir(cantidad: float, de_unidad: str, a_unidad: str) -> float:
    de = de_unidad.lower()
    a = a_unidad.lower()
    if de == a:
        return cantidad
    if de not in CONVERSIONES or a not in CONVERSIONES[de]:
        raise ValueError(f"No se puede convertir de '{de_unidad}' a '{a_unidad}'")
    return cantidad * CONVERSIONES[de][a]


def cantidad_en_unidades_uso(
    cantidad_compra: float, unidad_compra: str, unidad_uso: str
) -> float:
    return convertir(cantidad_compra, unidad_compra, unidad_uso)


def to_week_key(d) -> str:
    iso = d.isocalendar()
    return f"w{iso[1]}.{str(iso[0])[2:]}"
