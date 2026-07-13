"""
Import order data from invoice JSON files into the database.
Maps invoice line items to app ingredients and creates Pedido + LineaPedido records.
"""
import json
import re
import sys
from datetime import date
from collections import defaultdict

sys.path.insert(0, "/Users/fernaf41/projects/Tests/Escandallos/backend")

from app.database import SessionLocal
from app.models import Ingrediente, HistorialPrecio, LineaPedido, Pedido

db = SessionLocal()

# Build ingredient lookup
app_ings = db.query(Ingrediente).all()
by_name: dict[str, Ingrediente] = {}
for ing in app_ings:
    by_name[ing.nombre.lower().strip()] = ing

# Name mapping: invoice product name → app ingredient name
NAME_MAP = {
    # Pfaff (German → Spanish)
    "erdbeeren": "fresa",
    "heidelbeeren": "blueberries",
    "himbeeren": "frambuesa",
    "brombeeren": "blueberries",
    "bananen": "plátano",
    "fair trade bananen": "plátano",
    "zitronen": "limón",
    "limetten": "lima",
    "limes": "lima",
    "orangen": "naranja entera",
    "äpfel": "naranja entera",
    "aepfel": "naranja entera",
    "trauben": "uvas",
    "avocado": "aguacate",
    "avocados": "aguacate",
    "karotten": "zanahoria",
    "rüebli": "zanahoria",
    "kartoffeln": "patata",
    "champignons": "champiñones",
    "waldchampignons": "champiñones",
    "champignon": "champiñones",
    "peperoni": "pimiento rojo",
    "auberginen": "berenjena",
    "zucchetti": "calabacín",
    "zucchini": "calabacín",
    "gurken": "pepino",
    "zwiebeln": "cebolla",
    "knoblauch": "ajo",
    "rucola": "rúcola",
    "nüsslisalat": "lechuga romana",
    "salat": "lechuga romana",
    "romana": "lechuga romana",
    "kabis rot": "repollo morado",
    "rotkohl": "repollo morado",
    "tomaten": "tomate",
    "cherry": "cherry",
    "kirsch": "cherry",
    "rispentomaten": "tomate",
    "basilikum": "albahaca fresca",
    "petersilie": "albahaca fresca",
    "schnittlauch": "cebollino",
    "kräuter": "albahaca fresca",
    "ingwer": "jengibre fresco",
    "zwiebelsprossen": "brotes de cebolla",
    "keimlinge": "brotes de cebolla",
    "waldbeerenmischung": "fruta congelada",
    "beerenmischung": "fruta congelada",
    "erdbeeren tk": "fresas congeladas",
    "pear": "pera",
    "birnen": "pera",
    "kiwi": "lima",
    # Prodega / Transgourmet
    "vollmilch": "leche entera",
    "milch": "leche entera",
    "oatly": "leche de avena",
    "hafermilch": "leche de avena",
    "laktosefrei": "leche sin lactosa",
    "lactose": "leche sin lactosa",
    "vollrahm": "nata",
    "rahm": "nata",
    "butter": "mantequilla",
    "joghurt": "yogur",
    "yoghurt": "yogur",
    "eier": "huevo",
    "mozzarella": "mozzarella",
    "mascarpone": "mascarpone",
    "philadelphia": "philadelphia",
    "parmesan": "parmesano",
    "parmigiano": "parmesano",
    "gorgonzola": "gorgonzola",
    "emmentaler": "halbhartkäse",
    "halbhartkäse": "halbhartkäse",
    "hartkäse": "halbhartkäse",
    "feta": "feta",
    "burrata": "burrata",
    "taleggio": "taleggio",
    "montasio": "montasio",
    "mehl": "harina",
    "weissmehl": "harina",
    "maizena": "maicena",
    "maisstärke": "maicena",
    "zucker": "azúcar",
    "feinkristallzucker": "azúcar",
    "rohzucker": "azúcar morena",
    "puderzucker": "azúcar en polvo",
    "honig": "miel",
    "ahornsirup": "sirope de arce",
    "ahorn": "sirope de arce",
    "olivenöl": "aceite de oliva",
    "rapsöl": "aceite girasol",
    "essig": "vinagre",
    "balsamico": "balsámico",
    "aceto": "balsámico",
    "senf": "mostaza",
    "mayonnaise": "mayonesa",
    "mayo": "mayonesa",
    "sojasauce": "soja",
    "sriracha": "sriracha",
    "tahini": "tahini",
    "pfeffer": "pimienta",
    "salz": "sal",
    "paprika": "pimiento rojo",
    "zimt": "canela (molida)",
    "zimtstangen": "canela en rama",
    "oregano": "orégano",
    "peanut butter": "peanut butter",
    "erdnuss": "peanut butter",
    "mandeln": "almendra",
    "cashew": "anacardo",
    "haselnuss": "avellana",
    "haselnüsse": "avellana",
    "baumnuss": "nueces",
    "walnuss": "nueces",
    "chips": "chips",
    "haferflocken": "avena",
    "lasagne": "láminas de pasta",
    "milchbrot": "milk bread (milchbrot)",
    "pinsa": "pinsa base",
    "croissant": "croissant",
    "bagel": "bagel",
    "bacon": "bacon",
    "poulet": "pechuga de pollo",
    "mortadella": "mortadela",
    "salami": "salami",
    "salmon": "salmón",
    "lachs": "salmón",
    "thunfisch": "atún escurrido",
    "sardellen": "anchoas",
    "kapern": "alcaparras",
    "oliven": "aceitunas",
    "kalamata": "aceitunas",
    "artischocken": "aceitunas",
    "coca cola zero": "coca cola zero",
    "coca-cola zero": "coca cola zero",
    "coca cola": "coca cola",
    "coca-cola": "coca cola",
    "mirin": "mirin (saitaku hon)",
    "miso": "miso",
    "vanille": "vainilla",
    "kakao": "cacao en polvo",
    "schokolade": "chocolate maracaibo 66%",
    "couverture dunkel": "chocolate maracaibo 66%",
    "couverture weiss": "chocolate blanco",
    "pistacchio": "pistachio paste",
    "pistachio": "pistachio paste",
    "backpulver": "levadura",
    "hefe": "levadura",
    "kokos": "coco láminas tostado",
    "chia": "chía",
    "garbanz": "garbanzos",
    "matcha": "matcha",
    "tee": "tea",
    "chai": "chai",
    "kaffee": "café en grano",
    "evian": "evian 50cl pet",
    "san pellegrino": "san pellegrino 50cl cristal",
    "pellegrino": "san pellegrino 50cl cristal",
    # Covin
    "chorizo": "chorizo",
    "chourizo": "chorizo",
    "jamon": "jamón",
    "jamón": "jamón",
    "carrillera": "carrillera",
    "secreto": "secreto",
    "lomo": "jamón",
    "croqueta": "croquetas",
    "sangria": "sangría la tita",
    "sangría": "sangría la tita",
    "estrella galicia": "estrella galicia barril",
    "1906": "estrella galicia 1906 barril",
    "sunquick": "sunquick concentrado maracuja",
    "pimientos": "pimiento rojo",
    "pão": "pan mm",
    # Rietschi
    "aperol": "aperol",
    "kahlua": "kahlua",
    "cointreau": "cointreau",
    "tequila": "tequila blanco",
    "vodka": "vodka",
    "charitea": "charitea",
    "lemonaid": "lemonaid maracuja",
    "lemonaid maracuja": "lemonaid maracuja",
    "lemonaid limette": "lemonaid limette",
    "lemonaid blutorange": "lemonaid blutorange",
    "lemonaid ingwer": "lemonaid ingwer",
    "vivi soda": "vivi soda mate",
    "vivi zitrone": "vivi zitrone",
    "apfelschorle": "vivi soda apfelschorle",
    "ginger beer": "ginger beer",
    "fever-tree": "ginger beer",
    "schweppes": "tónica",
    "tonic": "tónica",
    "unser bier": "unser bier amber 33cl",
    "weizen": "ueli weizen 50cl",
    "birtel": "birtel red ale 33cl",
    "limoncello": "licor flor de sauco",
    # Spanish translations from Pfaff agent
    "platanos": "plátano",
    "plátanos": "plátano",
    "limones": "limón",
    "naranjas": "naranja entera",
    "manzanas": "naranja entera",
    "arandanos": "blueberries",
    "arándanos": "blueberries",
    "moras": "frambuesa",
    "rucula": "rúcola",
    "rúcula": "rúcola",
    "champinones": "champiñones",
    "champiñones blancos": "champiñones",
    "champiñones silvestres": "champiñones",
    "col lombarda": "repollo morado",
    "mezcla bayas": "fruta congelada",
    "bayas silvestres": "fruta congelada",
    # Prodega unmapped
    "eigelb": "yemas",
    "chili gebrochen": "chilli flakes",
    "kichererbsen": "garbanzos",
    "hinterschinken": "jamón",
    "petit beurre": "galleta",
}


def find_ingredient(product_name):
    if not product_name:
        return None
    name = product_name.lower().strip()

    # Direct match
    if name in by_name:
        return by_name[name]

    # Try NAME_MAP keys as substrings
    for key, target in NAME_MAP.items():
        if key in name:
            if target.lower() in by_name:
                return by_name[target.lower()]

    # Fuzzy: try substring match against app names
    for app_name, ing in by_name.items():
        if len(name) > 4 and (name in app_name or app_name in name):
            return ing

    return None


# --- Load all invoice JSONs ---
all_orders = []  # list of (date, supplier, product_name, qty, unit, unit_price)

# Pfaff (nested: invoices → deliveries → items)
with open("scripts/invoices_pfaff.json") as f:
    pfaff = json.load(f)
for inv in pfaff.get("invoices", []):
    for deliv in inv.get("deliveries", []):
        d = deliv.get("delivery_date", inv.get("invoice_date", ""))
        if d < "2026-04":
            continue
        for item in deliv.get("items", []):
            name = item.get("name_es") or item.get("name_de") or item.get("name", "")
            qty = item.get("quantity", 0)
            if qty <= 0:
                continue
            all_orders.append((d, "Pfaff", name, qty, item.get("unit", "unidad"), item.get("unit_price", 0)))

# Prodega, Covin, Rietschi (flat: list of invoices → items)
for supplier, filename in [("Prodega", "invoices_prodega.json"), ("Covin", "invoices_covin.json"), ("Rietschi", "invoices_rietschi.json")]:
    with open(f"scripts/{filename}") as f:
        invoices = json.load(f)
    for inv in invoices:
        d = inv.get("invoice_date", "")
        if d < "2026-04":
            continue
        for item in inv.get("items", []):
            name = item.get("name", "")
            qty = item.get("quantity", 0)
            if qty <= 0:
                continue
            all_orders.append((d, supplier, name, qty, item.get("unit", "unidad"), item.get("unit_price", 0)))

print(f"Total line items from invoices (Apr+): {len(all_orders)}")

# --- Map to ingredients and group by date+supplier ---
mapped = 0
unmapped_names = set()
pedidos_data = defaultdict(list)  # (date, supplier) → [lines]

for order_date, supplier, product_name, qty, unit, price in all_orders:
    ing = find_ingredient(product_name)
    if ing:
        pedidos_data[(order_date, supplier)].append({
            "ingrediente_id": ing.id,
            "cantidad": qty,
            "unidad": unit,
            "precio_unitario": price if price > 0 else None,
        })
        mapped += 1
    else:
        unmapped_names.add(f"{supplier}: {product_name}")

print(f"Mapped: {mapped} / {len(all_orders)}")
if unmapped_names:
    print(f"Unmapped ({len(unmapped_names)}):")
    for name in sorted(unmapped_names):
        print(f"  {name}")

# --- Insert into database ---
pedidos_created = 0
lineas_created = 0

for (order_date, supplier), lines in sorted(pedidos_data.items()):
    pedido = Pedido(
        fecha=date.fromisoformat(order_date),
        proveedor=supplier,
        estado="recibido",
        fecha_recepcion=date.fromisoformat(order_date),
    )
    db.add(pedido)
    db.flush()
    pedidos_created += 1

    for line in lines:
        lp = LineaPedido(
            pedido_id=pedido.id,
            ingrediente_id=line["ingrediente_id"],
            cantidad_pedida=line["cantidad"],
            unidad=line["unidad"],
            cantidad_recibida=line["cantidad"],
            precio_unitario=line["precio_unitario"],
        )
        db.add(lp)
        lineas_created += 1

db.commit()
db.close()

print(f"\n=== Import Complete ===")
print(f"Pedidos created: {pedidos_created}")
print(f"Lineas created: {lineas_created}")
