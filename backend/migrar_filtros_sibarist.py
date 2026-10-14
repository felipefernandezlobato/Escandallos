"""Give the Sibarist filters their own ingredient category.

Categoría 17 "Cafetería" does two unrelated jobs: it is the RECIPE category of
the 31 coffee drinks (margen 80%) and it also holds 52 Sibarist filter papers,
which are ingredients. Because its `tipo` is "receta", the frontend — which
fetches `/api/categorias?tipo=ingrediente` — never receives it, so those 52
ingredients only resolve through a `nombre.includes("sibarist")` fallback in
`matchesVista`/`cafeSectionIds`. Anything else placed in that category would be
invisible in every section.

Flipping `tipo` is NOT the fix: it would strip the 31 recipes of their category
and margin target. Instead the ingredients move to a new ingredient category,
leaving 17 purely a recipe category.

Nothing changes on screen: the counting form already extracts Sibarist items
into their own "Sibarist" heading by name and drops the emptied category group.

Usage:  python migrar_filtros_sibarist.py             (dry run)
        python migrar_filtros_sibarist.py --aplicar    (writes)
"""
import os
import sys

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_HxCRZJiBM3K0@ep-sparkling-morning-asxoz7zv.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require",
)
from app.database import SessionLocal  # noqa: E402
from app.models import Categoria, Ingrediente, Receta  # noqa: E402

APLICAR = "--aplicar" in sys.argv
CAT_ORIGEN = 17
NOMBRE_NUEVA = "Filtros"

db = SessionLocal()
try:
    origen = db.get(Categoria, CAT_ORIGEN)
    assert origen is not None, "no existe la categoría 17"

    a_mover = db.query(Ingrediente).filter(Ingrediente.categoria_id == CAT_ORIGEN).all()
    recetas = db.query(Receta).filter(Receta.categoria_id == CAT_ORIGEN).count()

    print(f"categoría origen : {origen.id} {origen.nombre!r} tipo={origen.tipo} "
          f"seccion={origen.seccion} margen={origen.margen_objetivo}")
    print(f"  recetas que se QUEDAN      : {recetas}")
    print(f"  ingredientes que se MUEVEN : {len(a_mover)}")

    no_sibarist = [i.nombre for i in a_mover if "sibarist" not in i.nombre.lower()]
    if no_sibarist:
        print(f"  ATENCION, no son Sibarist  : {no_sibarist}")

    existente = db.query(Categoria).filter(Categoria.nombre == NOMBRE_NUEVA).first()
    if existente:
        print(f"\nla categoría {NOMBRE_NUEVA!r} ya existe (id {existente.id}), se reutiliza")
    else:
        print(f"\nse creará la categoría {NOMBRE_NUEVA!r} "
              f"tipo=ingrediente seccion=cafe orden={(origen.orden or 24)}")

    if not APLICAR:
        print("\nDRY RUN. Nada escrito. Repite con --aplicar para guardar.")
        sys.exit(0)

    destino = existente
    if destino is None:
        destino = Categoria(
            nombre=NOMBRE_NUEVA,
            tipo="ingrediente",
            # Keeps them in the café section of the inventory, which is what
            # cafe_categoria_ids() reads to require a BRU1/BRU2 ubicacion.
            seccion="cafe",
            orden=origen.orden,
        )
        db.add(destino)
        db.flush()

    for ing in a_mover:
        ing.categoria_id = destino.id
    db.commit()

    quedan = db.query(Ingrediente).filter(Ingrediente.categoria_id == CAT_ORIGEN).count()
    movidos = db.query(Ingrediente).filter(Ingrediente.categoria_id == destino.id).count()
    recetas_tras = db.query(Receta).filter(Receta.categoria_id == CAT_ORIGEN).count()
    print(f"\nhecho. categoría {NOMBRE_NUEVA!r} = id {destino.id}")
    print(f"  ingredientes movidos        : {movidos}")
    print(f"  ingredientes que quedan en 17: {quedan} (debe ser 0)")
    print(f"  recetas en 17               : {recetas_tras} (debe seguir siendo {recetas})")
    assert quedan == 0 and recetas_tras == recetas, "la migración no cuadró"
finally:
    db.close()
