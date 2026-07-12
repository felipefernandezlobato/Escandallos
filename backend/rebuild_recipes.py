"""Rebuild all recipes with correct ingredient IDs."""
import json, requests

API = "http://localhost:8000"
def post(path, data):
    r = requests.post(f"{API}{path}", json=data)
    if r.status_code not in (200, 201):
        print(f"  ERROR {path}: {r.text[:100]}")
        return None
    return r.json()

# Load ingredient IDs
ings = {i["nombre"]: i["id"] for i in requests.get(f"{API}/api/ingredientes").json()}
I = ings  # shorthand

# Helper
def sub(name, cat, porc, unit, lineas):
    r = post("/api/recetas", {"nombre":name,"categoria_id":cat,"porciones_por_lote":porc,
        "es_subreceta":True,"unidad_rendimiento":unit,"lineas":lineas})
    if r: print(f"  SUB {r['id']:3d}: {name} = {r['coste_total']:.2f} CHF, /{unit}={r['coste_por_porcion']:.2f}")
    return r["id"] if r else None

def dish(name, cat, porc, lineas, unit=None):
    d = {"nombre":name,"categoria_id":cat,"porciones_por_lote":porc,"es_subreceta":False,"lineas":lineas}
    if unit: d["unidad_rendimiento"] = unit
    r = post("/api/recetas", d)
    if r: print(f"  DISH {r['id']:3d}: {name} = {r['coste_por_porcion']:.2f} CHF")
    return r["id"] if r else None

def L(ing_name=None, sub_id=None, cant=0, uni="kg"):
    """Line helper"""
    if sub_id: return {"subreceta_id": sub_id, "cantidad": cant, "unidad": uni}
    return {"ingrediente_id": I[ing_name], "cantidad": cant, "unidad": uni}

print("=== SUB-RECIPES ===")

# 1. Compota (4kg)
S_compota = sub("Compota", 15, 4, "kg", [
    L("Fruta congelada",cant=5), L("Azúcar",cant=0.3), L("Canela en rama",cant=0.014), L("Anís",cant=0.002)])

# 2. Granola (1.954kg)
S_granola = sub("Granola preparación", 14, 1.954, "kg", [
    L("Avena",cant=1), L("Nueces",cant=0.25), L("Anacardo",cant=0.25),
    L("Avellana",cant=0.25), L("Almendra",cant=0.25), L("Miel",cant=0.2),
    L("Sirope de arce",cant=0.2)])

# 3. Chía (1.78kg)
S_chia = sub("Chía preparación", 14, 1.78, "kg", [
    L("Chía",cant=0.28), L("Leche de avena",cant=1.4,uni="litro"),
    L("Vainilla 1",cant=0.02), L("Sirope de arce",cant=0.08)])

# 4. Yogur mix (2.122kg)
S_yogur = sub("Yogur mix", 14, 2.122, "kg", [
    L("Yogur",cant=2), L("Sirope de arce",cant=0.15),
    L("Vainilla 1",cant=0.02), L("Canela (molida)",cant=0.001)])

# 5. Avena Mix (1.119kg)
S_avena = sub("Avena Mix", 14, 1.119, "kg", [
    L("Avena",cant=0.25), L("Canela en rama",cant=0.01),
    L("Vainilla 1",cant=0.01), L("Leche de avena",cant=1,uni="litro"),
    L("Sirope de arce",cant=0.075), L("Clavo",cant=0.001)])

# 6. Pera pochada (8 units)
S_pera = sub("Pera pochada", 15, 8, "unidad", [
    L("Pera",cant=1.36), L("Agua",cant=1.5,uni="litro"), L("Anís",cant=0.002),
    L("Canela en rama",cant=0.007), L("Clavo",cant=0.003),
    L("Azúcar morena",cant=0.25), L("Vainilla 1",cant=0.016)])

# 7. Cebolla morada encurtida (0.781kg)
S_cebolla_enc = sub("Cebolla morada encurtida", 14, 0.781, "kg", [
    L("Cebolla morada",cant=0.6), L("Vinagre",cant=0.15,uni="litro"),
    L("Azúcar",cant=0.15), L("Agua",cant=1,uni="litro")])

# 8. Salsa holandesa (0.205kg)
S_holandesa = sub("Salsa holandesa", 14, 0.205, "kg", [
    L("Yemas",cant=0.15), L("Mantequilla 1",cant=0.03),
    L("Sal",cant=0.01), L("Zumo de lima",cant=0.015,uni="litro")])

# 9. Salsa César (0.421kg)
S_cesar = sub("Salsa César", 14, 0.421, "kg", [
    L("Mayonesa",cant=0.3), L("Ajo",cant=0.05), L("Anchoas",cant=0.02),
    L("Mostaza",cant=0.02), L("Zumo de limón",cant=0.03),
    L("Parmesano",cant=0.04), L("Sal",cant=0.002), L("Pimienta",cant=0.002)])

# 10. Pancakes Mix (11 units)
S_pancakes = sub("Pancakes Mix", 14, 11, "unidad", [
    L("Harina 1",cant=0.3), L("Huevo",cant=2,uni="unidad"),
    L("Levadura",cant=0.016), L("Azúcar",cant=0.05), L("Sal",cant=0.002),
    L("Leche entera",cant=0.4,uni="litro"), L("Aceite de oliva",cant=0.02)])

# 11. Carrillera mix (0.950kg)
S_carrillera = sub("Carrillera mix", 14, 0.950, "kg", [
    L("Carrillera",cant=1), L("Soja",cant=0.25,uni="litro"),
    L("Ajo 2",cant=0.1), L("Jengibre fresco",cant=0.1),
    L("Mirin",cant=0.25,uni="litro")])

# 12. Mezcla yuzu (0.785kg)
S_yuzu = sub("Mezcla yuzu", 14, 0.785, "kg", [
    L("Mirin 0% alcohol",cant=0.0125,uni="litro"), L("Miso",cant=0.01125),
    L("Aceite vegetal",cant=0.075,uni="litro"), L("Zumo de lima",cant=0.025,uni="litro"),
    L("Sal",cant=0.015), L("Azúcar",cant=0.02)])

# 13. Ali-oli (0.280kg)
S_alioli = sub("Ali-oli", 14, 0.280, "kg", [
    L("Huevo",cant=1,uni="unidad"), L("Ajo",cant=0.004),
    L("Aceite girasol",cant=0.2,uni="litro"), L("Zumo de lima",cant=0.013,uni="litro"),
    L("Sal",cant=0.02)])

# 14. Cream Cheese (3.310kg)
S_cream = sub("Cream Cheese", 14, 3.310, "kg", [
    L("Philadelphia",cant=3.3), L("Zumo de lima",cant=0.1,uni="litro"),
    L("Cebollino",cant=0.05), L("Sal",cant=0.004), L("Pimienta",cant=0.003)])

# 15. Chilly-mayo (0.735kg)
S_chilly = sub("Chilly-mayo", 14, 0.735, "kg", [
    L("Yemas",cant=0.2), L("Vinagre",cant=0.025,uni="litro"),
    L("Sriracha",cant=0.2), L("Sal",cant=0.015),
    L("Aceite vegetal",cant=0.3,uni="litro")])

# 16. Bechamel (1 lasagna)
S_bechamel = sub("Bechamel", 14, 1, "lasagna", [
    L("Leche entera",cant=0.5,uni="litro"), L("Cebolla",cant=0.04),
    L("Laurel",cant=0.001), L("Pimienta",cant=0.001), L("Ajo",cant=0.001),
    L("Mantequilla 1",cant=0.03), L("Harina 1",cant=0.03),
    L("Sal",cant=0.001), L("Nuez moscada",cant=0.001)])

# 17. Picatostes (0.171kg)
S_picatostes = sub("Picatostes", 14, 0.171, "kg", [
    L("Pan Viejo",cant=0.181), L("Aceite de oliva",cant=0.008),
    L("Mantequilla 1",cant=0.007), L("Parmesano",cant=0.01)])

# 18. Pesto regular (0.642kg)
S_pesto = sub("Pesto regular", 14, 0.642, "kg", [
    L("Albahaca fresca",cant=0.23), L("Aceite de oliva",cant=0.2),
    L("Parmesano",cant=0.1), L("Nueces",cant=0.1),
    L("Ajo picado",cant=0.01), L("Pimienta",cant=0.002)])

# 19. Rúcola tostada (1 ración)
S_rucola = sub("Rúcola tostada", 14, 1, "ración", [
    L("Rúcola",cant=0.015), L("Aceite de oliva",cant=0.004),
    L("Sal",cant=0.001), L("Vinagre",cant=0.002,uni="litro")])

# 20. Cherry confitado (0.971kg)
S_cherry_conf = sub("Cherry confitado", 14, 0.971, "kg", [
    L("Cherry",cant=1.123), L("Aceite de oliva",cant=0.05),
    L("Sal",cant=0.005), L("Pimienta",cant=0.002), L("Albahaca seca",cant=0.005)])

# 21. Pepino encurtido (0.286kg)
S_pepino = sub("Pepino encurtido", 14, 0.286, "kg", [
    L("Pepino",cant=2,uni="unidad"), L("Aceite de oliva",cant=0.005),
    L("Vinagre",cant=0.07,uni="litro")])

# 22. Champiñones sandwich (8.947kg)
S_champis = sub("Champiñones para sandwich", 14, 8.947, "kg", [
    L("Champiñones",cant=8), L("Cebolla (champis)",cant=4),
    L("Aceite vegetal",cant=0.35,uni="litro"), L("Ajo",cant=0.6),
    L("Soja",cant=0.3,uni="litro"), L("Jengibre seco",cant=0.005)])

# 23. Avocado Mix (0.156kg)
S_avocado = sub("Avocado Mix", 14, 0.156, "kg", [
    L("Aguacate",cant=1,uni="unidad"), L("Zumo de lima",cant=0.02,uni="litro"),
    L("Sal",cant=0.001)])

# 24. Zumo de lima (1 litro)
S_zumo_lima = sub("Zumo de lima", 13, 1, "litro", [
    L("Lima",cant=3)])

# 25. Guacamole Mix (0.200kg)
S_guacamole = sub("Guacamole Mix", 14, 0.200, "kg", [
    L("Aguacate",cant=1,uni="unidad"), L("Zumo de lima",cant=0.02,uni="litro"),
    L("Sal",cant=0.001), L("Cebolla",cant=0.02), L("Tomate",cant=0.024)])

# 26. Hummus (1.34kg)
S_hummus = sub("Hummus", 14, 1.34, "kg", [
    L("Garbanzos",cant=0.8,uni="unidad"), L("Tahini",cant=0.1),
    L("Zumo de lima",cant=0.25,uni="litro"), L("Aceite de oliva",cant=0.08),
    L("Ajo",cant=0.005), L("Comino",cant=0.005), L("Agua",cant=0.1,uni="litro")])

# 27. Reducción vainilla (1.700kg)
S_red_vainilla = sub("Reducción vainilla", 13, 1.700, "kg", [
    L("Agua",cant=1,uni="litro"), L("Extracto vainilla 1",cant=0.3), L("Azúcar",cant=1)])

# 28. Puré de fresas (1.1kg)
S_pure_fresas = sub("Puré de fresas", 13, 1.1, "kg", [
    L("Fresas congeladas",cant=1), L("Azúcar",cant=0.1)])

# 29. Cold foam (0.546kg)
S_cold_foam = sub("Cold foam", 13, 0.546, "kg", [
    L("Nata",cant=0.3,uni="litro"), L("Leche entera",cant=0.2,uni="litro"),
    L("Azúcar morena",cant=0.07), L("Extracto vainilla 2",cant=0.002,uni="litro"),
    L("Sirope de arce",cant=0.004), L("Naranja entera",cant=0.01)])

# 30. Icing (1.5kg)
S_icing = sub("Icing", 15, 1.5, "kg", [
    L("Mantequilla 1",cant=0.525), L("Azúcar en polvo",cant=0.30),
    L("Philadelphia",cant=0.72), L("Leche entera",cant=0.03,uni="litro"),
    L("Vainilla 1",cant=0.02), L("Cáscara limón rallada",cant=0.20)])

# 31. Choco Paste (1.24kg)
S_choco = sub("Choco Paste", 15, 1.24, "kg", [
    L("Leche sin lactosa",cant=0.5,uni="litro"), L("Nata",cant=0.25,uni="litro"),
    L("Chocolate",cant=0.3), L("Azúcar",cant=0.08), L("Maicena 1",cant=0.04),
    L("Yemas",cant=0.08), L("Mantequilla 2",cant=0.03), L("Sal",cant=0.001)])

# 32. Praline (0.488kg)
S_praline = sub("Praline", 15, 0.488, "kg", [
    L("Avellanas (14.00)",cant=0.3), L("Azúcar",cant=0.2), L("Agua",cant=0.05,uni="litro")])

# 33. Praline Paste (1.03kg) — uses Praline sub
S_praline_paste = sub("Praline Paste", 15, 1.03, "kg", [
    L("Leche entera",cant=0.5,uni="litro"), L("Azúcar",cant=0.1),
    L("Yemas",cant=0.08), L("Maicena 1",cant=0.04),
    L("Mantequilla 2",cant=0.2), {"subreceta_id":S_praline,"cantidad":0.2,"unidad":"kg"}])

# 34. Crema con mascarpone (0.550kg)
S_crema_masc = sub("Crema con mascarpone", 15, 0.550, "kg", [
    L("Nata",cant=0.2,uni="litro"), L("Azúcar",cant=0.08),
    L("Mascarpone",cant=0.25), L("Vainilla 2",cant=0.005)])

# 35. Mezcla french toast (0.422kg)
S_mezcla_ft = sub("Mezcla french toast", 15, 0.422, "kg", [
    L("Huevo",cant=2,uni="unidad"), L("Leche entera",cant=0.2,uni="litro"),
    L("Nata",cant=0.06,uni="litro"), L("Canela (molida)",cant=0.004),
    L("Nuez moscada",cant=0.003), L("Vainilla 1",cant=0.005),
    L("Sal",cant=0.005), L("Azúcar",cant=0.02)])

print(f"\n=== DISHES ===")

# Common garnish lines
def garnish():
    return [L("Chilli",cant=0.004), L("Mohn",cant=0.006),
            L("Lima",cant=0.01), L("Rúcola",cant=0.004)]

# Bowls
dish("Yogurt Bowl", 14, 1, [
    {"subreceta_id":S_yogur,"cantidad":0.150,"unidad":"kg"},
    {"subreceta_id":S_granola,"cantidad":0.040,"unidad":"kg"},
    L("Blueberries",cant=0.004), L("Strawberries",cant=0.004),
    L("Frambuesa",cant=0.004), L("Uvas",cant=0.008),
    {"subreceta_id":S_compota,"cantidad":0.015,"unidad":"kg"}])

dish("Chia Bowl", 14, 1, [
    {"subreceta_id":S_chia,"cantidad":0.150,"unidad":"kg"},
    {"subreceta_id":S_granola,"cantidad":0.040,"unidad":"kg"},
    L("Plátano",cant=0.025), L("Peanut butter",cant=0.005),
    L("Blueberries",cant=0.004), L("Strawberries",cant=0.004),
    L("Uvas",cant=0.008),
    {"subreceta_id":S_compota,"cantidad":0.015,"unidad":"kg"}])

dish("Oat Bowl", 14, 1, [
    {"subreceta_id":S_avena,"cantidad":0.150,"unidad":"kg"},
    {"subreceta_id":S_granola,"cantidad":0.040,"unidad":"kg"},
    {"subreceta_id":S_pera,"cantidad":0.250,"unidad":"unidad"},
    L("Sirope de arce",cant=0.013), L("Coco láminas tostado",cant=0.004),
    L("Uvas",cant=0.008), L("Strawberries",cant=0.004), L("Blueberries",cant=0.004)])

# Toasts
dish("Avo Toast", 14, 1, [
    L("Pan MM",cant=0.068), L("Aceite de oliva",cant=0.003),
    {"subreceta_id":S_avocado,"cantidad":0.060,"unidad":"kg"},
    {"subreceta_id":S_cream,"cantidad":0.050,"unidad":"kg"},
    {"subreceta_id":S_rucola,"cantidad":1,"unidad":"unidad"},
    *garnish()])

dish("Brü Toast", 14, 1, [
    L("Pan MM",cant=0.068), L("Aceite de oliva",cant=0.005),
    {"subreceta_id":S_avocado,"cantidad":0.060,"unidad":"kg"},
    L("Huevo",cant=2,uni="unidad"), *garnish()])

dish("Cherry Toast", 14, 1, [
    L("Pan MM",cant=0.068), L("Burrata 125g",cant=1,uni="unidad"),
    {"subreceta_id":S_cherry_conf,"cantidad":0.040,"unidad":"kg"},
    {"subreceta_id":S_rucola,"cantidad":1,"unidad":"unidad"},
    L("Balsámico",cant=0.004,uni="litro"), *garnish()])

dish("Salmon Toast", 14, 1, [
    L("Pan MM",cant=0.068),
    {"subreceta_id":S_avocado,"cantidad":0.060,"unidad":"kg"},
    {"subreceta_id":S_cream,"cantidad":0.040,"unidad":"kg"},
    L("Salmón",cant=0.060),
    {"subreceta_id":S_pepino,"cantidad":0.010,"unidad":"kg"},
    {"subreceta_id":S_cebolla_enc,"cantidad":0.015,"unidad":"kg"},
    L("Brotes de cebolla",cant=0.0005), L("Alcaparras",cant=0.002),
    *garnish()])

dish("Benedict Toast", 14, 1, [
    L("Milk Bread",cant=1,uni="unidad"),
    {"subreceta_id":S_avocado,"cantidad":0.060,"unidad":"kg"},
    L("Bacon",cant=0.06), L("Huevo",cant=1,uni="unidad"),
    {"subreceta_id":S_holandesa,"cantidad":0.08,"unidad":"kg"},
    *garnish()])

dish("Royal Toast", 14, 1, [
    L("Milk Bread",cant=1,uni="unidad"),
    {"subreceta_id":S_avocado,"cantidad":0.060,"unidad":"kg"},
    L("Salmón",cant=0.060), L("Huevo",cant=1,uni="unidad"),
    {"subreceta_id":S_holandesa,"cantidad":0.080,"unidad":"kg"},
    *garnish()])

# Croissants
dish("Croissant Mixto", 14, 1, [
    L("Croissant",cant=1,uni="unidad"), L("Jamón",cant=0.025), L("Queso",cant=0.045),
    L("Huevo",cant=1,uni="unidad"),
    {"subreceta_id":S_holandesa,"cantidad":0.04,"unidad":"kg"},
    *garnish()])

dish("Croissant Pistaccio", 15, 1, [
    L("Croissant",cant=1,uni="unidad"), L("Pistachio Paste",cant=0.05),
    L("Frambuesa",cant=0.005)])

dish("Croissant Choco", 15, 1, [
    L("Croissant",cant=1,uni="unidad"),
    {"subreceta_id":S_choco,"cantidad":0.05,"unidad":"kg"},
    L("Frambuesa",cant=0.005)])

dish("Croissant Praline", 15, 1, [
    L("Croissant",cant=1,uni="unidad"),
    {"subreceta_id":S_praline_paste,"cantidad":0.05,"unidad":"kg"},
    L("Frambuesa",cant=0.005)])

# Pancakes
dish("Pancakes Savory", 14, 1, [
    {"subreceta_id":S_pancakes,"cantidad":3,"unidad":"unidad"},
    L("Bacon",cant=0.05), L("Huevo",cant=1,uni="unidad"),
    L("Maple Sirup",cant=0.03,uni="litro"), L("Aguacate",cant=0.5,uni="unidad"),
    {"subreceta_id":S_holandesa,"cantidad":0.05,"unidad":"kg"},
    *garnish()])

dish("Pancakes Sweet", 15, 1, [
    {"subreceta_id":S_pancakes,"cantidad":3,"unidad":"unidad"},
    L("Blueberries",cant=0.004), L("Strawberries",cant=0.004),
    L("Frambuesa",cant=0.004), L("Plátano",cant=0.04),
    {"subreceta_id":S_compota,"cantidad":0.015,"unidad":"kg"},
    L("Maple Sirup",cant=0.03,uni="litro"), L("Peanut butter",cant=0.03),
    L("Pistachio Paste",cant=0.035)])

# Sandwiches
dish("Mixto Sandwich", 14, 1, [
    L("Pan MM",cant=0.070), L("Jamón",cant=0.050),
    L("Taleggio",cant=0.045), L("Halbhartkäse",cant=0.060),
    L("Polvo de trufa",cant=0.0005), L("Brotes de soja",cant=0.002),
    L("Chilli",cant=0.004), L("Mohn",cant=0.006),
    {"subreceta_id":S_rucola,"cantidad":1,"unidad":"unidad"},
    L("Rúcola",cant=0.004)])

dish("Setas Sandwich", 14, 1, [
    L("Pan MM",cant=0.075),
    {"subreceta_id":S_champis,"cantidad":0.060,"unidad":"kg"},
    L("Halbhartkäse",cant=0.070), L("Parmesano",cant=0.006),
    L("Chilli",cant=0.004), L("Mohn",cant=0.006),
    {"subreceta_id":S_rucola,"cantidad":1,"unidad":"unidad"},
    L("Rúcola",cant=0.004)])

dish("Veggie Sandwich", 14, 1, [
    L("Pan MM",cant=0.146), L("Berenjena",cant=0.070),
    {"subreceta_id":S_pesto,"cantidad":0.015,"unidad":"kg"},
    L("Rúcola",cant=0.010), L("Tomate seco",cant=0.010),
    L("Chilli",cant=0.004), L("Mohn",cant=0.006),
    {"subreceta_id":S_rucola,"cantidad":1,"unidad":"unidad"},
    L("Rúcola",cant=0.004)])

dish("Sandwich Pollo", 14, 1, [
    L("Pan de molde rústico",cant=0.087), L("Pechuga de pollo",cant=0.08),
    L("Mayonesa",cant=0.02), L("Apio",cant=0.015),
    {"subreceta_id":S_cebolla_enc,"cantidad":0.005,"unidad":"kg"},
    L("Sal",cant=0.001), L("Pimienta",cant=0.002),
    L("Lechuga Romana 2",cant=0.02), L("Tomate rodaja",cant=0.03)])

dish("Sandwich Tuna", 14, 1, [
    L("Pan de molde rústico",cant=0.087), L("Atún escurrido",cant=0.08),
    L("Mayonesa",cant=0.02), L("Apio",cant=0.015),
    {"subreceta_id":S_cebolla_enc,"cantidad":0.005,"unidad":"kg"},
    L("Sal",cant=0.001), L("Pimienta",cant=0.001), L("Zumo de limón",cant=0.002)])

# Bagels
dish("Bagel Ham & Cheese", 14, 1, [
    L("Bagel",cant=1,uni="unidad"), L("Jamón",cant=0.023),
    {"subreceta_id":S_cream,"cantidad":0.04,"unidad":"kg"},
    L("Halbhartkäse",cant=0.043)])

dish("Bagel Salmon", 14, 1, [
    L("Salmón",cant=0.04), {"subreceta_id":S_cream,"cantidad":0.03,"unidad":"kg"},
    L("Bagel",cant=1,uni="unidad"), L("Pepino",cant=0.02,uni="unidad"),
    L("Cebolla morada",cant=0.005), L("Sal",cant=0.0025), L("Pimienta",cant=0.001)])

# Pinsas
dish("Pinsa Fleisch", 14, 1, [
    L("Pinsa base",cant=1,uni="unidad"), L("Tomate Pizza Sauce",cant=0.1),
    L("Mozzarella",cant=0.1), L("Jamón",cant=0.09),
    L("Champiñones",cant=0.01), L("Orégano",cant=0.001),
    L("Aceite de oliva",cant=0.01)])

dish("Pinsa Veggie", 14, 1, [
    L("Pinsa base",cant=1,uni="unidad"), L("Tomate Pizza Sauce",cant=0.1),
    L("Mozzarella",cant=0.1), {"subreceta_id":S_pesto,"cantidad":0.035,"unidad":"kg"},
    L("Berenjena",cant=0.02), L("Pimiento rojo",cant=0.1),
    L("Cebolla",cant=0.03), L("Calabacín",cant=0.04),
    L("Orégano",cant=0.001), L("Sal",cant=0.002)])

# Big dishes
dish("Lasagna", 14, 15, [
    L("Carne picada mixta",cant=0.6), L("Cebolla",cant=0.15),
    L("Zanahoria",cant=0.1), L("Apio",cant=0.08), L("Ajo",cant=0.015),
    L("Tomate triturado",cant=0.8), L("Tomatenpüree",cant=0.03),
    L("Vino tinto",cant=0.15,uni="litro"), L("Aceite de oliva",cant=0.045),
    L("Sal",cant=0.002), L("Pimienta",cant=0.002), L("Orégano",cant=0.02),
    L("Laurel",cant=0.001), L("Láminas de pasta",cant=0.25),
    L("Mozzarella",cant=0.25),
    {"subreceta_id":S_bechamel,"cantidad":1,"unidad":"lasagna"},
    L("Parmesano",cant=0.009)])

dish("Parmiggiana", 14, 15, [
    L("Berenjena",cant=0.6), L("Aceite de oliva",cant=0.02),
    L("Tomate Salsa",cant=0.32), L("Mozzarella",cant=0.18),
    L("Parmesano",cant=0.04), L("Albahaca seca",cant=0.03)])

# Salads
dish("César Salad", 14, 1, [
    L("Lechuga Romana 1",cant=0.07), L("Pechuga de pollo",cant=0.13),
    L("Parmesano",cant=0.015),
    {"subreceta_id":S_picatostes,"cantidad":0.04,"unidad":"kg"},
    L("Cherry",cant=0.015),
    {"subreceta_id":S_cesar,"cantidad":0.05,"unidad":"kg"},
    L("Aceite de oliva",cant=0.005), L("Sal",cant=0.001), L("Pimienta",cant=0.001)])

dish("Burrata Salad", 14, 1, [
    L("Burrata (1.30)",cant=1,uni="unidad"), L("Aguacate",cant=0.5,uni="unidad"),
    L("Melocotón",cant=0.06), L("Tomate seco",cant=0.03),
    L("Lechuga Romana 1",cant=0.07), L("Mohn",cant=0.005),
    L("Aceite de oliva",cant=0.015), L("Balsámico",cant=0.008,uni="litro"),
    L("Miel",cant=0.006), L("Mostaza",cant=0.003),
    L("Sal",cant=0.002), L("Pimienta",cant=0.002)])

dish("Nordica Salad", 14, 1, [
    L("Lechuga Romana 1",cant=0.07), L("Salmón",cant=0.04),
    L("Aguacate",cant=0.5,uni="unidad"), L("Cherry",cant=0.05),
    L("Feta",cant=0.03), L("Fresa",cant=0.035),
    L("Aceite de oliva",cant=0.015), L("Balsámico",cant=0.008,uni="litro"),
    L("Miel",cant=0.006), L("Mostaza",cant=0.003),
    L("Sal",cant=0.002), L("Pimienta",cant=0.002)])

# Baos
dish("Bao Carrillera", 14, 1, [
    L("Pan bao",cant=1,uni="unidad"),
    {"subreceta_id":S_carrillera,"cantidad":0.04,"unidad":"kg"},
    L("Repollo morado",cant=0.025,uni="unidad"),
    {"subreceta_id":S_chilly,"cantidad":0.014,"unidad":"kg"}])

dish("Bao Pork Belly", 14, 1, [
    L("Pork Belly",cant=0.05), L("Pan bao",cant=1,uni="unidad"),
    L("Cebolla morada",cant=0.02), L("Aguacate",cant=0.025,uni="unidad"),
    L("Sal",cant=0.001), L("Pimienta",cant=0.001),
    {"subreceta_id":S_chilly,"cantidad":0.014,"unidad":"kg"}])

dish("Bao Vegan", 14, 1, [
    L("Pan bao",cant=1,uni="unidad"), L("Champiñones",cant=0.015),
    L("Berenjena",cant=0.015), L("Aguacate",cant=0.025,uni="unidad"),
    {"subreceta_id":S_cebolla_enc,"cantidad":0.01,"unidad":"kg"},
    L("Rúcola",cant=0.01),
    {"subreceta_id":S_yuzu,"cantidad":0.015,"unidad":"kg"}])

# Tapas
dish("Tortilla", 14, 1, [
    L("Patata",cant=0.25), L("Cebolla",cant=0.05),
    L("Huevo",cant=2,uni="unidad"), L("Aceite de oliva",cant=0.1)])
dish("Chips", 16, 1, [L("Chips",cant=0.06)])
dish("Olives", 16, 1, [L("Aceitunas",cant=0.09)])
dish("Hummus (plato)", 16, 1, [
    {"subreceta_id":S_hummus,"cantidad":0.15,"unidad":"kg"},
    L("Pan Viejo",cant=0.1), L("Chilli Flakes",cant=0.0005),
    L("Aceite de oliva",cant=0.005)])
dish("Guacamole (plato)", 16, 1, [
    {"subreceta_id":S_guacamole,"cantidad":0.15,"unidad":"kg"},
    L("Pan Viejo",cant=0.1), L("Chilli Flakes",cant=0.0005)])
dish("Croquetas Ración", 16, 1, [
    L("Croquetas",cant=4,uni="unidad"),
    {"subreceta_id":S_alioli,"cantidad":0.002,"unidad":"kg"}])
dish("Bravas", 16, 1, [
    L("Patata",cant=0.36),
    {"subreceta_id":S_chilly,"cantidad":0.12,"unidad":"kg"}])
dish("Secreto", 14, 1, [
    L("Secreto",cant=0.14), L("Patata",cant=0.2),
    {"subreceta_id":S_rucola,"cantidad":1,"unidad":"unidad"},
    {"subreceta_id":S_hummus,"cantidad":0.05,"unidad":"kg"}])

# Platters
dish("Cheese Platter", 16, 1, [
    L("Parmesano",cant=0.045), L("Gorgonzola",cant=0.045),
    L("Montasio",cant=0.045), L("Taleggio",cant=0.045),
    L("Nueces",cant=0.010), L("Uvas",cant=0.016)])
dish("Charcuterie Platter", 16, 1, [
    L("Mortadela",cant=0.03), L("Salami",cant=0.03),
    L("Chorizo",cant=0.03), L("Chorizo",cant=0.03),
    L("Nueces",cant=0.010), L("Uvas",cant=0.016)])
dish("Mix Platter", 16, 1, [
    L("Gorgonzola",cant=0.045), L("Taleggio",cant=0.045),
    L("Mortadela",cant=0.03), L("Salami",cant=0.03),
    L("Nueces",cant=0.010), L("Uvas",cant=0.016)])

# Pastries
dish("Carrot Cake", 15, 56, [
    L("Huevo",cant=10,uni="unidad"), L("Azúcar morena",cant=0.25),
    L("Aceite de oliva",cant=0.60), L("Zanahoria",cant=1.30),
    L("Levadura",cant=0.02), L("Sal",cant=0.02),
    L("Canela (molida)",cant=0.01), L("Nueces",cant=0.15),
    L("Harina 1",cant=0.60),
    {"subreceta_id":S_icing,"cantidad":1.12,"unidad":"kg"}], unit="trozo")

dish("Brownie", 15, 56, [
    L("Chocolate",cant=0.65), L("Mantequilla 1",cant=0.36),
    L("Huevo",cant=9,uni="unidad"), L("Azúcar",cant=0.45),
    L("Sirope de arce",cant=0.15), L("Harina 1",cant=0.14),
    L("Cacao en polvo",cant=0.12), L("Sal",cant=0.001)], unit="trozo")

dish("Lemon Cake", 15, 36, [
    L("Huevo",cant=12,uni="unidad"), L("Azúcar",cant=0.30),
    L("Sirope de arce",cant=0.20), L("Aceite vegetal",cant=0.75,uni="litro"),
    L("Cáscara de lima",cant=0.30), L("Cáscara limón rallada",cant=0.35),
    L("Cáscara de naranja",cant=0.51), L("Agua",cant=1.50,uni="litro"),
    L("Azúcar en polvo",cant=0.300), L("Zumo de naranjas",cant=0.436),
    L("Zumo de limones",cant=0.600)], unit="trozo")

dish("Banana Bread", 15, 12, [
    L("Huevo",cant=3,uni="unidad"), L("Azúcar morena",cant=0.12),
    L("Azúcar",cant=0.02),
    {"subreceta_id":S_yogur,"cantidad":0.12,"unidad":"kg"},
    L("Plátano",cant=0.48), L("Leche entera",cant=0.06,uni="litro"),
    L("Mantequilla 1",cant=0.08), L("Harina 1",cant=0.20),
    L("Levadura",cant=0.008), L("Sal",cant=0.002),
    L("Nueces",cant=0.07)], unit="trozo")

dish("Cookies", 15, 19, [
    L("Mantequilla 1",cant=0.22), L("Azúcar morena",cant=0.2),
    L("Azúcar",cant=0.12), L("Huevo",cant=2,uni="unidad"),
    L("Harina 1",cant=0.4), L("Vainilla 1",cant=0.004),
    L("Levadura",cant=0.01), L("Sal",cant=0.002),
    L("Chocolate",cant=0.3),
    {"subreceta_id":S_choco,"cantidad":0.076,"unidad":"kg"}], unit="unidad")

dish("Coulant / Lava Cake", 15, 23, [
    L("Chocolate",cant=0.24), L("Mantequilla 1",cant=0.22),
    L("Harina 1",cant=0.08), L("Cacao en polvo",cant=0.012),
    L("Azúcar",cant=0.25), L("Huevo",cant=8,uni="unidad"),
    L("Leche entera",cant=0.02,uni="litro"), L("Sal",cant=0.001)], unit="unidad")

dish("French Toast", 15, 1, [
    L("Milk Bread",cant=1,uni="unidad"),
    {"subreceta_id":S_crema_masc,"cantidad":0.06,"unidad":"kg"},
    L("Cacao en polvo",cant=0.001),
    {"subreceta_id":S_mezcla_ft,"cantidad":0.06,"unidad":"kg"},
    L("Blueberries",cant=0.004), L("Strawberries",cant=0.004),
    L("Frambuesa",cant=0.004)])

dish("Tarta de queso vasca", 15, 12, [
    L("Mascarpone",cant=0.5), L("Philadelphia",cant=0.5),
    L("Nata",cant=0.5,uni="litro"), L("Huevo",cant=7,uni="unidad"),
    L("Azúcar",cant=0.35), L("Maicena 1",cant=0.03),
    L("Galleta",cant=0.2), L("Mantequilla 2",cant=0.09)], unit="trozo")

dish("New York Cheesecake", 15, 24, [
    L("Galleta",cant=0.5), L("Azúcar",cant=0.1),
    L("Mantequilla 2",cant=0.28), L("Philadelphia",cant=1.9),
    L("Zumo de limón",cant=0.06), L("Harina 2",cant=0.0032),
    L("Azúcar",cant=0.5), L("Vainilla 2",cant=0.1),
    L("Nata",cant=0.12,uni="litro"), L("Huevo",cant=6,uni="unidad"),
    L("Yemas",cant=0.04), L("Agua",cant=0.45,uni="litro"),
    L("Maicena 2",cant=0.24)], unit="trozo")

dish("Budín de pan", 15, 12, [
    L("Pan Viejo",cant=0.3), L("Leche entera",cant=0.5,uni="litro"),
    L("Huevo",cant=2,uni="unidad"), L("Azúcar",cant=0.2),
    L("Mantequilla 1",cant=0.05), L("Vainilla 1",cant=0.002),
    L("Canela (molida)",cant=0.002), L("Azúcar morena",cant=0.05),
    L("Sal",cant=0.001), L("Nueces",cant=0.1)], unit="trozo")

dish("Cinnamon Rolls", 15, 8, [
    L("Mantequilla 1",cant=0.09), L("Leche entera",cant=0.2,uni="litro"),
    L("Harina 1",cant=0.5), L("Nata",cant=0.07,uni="litro"),
    L("Huevo",cant=2,uni="unidad"), L("Sal",cant=0.006),
    L("Azúcar",cant=0.1), L("Levadura",cant=0.012),
    L("Canela (molida)",cant=0.016), L("Azúcar",cant=0.19),
    L("Sal",cant=0.003), L("Mantequilla 1",cant=0.1)], unit="unidad")

dish("Matcha Cheesecake", 15, 7, [
    L("Huevo",cant=4,uni="unidad"), L("Philadelphia",cant=0.2),
    L("Chocolate blanco",cant=0.1), L("Limón 1",cant=0.35),
    L("Galleta",cant=0.1), L("Mantequilla 1",cant=0.05),
    L("Parmesano",cant=0.015), L("Matcha",cant=0.008)], unit="unidad")

print("\n=== DONE ===")
