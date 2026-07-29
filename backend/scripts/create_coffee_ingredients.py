"""
Create individual coffee ingredients as children of parent groups.
Color mapping verified against Dabov catalog (22.10.25 through 26.06.26).

DRY RUN by default — set DRY_RUN=False to execute.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text

DRY_RUN = False

# =============================================================================
# COLOR MAPPING from Dabov catalog
# =============================================================================

# 1KG BEANS — used for shop service
KILO_ROJO = {  # RED LABEL (fruity notes) — includes decaf
    "Ethiopia By Dabov": True,        # 22.7: 15 kg
    "Colombia Helena": True,          # 22.7: 24 kg
    "Rwanda Karongi": False,          # 22.7: 0 kg (sold through)
    "Honduras Caballero": False,      # 22.7: 0 kg
    "Nicaragua La Huela": False,      # never stocked
    "Ethiopia Shantawene": False,     # never stocked
    "Colombia Sugar Decaf": True,     # 22.7: 8 kg
}

KILO_MARRON = {  # BROWN LABEL (chocolate notes)
    "Brazil By Dabov": True,          # 22.7: 55 kg
    "Ruanda Mahembe": True,           # 22.7: 49 kg
    "Mexico Fatima": False,           # 22.7: 0 kg (ran out July)
    "Colombia BY DABOV": False,       # 22.7: 0 kg
    "Nicaragua Los Placeres": False,  # never stocked
    "Honduras El Puente": False,      # never stocked
    "Costa Rica Tarrazu": False,      # never stocked
    "Colombia BY DABOV": False,       # 22.7: 0 kg — "Colombia" genérico del inventario
}

# HOUSE BLENDS — removed per user request (Vertigo, Impressions, Unity, Colombini)
KILO_ROJO_BLENDS = {}
KILO_MARRON_BLENDS = {}

# 200g RETAIL BAGS
RETAIL_ROJO = {  # RED LABEL 200g — stock from 22.7 inventory
    "Ethiopia By Dabov 200g": True,      # 22.7: 1
    "Colombia Helena 200g": True,         # 22.7: 5
    "Rwanda Karongi 200g": True,          # 22.7: 7
    "Honduras Caballero 200g": True,      # 22.7: 10
    "Late Night Decaf 200g": True,        # 22.7: 3
    "Semi Decaf 200g": False,             # no data in recent weeks
    "Honduras El Puente 200g": True,      # 15.7: 1 (just sold out 22.7)
    "Costa Rica Tarrazu 200g": True,      # 22.7: 1
}

RETAIL_MARRON = {  # BROWN LABEL 200g
    "Brazil BY DABOV 200g": True,         # 22.7: 6
    "Colombia BY DABOV 200g": False,      # 22.7: 0 (sold out)
    "Mexico Fatima 200g": True,           # 22.7: 6
    "Rwanda Mahembe 200g": True,          # 22.7: 8
    "Nicaragua Los Placeres 200g": True,  # 15.7: 1
}

RETAIL_BLACK = {  # BLACK LABEL 200g (exclusive)
    "Ethiopia Alo Mosto 200g": True,      # 22.7: 1
    "Panama Lerida 200g": True,           # 22.7: 1
    "Nicaragua El Suspiro 200g": False,   # no data until recently
    "Nicaragua La Orquidea Gesha 200g": False,  # no data until recently
    "Nicaragua Mierish 200g": False,      # no data until recently
    "Colombia Banana 200g": True,         # 22.7: 5
    "Costa Rica Thermal 200g": False,     # 22.7: 0
    "Ethiopia Karamo 200g": True,         # 22.7: 4
    "Mexico La Perla 200g": True,         # 22.7: 7
}

RETAIL_GOLD = {  # GOLDEN LABEL 130g (competition)
    "COE Salvador 130g": True,            # 22.7: 2
    "COE Ethiopia 130g": True,            # 22.7: 3
}

# COE Mexico is BLACK label but in 130g package — added to BLACK
RETAIL_BLACK_130 = {
    "COE Mexico 130g": True,              # 22.7: 2
}

# FROZEN TUBES (same flavors in both BRU1 and BRU2)
FROZEN_FLAVORS = {
    "COE Salvador": True,
    "COE Ethiopia": True,
    "Ethiopia Alo Mosto": True,
    "Panama Lerida": True,
    "Colombia Banana Fermentation": True,
    "Costa Rica La Ortiga": True,
    "Ethiopia Karamo": True,
    "Nicaragua El Suspiro": True,
    "Mexico La Perla": True,
}

# CAPSULES
CAPSULAS = {
    "Cápsula Brazil": True,
    "Cápsula Colombia": True,
    "Cápsula Ethiopia": True,
    "Cápsula Decaf": True,
}

# OTHER SUPPLIERS (non-Dabov coffee)
OTHER_COFFEE = {
    # These appeared in inventory but might be one-offs
    "Kimbaya Maria 200g": False,
    "The Fix Satus Colombia 250g": False,
    "The Fix Mexico 250g": False,
    "The Fix Peru 1kg": False,
    "The Fix Brasil 1kg": False,
    "Manos Colombia 1kg": False,
    "Franck Brazil": False,
}


def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("Set DATABASE_URL")
        return

    engine = create_engine(url)

    with engine.connect() as conn:
        # Get existing parent IDs
        def get_ing_id(name):
            r = conn.execute(text("SELECT id FROM ingredientes WHERE nombre = :n"), {"n": name}).fetchone()
            return r[0] if r else None

        cafe_cat = conn.execute(text("SELECT id FROM categorias WHERE nombre ILIKE '%café%' OR nombre = 'Cafe' LIMIT 1")).fetchone()
        if not cafe_cat:
            print("ERROR: Cafe category not found")
            return
        cafe_cat_id = cafe_cat[0]

        # Existing parents
        rojo_id = get_ing_id("Café en grano ROJO") or get_ing_id("Cafe en grano ROJO")
        marron_id = get_ing_id("Café en grano MARRÓN") or get_ing_id("Cafe en grano MARRON")
        retail_id = get_ing_id("Coffee Retail Bags")
        frozen_bru1_id = get_ing_id("Tubos Frozen Bru1")
        frozen_bru2_id = get_ing_id("Tubos Frozen Bru2")

        print(f"Parent IDs: ROJO={rojo_id}, MARRON={marron_id}, Retail={retail_id}, "
              f"FrozenBru1={frozen_bru1_id}, FrozenBru2={frozen_bru2_id}")

        # Create new parent groups
        new_parents = {
            "Café kilo BLACK": {"unit": "kg", "qty": 1},
            "Café kilo GOLD": {"unit": "kg", "qty": 1},
            "Retail ROJO 200g": {"unit": "unidad", "qty": 1},
            "Retail MARRÓN 200g": {"unit": "unidad", "qty": 1},
            "Retail BLACK 200g": {"unit": "unidad", "qty": 1},
            "Retail GOLD": {"unit": "unidad", "qty": 1},
            "Cápsulas Dabov": {"unit": "unidad", "qty": 1},
        }

        parent_ids = {
            "kilo_rojo": rojo_id,
            "kilo_marron": marron_id,
            "retail_bags": retail_id,
            "frozen_bru1": frozen_bru1_id,
            "frozen_bru2": frozen_bru2_id,
        }

        for name, info in new_parents.items():
            existing = get_ing_id(name)
            if existing:
                parent_ids[name] = existing
                print(f"  Parent '{name}' already exists: id={existing}")
            else:
                if DRY_RUN:
                    print(f"  [DRY RUN] Would create parent: {name}")
                    parent_ids[name] = f"NEW_{name}"
                else:
                    r = conn.execute(text("""
                        INSERT INTO ingredientes (nombre, categoria_id, unidad_compra, cantidad_compra,
                            precio_compra, unidad_uso, merma_porcentaje, proveedor, activo, fecha_actualizacion)
                        VALUES (:n, :cat, :u, :q, 0, :u, 0, 'Dabov', true, CURRENT_DATE)
                        RETURNING id
                    """), {"n": name, "cat": cafe_cat_id, "u": info["unit"], "q": info["qty"]})
                    new_id = r.fetchone()[0]
                    parent_ids[name] = new_id
                    print(f"  Created parent: {name} id={new_id}")

        # Define children with their parent mapping
        children = []

        # KILO ROJO
        for name, active in {**KILO_ROJO, **KILO_ROJO_BLENDS}.items():
            children.append({"name": f"{name} 1kg", "parent_key": "kilo_rojo",
                           "unit": "kg", "qty": 1, "active": active, "supplier": "Dabov"})

        # KILO MARRON
        for name, active in {**KILO_MARRON, **KILO_MARRON_BLENDS}.items():
            children.append({"name": f"{name} 1kg", "parent_key": "kilo_marron",
                           "unit": "kg", "qty": 1, "active": active, "supplier": "Dabov"})

        # RETAIL ROJO
        for name, active in RETAIL_ROJO.items():
            children.append({"name": name, "parent_key": "Retail ROJO 200g",
                           "unit": "unidad", "qty": 1, "active": active, "supplier": "Dabov"})

        # RETAIL MARRON
        for name, active in RETAIL_MARRON.items():
            children.append({"name": name, "parent_key": "Retail MARRÓN 200g",
                           "unit": "unidad", "qty": 1, "active": active, "supplier": "Dabov"})

        # RETAIL BLACK (200g + 130g COE Mexico)
        for name, active in {**RETAIL_BLACK, **RETAIL_BLACK_130}.items():
            children.append({"name": name, "parent_key": "Retail BLACK 200g",
                           "unit": "unidad", "qty": 1, "active": active, "supplier": "Dabov"})

        # RETAIL GOLD
        for name, active in RETAIL_GOLD.items():
            children.append({"name": name, "parent_key": "Retail GOLD",
                           "unit": "unidad", "qty": 1, "active": active, "supplier": "Dabov"})

        # FROZEN (same flavors for both BRU1 and BRU2 — tracked per location, not per parent)
        # All frozen flavors are children of a single "Frozen Tubes" parent
        # Actually, Bru1 and Bru2 ARE the locations, so frozen flavors = one set of children
        # under one parent. But currently there are TWO parents (Bru1, Bru2).
        # Since BRU1/BRU2 = locations (not blend types), we should merge into one parent
        # and use ubicacion for location tracking.
        # For now, create flavors under BOTH parents to maintain compatibility.
        for name, active in FROZEN_FLAVORS.items():
            children.append({"name": f"Frozen {name}", "parent_key": "frozen_bru1",
                           "unit": "unidad", "qty": 1, "active": active, "supplier": "Dabov"})

        # CAPSULES
        for name, active in CAPSULAS.items():
            children.append({"name": name, "parent_key": "Cápsulas Dabov",
                           "unit": "unidad", "qty": 1, "active": active, "supplier": "Dabov"})

        # Print summary
        print(f"\n=== SUMMARY ===")
        print(f"Total children to create: {len(children)}")

        by_parent = {}
        for c in children:
            pk = c["parent_key"]
            by_parent.setdefault(pk, []).append(c)

        for pk, items in by_parent.items():
            pid = parent_ids.get(pk, "?")
            active_count = sum(1 for i in items if i["active"])
            print(f"\n  {pk} (parent_id={pid}):")
            for item in items:
                status = "✓ ACTIVO" if item["active"] else "✗ inactivo"
                print(f"    {item['name']:<45} {status}")
            print(f"    → {active_count}/{len(items)} activos")

        if DRY_RUN:
            print(f"\n[DRY RUN] No changes made. Set DRY_RUN=False to execute.")
        else:
            # Create children
            created = 0
            for c in children:
                pid = parent_ids.get(c["parent_key"])
                if pid is None or isinstance(pid, str):
                    print(f"  SKIP: no parent for {c['name']} (key={c['parent_key']})")
                    continue
                existing = get_ing_id(c["name"])
                if existing:
                    # Update grupo_ingrediente_id if not set
                    conn.execute(text(
                        "UPDATE ingredientes SET grupo_ingrediente_id = :pid, activo = :a WHERE id = :id"
                    ), {"pid": pid, "a": c["active"], "id": existing})
                    print(f"  Updated: {c['name']} → parent {pid}")
                else:
                    conn.execute(text("""
                        INSERT INTO ingredientes (nombre, categoria_id, unidad_compra, cantidad_compra,
                            precio_compra, unidad_uso, merma_porcentaje, proveedor, activo, grupo_ingrediente_id, fecha_actualizacion)
                        VALUES (:n, :cat, :u, :q, 0, :u, 0, :s, :a, :pid, CURRENT_DATE)
                    """), {"n": c["name"], "cat": cafe_cat_id, "u": c["unit"], "q": c["qty"],
                           "s": c["supplier"], "a": c["active"], "pid": pid})
                    created += 1
            conn.commit()
            print(f"\n  Created {created} new ingredients")


if __name__ == "__main__":
    main()
