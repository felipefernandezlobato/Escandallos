"""Rebuild all data from scratch with clean ingredient IDs."""
import json
import requests

API = "http://localhost:8000"

def post(path, data):
    r = requests.post(f"{API}{path}", json=data)
    if r.status_code not in (200, 201):
        print(f"ERROR {r.status_code} on {path}: {r.text[:200]}")
        return None
    return r.json()

def put(path, data):
    r = requests.put(f"{API}{path}", json=data)
    return r.json()

# ============================================================
# INGREDIENTS (already deduplicated)
# ============================================================
ingredients = [
    # ID will be assigned sequentially starting from 1
    # Frutas (cat 2)
    {"nombre": "Fruta congelada", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 8.95, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Pera", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 3.35, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Blueberries", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 16.40, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Strawberries", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 11.80, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Frambuesa", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 29.00, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Uvas", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 7.90, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Plátano", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.90, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Lima", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.98, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Fresas congeladas", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 5.94, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Naranja entera", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.60, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Melocotón", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.68, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Fresa", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 6.40, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Cáscara limón rallada", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 0, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Cáscara de lima", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 0, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Cáscara de naranja", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 0, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Zumo de naranjas", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.85, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Zumo de limones", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.70, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Limón 1", "categoria_id": 2, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 3.15, "unidad_uso": "kg", "merma_porcentaje": 0},
    # Verduras (cat 3)
    {"nombre": "Cebolla morada", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.90, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Ajo", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 11.12, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Ajo 2", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 15.50, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Ajo picado", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 4.60, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Cebolla", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.02, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Cebolla (champis)", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 8.01, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Cebollino", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 4.00, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Jengibre fresco", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 10.82, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Jengibre seco", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 24.04, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Rúcola", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 10.20, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Cherry", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 5.70, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Pepino", "categoria_id": 3, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 2.10, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Champiñones", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 8.75, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Aguacate", "categoria_id": 3, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 1.55, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Tomate", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 3.12, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Albahaca fresca", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 29.96, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Albahaca seca", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.85, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Brotes de cebolla", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 41.10, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Brotes de soja", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 41.10, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Berenjena", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 5.20, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Zanahoria", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.65, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Tomate rodaja", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.65, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Repollo morado", "categoria_id": 3, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 2.20, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Pimiento rojo", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 5.94, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Calabacín", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.44, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Lechuga Romana 1", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 6.13, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Lechuga Romana 2", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.88, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Patata", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.60, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Tomate seco", "categoria_id": 3, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 10.50, "unidad_uso": "kg", "merma_porcentaje": 0},
    # Secos (cat 4)
    {"nombre": "Azúcar", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.40, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Azúcar morena", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.54, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Azúcar en polvo", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 3.42, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Avena", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 3.02, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Nueces", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 14.46, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Anacardo", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 14.46, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Avellana", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 11.50, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Almendra", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 12.16, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Miel", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 10.88, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Chía", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 7.49, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Coco láminas tostado", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 14.97, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Peanut butter", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 13.12, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Harina 1", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.14, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Harina 2", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 15.54, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Garbanzos", "categoria_id": 4, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 3.45, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Chips", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 11.15, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Galleta", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 13.30, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Láminas de pasta", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 6.38, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Chocolate", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 22.80, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Chocolate blanco", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 38.31, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Cacao en polvo", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 22.04, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Pistachio Paste", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 16.00, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Avellanas (14.00)", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 14.00, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Maicena 1", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 3.18, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Maicena 2", "categoria_id": 4, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 7.95, "unidad_uso": "kg", "merma_porcentaje": 0},
    # Café (cat 5)
    {"nombre": "Café molido", "categoria_id": 5, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 18.50, "unidad_uso": "kg", "merma_porcentaje": 0},
    # Alcohol (cat 6)
    {"nombre": "Vino tinto", "categoria_id": 6, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 3.07, "unidad_uso": "litro", "merma_porcentaje": 0},
    # Carne (cat 7)
    {"nombre": "Anchoas", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 20.00, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Carrillera", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 29.95, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Bacon", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 15.99, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Salmón", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 22.90, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Jamón", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 14.84, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Pechuga de pollo", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 11.50, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Atún escurrido", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 12.87, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Carne picada mixta", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 15.50, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Pork Belly", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 13.00, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Mortadela", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 18.30, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Salami", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 17.90, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Chorizo", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 23.50, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Secreto", "categoria_id": 7, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 21.95, "unidad_uso": "kg", "merma_porcentaje": 0},
    # Panadería (cat 8)
    {"nombre": "Pan MM", "categoria_id": 8, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 11.25, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Pan Viejo", "categoria_id": 8, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 0, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Pan de molde rústico", "categoria_id": 8, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 3.28, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Croissant", "categoria_id": 8, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 2.90, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Bagel", "categoria_id": 8, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 1.07, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Milk Bread", "categoria_id": 8, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 0.46, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Pan bao", "categoria_id": 8, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 0.56, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Pinsa base", "categoria_id": 8, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 3.05, "unidad_uso": "unidad", "merma_porcentaje": 0},
    # Huevos (cat 9)
    {"nombre": "Huevo", "categoria_id": 9, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 0.42, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Yemas", "categoria_id": 9, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 11.35, "unidad_uso": "kg", "merma_porcentaje": 0},
    # Especias (cat 10)
    {"nombre": "Canela en rama", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 53.52, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Anís", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 73.80, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Clavo", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 51.64, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Canela (molida)", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 28.70, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Sal", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.10, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Pimienta", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 24.73, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Mostaza", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 3.60, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Comino", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 29.37, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Chilli", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 8.84, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Mohn", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 6.00, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Orégano", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 29.37, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Laurel", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 160.00, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Nuez moscada", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 46.36, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Chilli Flakes", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 30.48, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Polvo de trufa", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 10.20, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Vainilla 1", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 32.27, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Vainilla 2", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 14.52, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Extracto vainilla 1", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 32.40, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Extracto vainilla 2", "categoria_id": 10, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 7.80, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Sriracha", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.95, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Matcha", "categoria_id": 10, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 90.80, "unidad_uso": "kg", "merma_porcentaje": 0},
    # Lácteo (cat 1)
    {"nombre": "Leche de avena", "categoria_id": 1, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 2.75, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Leche entera", "categoria_id": 1, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 1.50, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Leche sin lactosa", "categoria_id": 1, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 2.20, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Yogur", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 4.59, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Mantequilla 1", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 12.90, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Mantequilla 2", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.20, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Nata", "categoria_id": 1, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 6.30, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Philadelphia", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 12.09, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Parmesano", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 24.08, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Mozzarella", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 5.88, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Burrata 125g", "categoria_id": 1, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 1.50, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Mascarpone", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 17.46, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Queso", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 12.38, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Halbhartkäse", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 12.26, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Taleggio", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 10.00, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Gorgonzola", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 12.50, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Montasio", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 14.60, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Feta", "categoria_id": 1, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 12.05, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Burrata (1.30)", "categoria_id": 1, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 1.30, "unidad_uso": "unidad", "merma_porcentaje": 0},
    # Otros (cat 12)
    {"nombre": "Agua", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 0, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Vinagre", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 2.88, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Balsámico", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 5.79, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Zumo de lima", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 8.94, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Zumo de limón", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.80, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Mayonesa", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 6.58, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Sirope de arce", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 22.54, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Maple Sirup", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 23.00, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Soja", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 8.79, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Mirin", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 6.50, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Mirin 0% alcohol", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 15.00, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Miso", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 4.95, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Aceite de oliva", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 8.20, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Aceite vegetal", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 4.50, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Aceite girasol", "categoria_id": 12, "unidad_compra": "litro", "cantidad_compra": 1, "precio_compra": 4.50, "unidad_uso": "litro", "merma_porcentaje": 0},
    {"nombre": "Aceitunas", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 6.21, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Tahini", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 8.01, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Tomate Pizza Sauce", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 1.96, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Tomate triturado", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.28, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Tomatenpüree", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 5.30, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Tomate Salsa", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 2.67, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Alcaparras", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 5.59, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Croquetas", "categoria_id": 12, "unidad_compra": "unidad", "cantidad_compra": 1, "precio_compra": 0.625, "unidad_uso": "unidad", "merma_porcentaje": 0},
    {"nombre": "Levadura", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 6.58, "unidad_uso": "kg", "merma_porcentaje": 0},
    {"nombre": "Apio", "categoria_id": 12, "unidad_compra": "kg", "cantidad_compra": 1, "precio_compra": 4.52, "unidad_uso": "kg", "merma_porcentaje": 0},
]

print(f"Creating {len(ingredients)} ingredients...")
ing_map = {}  # name -> id
for ing in ingredients:
    result = post("/api/ingredientes", ing)
    if result:
        ing_map[result["nombre"]] = result["id"]

print(f"Created {len(ing_map)} ingredients")
print("Ingredient IDs:", json.dumps(ing_map, indent=2, ensure_ascii=False))
