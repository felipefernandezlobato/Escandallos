"""
Import historical order and inventory data from the parsed Excel JSON
into the app's database tables (pedidos, lineas_pedido, inventario_registros).
"""

import json
import re
import sys
from datetime import date, datetime
from collections import defaultdict

sys.path.insert(0, "/Users/fernaf41/projects/Tests/Escandallos/backend")

from app.database import SessionLocal
from app.models import Ingrediente, InventarioRegistro, LineaPedido, Pedido

# --- Load parsed Excel data ---
with open("/Users/fernaf41/projects/Tests/Escandallos/backend/scripts/excel_data.json") as f:
    data = json.load(f)

db = SessionLocal()

# --- Build name mapping: Excel short_name/full_name → app ingredient ---
app_ings = db.query(Ingrediente).all()
app_by_name = {}
for ing in app_ings:
    app_by_name[ing.nombre.lower().strip()] = ing

# Manual mappings for names that differ between Excel and app
MANUAL_MAP = {
    # Spanish kitchen names
    "aceto": "balsámico",
    "aceite": "aceite de oliva",
    "mayonesa": "mayonesa",
    "aceite girasol": "aceite girasol",
    "avena": "avena",
    "azucar": "azúcar",
    "azucar en polvo": "azúcar en polvo",
    "azucar morena": "azúcar morena",
    "blueberry": "blueberries",
    "butter": "mantequilla",
    "cacao": "cacao en polvo",
    "cafe": "café en grano",
    "canela": "canela (molida)",
    "cebolla roja": "cebolla morada",
    "cherry tomate": "cherry",
    "chips": "chips",
    "chocolate": "chocolate maracaibo 66%",
    "chocolate blanco": "chocolate blanco",
    "chorizo": "chorizo",
    "coca cola": "coca cola",
    "coco": "coco láminas tostado",
    "comino": "comino",
    "croissant": "croissant",
    "feta": "feta",
    "frambuesa": "frambuesa",
    "fresa": "fresa",
    "fresa congelada": "fresas congeladas",
    "fruta congelada": "fruta congelada",
    "galleta": "galleta",
    "garbanzo": "garbanzos",
    "gorgonzola": "gorgonzola",
    "harina": "harina",
    "huevo": "huevo",
    "jamon": "jamón",
    "jengibre": "jengibre fresco",
    "jengibre seco": "jengibre seco",
    "jengibre molido": "jengibre seco",
    "kahlua": "kahlua",
    "leche": "leche entera",
    "leche avena": "leche de avena",
    "leche sin lactosa": "leche sin lactosa",
    "lechuga": "lechuga romana",
    "levadura": "levadura",
    "lima": "lima",
    "limon": "limón",
    "maicena": "maicena",
    "mascarpone": "mascarpone",
    "matcha": "matcha",
    "miel": "miel",
    "mirin": "mirin (saitaku hon)",
    "miso": "miso",
    "mortadela": "mortadela",
    "mostaza": "mostaza",
    "mozzarella": "mozzarella",
    "nata": "nata",
    "nueces": "nueces",
    "naranja": "naranja entera",
    "oregano": "orégano",
    "pan": "pan mm",
    "parmesano": "parmesano",
    "pasta": "láminas de pasta",
    "patata": "patata",
    "peanut butter": "peanut butter",
    "pepino": "pepino",
    "pera": "pera",
    "philadelphia": "philadelphia",
    "pimienta": "pimienta",
    "pimiento": "pimiento rojo",
    "pistacho": "pistachio paste",
    "platano": "plátano",
    "pollo": "pechuga de pollo",
    "pork belly": "pork belly",
    "repollo": "repollo morado",
    "rucula": "rúcola",
    "sal": "sal",
    "salami": "salami",
    "salmon": "salmón",
    "secreto": "secreto",
    "sirope arce": "sirope de arce",
    "soja": "soja",
    "sriracha": "sriracha",
    "strawberry": "strawberries",
    "tahini": "tahini",
    "tomate": "tomate",
    "tomate seco": "tomate seco",
    "uva": "uvas",
    "vainilla": "vainilla",
    "vinagre": "vinagre",
    "yogur": "yogur",
    "zanahoria": "zanahoria",
    "zumo limon": "limón - zumo",
    "zumo naranja": "naranja - zumo",
    "bacon": "bacon",
    "carne picada": "carne picada mixta",
    "carrillera": "carrillera",
    "cebollino": "cebollino",
    "calabacin": "calabacín",
    "champiñon": "champiñones",
    "cebolla": "cebolla",
    "aguacate": "aguacate",
    "ajo": "ajo",
    "albahaca": "albahaca fresca",
    "alcaparra": "alcaparras",
    "almendra": "almendra",
    "anacardo": "anacardo",
    "anchoa": "anchoas",
    "apio": "apio",
    "atun": "atún escurrido",
    "avellana": "avellana",
    "berenjena": "berenjena",
    "brotes": "brotes de cebolla",
    "burrata": "burrata",
    "chia": "chía",
    "clavo": "clavo",
    "cointreau": "cointreau",
    "montasio": "montasio",
    "taleggio": "taleggio",
    "tequila": "tequila blanco",
    "vodka": "vodka",
    "aperol": "aperol",
    "tomate rodaja": "tomate rodaja",
    "yema de huevo": "yemas",
    "paprika": "pimiento rojo",
    # German product names from Prodega (full_name column)
    "poulet brust": "pechuga de pollo",
    "senf thomy": "mostaza",
    # Fruits (German)
    "erdbeeren 500        g        ifco stuck": "fresa",
    "heidelbeeren": "blueberries",
    "himbeeren": "frambuesa",
    "kiwi": "naranja entera",  # skip kiwi, no match
    "zitronen": "limón",
    "orangen": "naranja entera",
    "banane": "plátano",
    "trauben weiss": "uvas",
    "traubne blau": "uvas",
    "zumo de naranja": "naranja - zumo",
    "pear conference": "pera",
    # Frozen fruit
    "beerenmischung tk 2 x 25 kg": "fruta congelada",
    "erdbeeren ungezuckert tk 2 x 25 kg": "fresas congeladas",
    # Vegetables (German)
    "auberginen 5 kg": "berenjena",
    "avocados essreif 16 st": "aguacate",
    "champignon brown": "champiñones",
    "champignon weiss": "champiñones",
    "gurken": "pepino",
    "karotten": "zanahoria",
    "kartoffeln festkochend 25 kg": "patata",
    "knoblauch original ganz geschalt 1 kg": "ajo",
    "knoblauch 70 - 90 mm 5 kg": "ajo",
    "peperoni rot": "pimiento rojo",
    "peperoni tri color": "pimiento rojo",
    "rucola": "rúcola",
    "zucchetti grun": "calabacín",
    "zwiebeln mittel gepackt 1 kg": "cebolla",
    "zwiebeln rot": "cebolla morada",
    # Herbs (German)
    "b peterli gekraust *": "albahaca fresca",  # parsley, map to herbs
    "b schnittlauch lose bund bundb": "cebollino",
    "b zwiebelkeimlinge 100 g zwiebelsprossen": "brotes de cebolla",
    "basilikum 1 kg": "albahaca fresca",
    # Spices
    "ingwer gemahlen 310 g": "jengibre seco",
    "paprika mild 380 g": "pimiento rojo",
    "pfeffer weiss ganz 470 g": "pimienta",
    "zimt gemahlen": "canela (molida)",
    "zimtstangen 15 cm 400 g": "canela en rama",
    "ingwer bresc ingwerpuree 450 g": "jengibre fresco",
    "sternanis quality": "anís",
    # Dairy
    "joghurt  joghurt       nature  3        kg        ccm        9000301        box": "yogur",
    "emmi vollmilch ip-suisse 35% pasteurisiert 8 x 1 l": "leche entera",
    "milch lactose frei": "leche sin lactosa",
    "milch oatly": "leche de avena",
    "vollrahm 35% uht": "nata",
    "butter 10 x 1 kg": "mantequilla",
    # Cheese
    "emmentaler typ scheiben 8 x 5 cm 2 kg": "halbhartkäse",
    "halbhartkase gastro scheiben 1 kg": "halbhartkäse",
    "hartkase swiss scheiben 1 kg": "halbhartkäse",
    "kase sandwich         scheiben": "halbhartkäse",
    "parmigiano": "parmesano",
    "soignon buche de chevre weichkase 1 kg queso de cabra": "feta",
    # Nuts
    "baumnusskerne gebrochen hell 1 kg": "nueces",
    "cashews bruch 1 kg": "anacardo",
    "economy haselnusskerne ganz 25 kg": "avellana",
    "haselnusse ganz geschalt  1kg": "avellana",
    "mandel economy mandeln ganz 25 kg": "almendra",
    # Olives
    "iliada kalamata oliven entsteint 31 kg": "aceitunas",
    "iliada oliven grun entsteint 31 kg": "aceitunas",
    "oliven iliada grune entkernt mariniert 145 kg": "aceitunas",
    # Economy / pantry
    "economy kapern capotes 4350 kg": "alcaparras",
    "haferflocken grob 5 kg": "avena",
    "maizena quality maisstarke 25 kg": "maicena",
    "weissmehl 10 x 1 kg": "harina",
    "backpulver": "levadura",
    # Chocolate & sweets
    "choco blanco quality couverture tropfen weiss 28% 25 kg": "chocolate blanco",
    "kakao pulver callier": "cacao en polvo",
    "maracaibo clasificado 65% couverture dunkel rondo 3 x 2 kg": "chocolate maracaibo 66%",
    "ahorn sirup natura bio ahornsirup 1 l 2 fl": "sirope de arce",
    "nectaflor blutenhonig 28 kg": "miel",
    "pistachio 7chef crema pistacchio 9 % tiefgekuhlt 8 x 500 g": "pistachio paste",
    "agrano flussigearoma  450 g": "vainilla",
    "fairtrade rohzucker aus zuckerrohr 10 x 1 kg": "azúcar morena",
    "feinkristallzucker 10 x 1 kg": "azúcar",
    "puderzucker 6 x 500g": "azúcar en polvo",
    # Covin
    "pao de mafra 10x500g": "pan mm",
    "pimentos padron 8x300g": "pimiento rojo",
    "chourizo iberico 100%": "chorizo",
    "jamon iberico selecion s/hueso": "jamón",
    # Pasta & bread
    "barilla lasagne 5 kg": "láminas de pasta",
    "bistro boulangerie milchbrot tiefgekuhlt 3 x 850 g": "milk bread (milchbrot)",
    "di marco pinsa romana classic 19 x 30 cm": "pinsa base",
    # Saitaku
    "saitaku hon mirin 500 ml": "mirin (saitaku hon)",
    # Meat
    "mortadella cilindrica pistazien 1kg": "mortadela",
    "mortadella rustica 1/2 ca 1 kg": "mortadela",
    "paleta iberico bellota spanien ca 12 kg": "jamón",
    # Apples, limes, artichokes
    "aepfel gala ki i 125 kg ch ifco": "naranja entera",  # no apple in app
    "limetten / limes 42 kg": "lima",
    "artischocken halften 31kg natura e bonta": "aceitunas",  # no artichoke, skip
    # VEG Pinsamehl
    "veg-pinsamehl romana 25 kg": "harina",
}

# Also map by row number for known problem rows
ROW_MAP = {
    80: None,  # Rotkohl — no match
    81: None,  # Salat Romana — lechuga
    91: None,  # Spargel — no match
    92: None,  # Tomaten strauch — tomate
    98: None,  # Erdnusskerne — peanut butter
    100: None, # Haferflocken Economy — avena
    102: None, # Kokos-chips — coco
    105: None, # Mascarpone
    110: None, # Mozzarella
    111: None, # Mozzarella Büffel
    112: None, # Burrata
    114: None, # Gorgonzola
    118: None, # Philadelphia
    120: None, # Taleggio
    122: None, # Montasio
    123: None, # Feta
    124: None, # Comté
    126: None, # Sardellen
    135: None, # Bagel
    137: None, # Croissant
    139: None, # Romer's
}


def normalize(name):
    if not name:
        return ""
    n = name.lower().strip()
    n = n.replace("ö", "o").replace("ä", "a").replace("ü", "u")
    n = re.sub(r"[,\.\(\)]", "", n)
    return n


SUBSTRING_MAP = {
    "milch emmi": "leche entera",
    "milch ip-suisse": "leche entera",
    "honig": "miel",
    "nectaflor": "miel",
    "vanille agrano": "vainilla",
    "flussigearoma": "vainilla",
    "rohzucker": "azúcar morena",
    "feinkristallzucker": "azúcar",
    "puderzucker": "azúcar en polvo",
    "buche de chevre": "feta",
    "pao de mafra": "pan mm",
    "pfefferminze": "albahaca fresca",
    "artischocken": "aceitunas",
}


def find_app_ingredient(short_name, full_name):
    for name in [short_name, full_name]:
        if not name:
            continue
        norm = normalize(name)
        if norm in MANUAL_MAP:
            target = MANUAL_MAP[norm]
            if target.lower() in app_by_name:
                return app_by_name[target.lower()]
        if norm in app_by_name:
            return app_by_name[norm]

    # Substring map for German long names
    for name in [short_name, full_name]:
        if not name:
            continue
        norm = normalize(name)
        for substr, target in SUBSTRING_MAP.items():
            if substr in norm:
                if target.lower() in app_by_name:
                    return app_by_name[target.lower()]

    # Fuzzy: try partial match
    for name in [short_name, full_name]:
        if not name:
            continue
        norm = normalize(name)
        for app_name, ing in app_by_name.items():
            if len(norm) > 3 and (norm in app_name or app_name in norm):
                return ing
    return None


def parse_quantity(value_str):
    """Parse order quantity like '10L', '2kg', '12unit', '1.5' into (amount, unit).

    Returns (amount, unit) where unit is None when no unit suffix was found
    (bare number). The caller should then fall back to the ingredient's unidad_compra.
    Explicit unit aliases (st, stk, pcs) return "unidad" because those are
    counted packages/pieces — the caller may override with unidad_compra as well.
    """
    if value_str is None:
        return None, None
    s = str(value_str).strip().lower()
    if not s or s == "0" or s == "0.0":
        return None, None

    # Try to extract number followed by an explicit unit suffix
    m = re.match(r"^([\d.,]+)\s*(l|litro|litros|kg|g|ml|cl|unit|unidad|unidades|st|stk|pcs)\.?$", s, re.I)
    if m:
        num = float(m.group(1).replace(",", "."))
        raw_unit = m.group(2).lower()
        unit_map = {
            "l": "litro", "litro": "litro", "litros": "litro",
            "kg": "kg", "g": "g", "ml": "ml", "cl": "cl",
            "unit": "unidad", "unidad": "unidad", "unidades": "unidad",
            "st": "unidad", "stk": "unidad", "pcs": "unidad",
        }
        return num, unit_map.get(raw_unit, None)

    # Bare number — no unit suffix; caller will use ingredient's unidad_compra
    try:
        num = float(s.replace(",", "."))
        return num, None
    except ValueError:
        return None, None


def parse_stock_comment(comment, purchase_unit=None):
    """Parse stock comment like '4L', '500ml', '347g', '3 litros' into (amount, unit).

    When purchase_unit is provided, sub-unit quantities are converted to the
    purchase unit so stored values are consistent:
      - ml/cl → litro  (if purchase_unit == "litro")
      - g/mg  → kg     (if purchase_unit == "kg")
    If no unit found in the comment, returns (amount, None) so the caller can
    fall back to purchase_unit.
    """
    if not comment:
        return None, None
    s = comment.strip().lower()
    # Common patterns
    m = re.match(r"([\d.,]+)\s*(l|litro|litros|kg|g|mg|ml|cl|unit|unidad)?\.?", s)
    if m:
        num = float(m.group(1).replace(",", "."))
        raw = (m.group(2) or "").lower()
        unit_map = {
            "l": "litro", "litro": "litro", "litros": "litro",
            "kg": "kg", "g": "g", "mg": "mg", "ml": "ml", "cl": "cl",
            "unit": "unidad", "unidad": "unidad",
        }
        unit = unit_map.get(raw, None)

        # Convert sub-units to purchase unit when the purchase unit is known
        if purchase_unit == "litro":
            if unit == "ml":
                num = num / 1000.0
                unit = "litro"
            elif unit == "cl":
                num = num / 100.0
                unit = "litro"
            elif unit == "l":
                unit = "litro"
        elif purchase_unit == "kg":
            if unit == "g":
                num = num / 1000.0
                unit = "kg"
            elif unit == "mg":
                num = num / 1_000_000.0
                unit = "kg"

        return num, unit
    return None, None


def unit_from_column_d(units_str):
    """Determine what unit the bare numbers in the Excel represent, based on column D.

    Column D describes the package format. The values in the cells are raw quantities.
    No multiplication — just figure out the unit:
    - "90 St", "16 St" → values are counts → "unidad"
    - "500g", "250g", "200g" → values are package counts → "unidad"
    - "1 kg", "10 x 1 kg", "2.5 kg" → values are in kg → "kg"
    - "10 L", "1 L" → values are in litros → "litro"
    - "stuck", "bund" → "unidad"
    """
    if not units_str:
        return None
    s = str(units_str).strip().lower()

    # Units (counted items)
    if any(u in s for u in ("st", "stuck", "stk", "unit", "bund")):
        return "unidad"

    # Sub-kg packages (500g, 250g, 200g, 310g, etc.) → values are package counts
    m = re.match(r"^([\d.,]+)\s*g$", s)
    if m:
        return "unidad"

    # Multi-packs where individual items are in grams (12 x 400 g, 10x350g)
    m = re.match(r"^\d+\s*x\s*[\d.,]+\s*g$", s)
    if m:
        return "unidad"

    # kg items (1 kg, 2.5 kg, 4.2 kg, 10 x 1 kg) → values are in kg
    if "kg" in s:
        return "kg"

    # Liter items
    if any(u in s for u in (" l", "lt", "litro")):
        return "litro"
    if s.endswith("l") and s[:-1].replace(".", "").replace(",", "").strip().isdigit():
        return "litro"

    return None


# --- Build unit lookup from Excel column D ---
excel_units = {}
for excel_ing in data["ingredients"]:
    u = unit_from_column_d(excel_ing.get("units"))
    if u is not None:
        excel_units[excel_ing["row"]] = u


# --- Map Excel ingredients to app ingredients ---
mapped = {}
unmapped = []
for excel_ing in data["ingredients"]:
    app_ing = find_app_ingredient(excel_ing["short_name"], excel_ing["full_name"])
    if app_ing:
        mapped[excel_ing["row"]] = app_ing
    else:
        unmapped.append(excel_ing)

print(f"Mapped: {len(mapped)} / {len(data['ingredients'])} ingredients")
if unmapped:
    print(f"Unmapped ({len(unmapped)}):")
    for u in unmapped:
        print(f"  Row {u['row']}: {u['short_name']} | {u['full_name']} | {u['category']}")

# --- Group orders by date and proveedor ---
orders_by_date = defaultdict(list)
stock_entries = []

for order in data["orders"]:
    row = order["row"]
    if row not in mapped:
        continue
    app_ing = mapped[row]
    order_date = order["date"]
    qty, unit = parse_quantity(order["value"])
    if qty is None or qty <= 0:
        continue
    # Simple: values are what they are. No multiplication.
    # Just determine the unit:
    # 1. If value has explicit unit ("10L", "5kg") → use that
    # 2. If bare number → look up unit from column D
    # 3. Fallback to ingredient's unidad_compra
    if unit is None or unit == "unidad":
        if row in excel_units:
            unit = excel_units[row]
        else:
            unit = app_ing.unidad_compra

    orders_by_date[order_date].append({
        "ingrediente_id": app_ing.id,
        "cantidad": qty,
        "unidad": unit,
        "proveedor": app_ing.proveedor or "Desconocido",
    })

    # Stock from comment — same unit logic as orders
    if order.get("comment"):
        stock_qty, stock_unit = parse_stock_comment(
            order["comment"], purchase_unit=app_ing.unidad_compra
        )
        if stock_qty is not None:
            if stock_unit is None:
                stock_unit = excel_units.get(row, app_ing.unidad_compra)
            stock_entries.append({
                "ingrediente_id": app_ing.id,
                "cantidad": stock_qty,
                "unidad": stock_unit,
                "fecha": order_date,
            })

print(f"\nOrders by date: {len(orders_by_date)} dates")
print(f"Stock entries from comments: {len(stock_entries)}")

# --- Insert into database ---
pedidos_created = 0
lineas_created = 0
inventario_created = 0

# Create pedidos grouped by date + proveedor
for order_date_str, items in sorted(orders_by_date.items()):
    order_date = date.fromisoformat(order_date_str)
    by_prov = defaultdict(list)
    for item in items:
        by_prov[item["proveedor"]].append(item)

    for proveedor, prov_items in by_prov.items():
        pedido = Pedido(
            fecha=order_date,
            proveedor=proveedor,
            estado="recibido",
            fecha_recepcion=order_date,
        )
        db.add(pedido)
        db.flush()
        pedidos_created += 1

        for item in prov_items:
            linea = LineaPedido(
                pedido_id=pedido.id,
                ingrediente_id=item["ingrediente_id"],
                cantidad_pedida=item["cantidad"],
                unidad=item["unidad"],
                cantidad_recibida=item["cantidad"],
            )
            db.add(linea)
            lineas_created += 1

# Create inventario registros from stock comments
seen_stocks = set()
for entry in stock_entries:
    key = (entry["ingrediente_id"], entry["fecha"])
    if key in seen_stocks:
        continue
    seen_stocks.add(key)
    registro = InventarioRegistro(
        ingrediente_id=entry["ingrediente_id"],
        cantidad=entry["cantidad"],
        unidad=entry["unidad"],
        fecha_registro=date.fromisoformat(entry["fecha"]),
    )
    db.add(registro)
    inventario_created += 1

db.commit()
db.close()

print(f"\n=== Import Complete ===")
print(f"Pedidos created: {pedidos_created}")
print(f"Lineas created: {lineas_created}")
print(f"Inventario registros created: {inventario_created}")
