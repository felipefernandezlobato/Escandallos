# Sesión 2026-09-30 — Desglose BRU1/BRU2 en el pivot, y el fallo del Pedido #103

Commits: `231ef6a` · `5a6a9e4` (otra sesión) · `1e88905` · `6254bad` · `e64ea5f` · `7dd9178` · `77bfc15` · `c966234`

## 1. Punto de partida: ¿el pivot suma las dos tiendas?

La pregunta inicial fue si la columna del historial de inventario sumaba BRU1 + BRU2. Sí: para café, `inventario_pivot` agrupa por semana, coge **el último día contado de esa semana** y pasa sus registros por `_day_total()`, que suma por ubicaciones distintas (misma ubicación el mismo día = corrección, gana el id más alto).

Para `100g BD Savage` eso daba `2 · 2 · 4 · 0`, que se descompone exactamente así:

| Columna | Día real | BRU1 | BRU2 | Total |
|---|---|---|---|---|
| 30.09.26 | 30-09 | 2 | sin contar | 2 |
| 23.09.26 | 23-09 | 0 | 2 | 2 |
| 16.09.26 | **17-09** | 2 | 2 | 4 |
| 09.09.26 | 09-09 | 0 | 0 | 0 |

Las cabeceras del pivot son el **miércoles de la semana ISO**, no el día del conteo — por eso el conteo del 17-09 aparece bajo `16.09.26`.

## 2. Desglose `(BRU1+BRU2)` en el pivot (`231ef6a`)

Cada celda de café muestra ahora el reparto en pequeño al lado del total: `19 (14+5)`.

- El split se colapsaba en el backend, así que hizo falta un campo nuevo `fechas_ubic` en `/api/inventario/pivot`.
- Se extrajo `_day_por_ubicacion()` de `_day_total()` para que el pivot lea el reparto de la **misma** fuente que produce el total, sin añadir una cuarta copia de la regla.
- **Solo se emite si `BRU1 + BRU2` cuadra con el total** que tiene al lado. Las filas de total (`= Café en grano ROJO`) suman el desglose de sus hijos y solo lo muestran si **todos** los hijos que aportan tienen el suyo.
- Medido en navegador: columnas de 74/73/69/74 px, **idénticas** a antes. La cabecera `30.09.26` sigue marcando el ancho; a 9px con `tracking-tight` hasta `114 (39+75)` cabe debajo.
- Se cambió la coma por `+` tras verlo renderizado: `62 (23,39)` se leía como 23.39 y `0.5 (0,5)` repetía la misma cifra en dos notaciones. `12 (7+5)` ya era el idioma de la ficha de ingrediente.
- `/api/inventario/pivot` no tenía **ningún** test. Ahora tiene 7.

## 3. El fallo del Pedido #103

Investigando dos números que el usuario vio mal (`62 (23+39)` y `45 (15+30)`) apareció un fallo real.

`recibir_pedido()` escribe **una** fila de inventario por línea con:

```
cantidad = (stock sumado de TODAS las ubicaciones) + cantidad_recibida
ubicacion = la del último registro que hubiera   # pedidos.py:433-436
```

El 23-09 Nelson apuntó primero BRU1 y luego BRU2, así que la entrega se etiquetó **BRU2** llevando dentro los 23 kg de BRU1. El pivot volvía a sumar BRU1 por separado:

| | BRU1 | BRU2 | recibido | fila entrega | sistema | real | infla |
|---|---|---|---|---|---|---|---|
| Ethiopia By Dabov | 23 | 1 | 15 | 24+15 = 39 @BRU2 | **62** | 39 | +23 |
| Honduras Caballero | 15 | 0 | 15 | 15+15 = 30 @BRU2 | **45** | 30 | +15 |

**Alcance auditado: una sola vez.** 17 artículos, 133 unidades, solo el Pedido #103. Necesita un artículo contado en las **dos** tiendas recibido justo en día de conteo; los otros 11 pedidos de bolsas llegaron en días sin conteo, y los tubos frozen no pueden dispararlo porque cada sabor es un ingrediente distinto por tienda.

El stock de hoy ya estaba bien por el reconteo del 30-09. Lo que seguía mal era la columna del 23-09 y, sobre todo, **el consumo de esa semana** (48 kg en vez de ~25 para el Ethiopia), que alimenta los par levels.

### Lo que NO era un fallo

La auditoría marcó como segundo bug 9 casos (Pedidos #83, #84, #90, #91) donde un conteo posterior del mismo día borró la entrega. Eso es precisamente la regla deseada funcionando — por la regla de corrección misma-ubicación, no por diseño.

## 4. La regla, y la corrección de la regla

### Primer intento (`6254bad`) — demasiado ancho

> Si el día tiene algún conteo manual, se descartan las filas de entrega.

Esto arreglaba el #103 sin tocar un solo registro (el histórico se recalcula solo), pero **se comió tres entregas reales del mismo 30-09**:

| Pedido | Sabor | Conteo | Entregado | Salía | Correcto |
|---|---|---|---|---|---|
| #122 BD | Tennessee Bru1 | 0 | 5 | 0 | 5 |
| #122 BD | Lalo Bru1 | 1 | 6 | 1 | 7 |
| #123 Dabov | COE Ethiopia Bru2 | 0 | 7 | 0 | 7 |

Nelson había contado 0 por la mañana y el pedido llegó **después**. `Tubos Frozen Bru1` bajó de 54 a 43 y Bru2 de 65 a 58.

### Regla definitiva (`77bfc15`)

El fallo nunca fue la precedencia conteo/entrega. Era que la cifra de la fila es un total **entre ubicaciones** con una sola etiqueta. Si el ingrediente solo se cuenta en una tienda, ese total **es** el de esa tienda y la fila es correcta. Solo cuando el día tiene conteos en BRU1 **y** BRU2 la cifra ya lleva las dos dentro.

```python
# _day_por_ubicacion(), consumo.py
conteos = [r for r in records if not _es_fila_de_pedido(r)]
if len({r.ubicacion for r in conteos}) > 1:
    records = conteos
```

La condición es **"el día abarca dos tiendas"**, no "hay conteo". Arregla el #103 y no rompe el #122/#123. En `historial_frozen_por_ubicacion()` se vuelve a *latest-wins* puro, porque ahí los sabores son de una sola tienda por diseño.

**Lección: no ensanchar una regla más allá del defecto demostrado.**

### Detección del marcador (`e64ea5f`)

`^Pedido( #\d+)? recibido$`, anclado, nunca la subcadena `"recibido"` ni un `LIKE` de SQL:

- `"Recibido 4 tubos de BRU1"` (2 filas) son traslados reales entre tiendas. Una de ellas convive con un conteo ese día: el patrón laxo perdía 4 tubos.
- `"Pedido #55 (parcial) recibido"` es plausible en un conteo a mano. El `LIKE 'Pedido #%recibido'` que había puesto lo clasificaba como entrega **solo** en `_batch_latest_stocks`, haciendo que `/api/menu/frozen` discrepara de `stock_actual()`.
- La forma legacy `"Pedido recibido"` (22 filas, todas no-café) sí es entrega y debe seguir excluida del consumo.

## 5. Fechas con un día de menos (`7dd9178`)

El Historial de Conteos mostraba el conteo del 30-09 como **29/9**, y todas las columnas desplazadas (24→23, 17→16, 9→8, 7→6).

`new Date("2026-09-30")` se parsea como **medianoche UTC** y `toLocaleDateString` la pinta en la zona horaria del navegador. Al oeste de UTC es el día anterior.

| Zona | Antes | Ahora |
|---|---|---|
| Europe/Zurich | 30/9 | 30/9 |
| America/Argentina | **29/9** | 30/9 |
| Pacific/Honolulu | **29/9** | 30/9 |

Desde Basilea siempre salió bien, que es por lo que nunca se vio. Eran los **3 únicos** sitios de la app que meten una fecha cruda de la API en `new Date()` para pintarla, los tres en `ingredientes/[id]/page.tsx`: las cabeceras del Historial, la columna Fecha de Movimientos y el `Ult. <fecha>`. Centralizado en `formatFechaISO()` con `timeZone: "UTC"`. El pivot es inmune porque sus cabeceras salen de una clave de semana ISO que `weekKeyToLabel` construye y lee entera en UTC.

## 6. Tubos frozen fundidos en una fila (`c966234`)

Cada sabor frozen son dos ingredientes (uno por tienda), así que ocupaba dos líneas y **ninguna podía llevar desglose**: cada ingrediente solo tiene registros en una ubicación, así que `_desglose_ubicaciones()` nunca veía las dos claves.

De **44 filas a 22**. Al rellenar `fechas_ubic` el frontend ya pinta el paréntesis solo.

- Emparejado por nombre sin el sufijo de tienda, reutilizando `_coffee_name()` de `menu.py` — es como `/api/menu/frozen` ya agrupa. Auditado: **21 parejas completas**, sufijo siempre exactamente `" Bru1"`/`" Bru2"`, cero desparejados.
- El desglose sale **del padre** (289=Bru1, 290=Bru2), nunca de `ubicacion`: 5 filas de entrega de tubos la tienen a null porque `recibir_pedido()` la hereda.
- **Frozen Nicaragua El Suspiro** es la única pareja asimétrica: inactivo en Bru1, vivo en Bru2. La fila fundida se queda con el **id del lado activo**, porque el pivot oculta inactivos por defecto y apuntar al lado muerto habría escondido un sabor que se sigue contando.
- Los dos padres se funden en `= Tubos Frozen`, que pasa a ordenarse como fila de total al final de la sección.

## 7. Verificación

- **137 tests** pasan. Al empezar la sesión `/api/inventario/pivot` tenía **cero**.
- Contra la base de producción: 311 celdas con desglose, **0 que no cuadren**.
- Capturas de navegador para el ancho de columna y para la sección de tubos fundida.
- Semana 39 después del arreglo: `Café en grano ROJO` 114 → 48, `Cápsulas Dabov` 98 → 34. Las series semanales ya no tienen el pico (`MARRÓN w35:16 w36:14 w37:12 w38:15 w39:13 w40:8`).
- `Resumen Café — Pedidos` cuadra término a término con las fichas: `13.75 × (4.29 + 3.0) + 11.3 = 111.5`, con ciclo mensual vía override de proveedor y lead de 3 semanas de Dabov.

## 8. Cambios de datos

Solo **uno**, el que pidió el usuario: registro `3584`, conteo BRU2 de `1kg DABOV Ethiopia By Dabov` el 23-09, de **1 a 3**.

Las 17 filas infladas del Pedido #103 **no se tocaron** — el arreglo de lectura las neutraliza y el histórico se recalcula bien solo.

> Ojo: la fila de conteo manual decía **1**, no 3. El 39 era la cifra inventada por la entrega. Se puso 3 por instrucción explícita; si el conteo real de BRU2 era 1, hay que revertirlo.

## 9. Pendiente

**El fallo de raíz sigue ahí.** `recibir_pedido()` + `stock_base_recepcion_pedido()` siguen escribiendo la fila de entrega con el stock sumado de todas las ubicaciones y una sola etiqueta. Se está neutralizando **al leer**, que fue la decisión del usuario (opción 1 de 2). Arreglarlo en la escritura cerraría también el caso latente de la `ubicacion` nula: hoy los 5 registros nulos están solos en su día, así que no infla nada, pero `_day_por_ubicacion` trata `None` como un bucket propio y sumaría.

Otras cosas menores:

- `inventario_registros` no guarda hora, solo fecha. No se puede auditar a qué hora metió Nelson un conteo, solo el orden de inserción por id. Un `created_at` sería barato.
- Los 42 pares de tubos tienen `precio_compra`/`coste_kg_frozen`/`suplemento_frozen` idénticos entre Bru1 y Bru2 por convención, no por constraint. Si un arreglo de precio toca un solo lado, la fila fundida mostraría el del lado elegido sin avisar.
- `Frozen Nicaragua El Suspiro` sigue sin `coste_kg_frozen` ni `suplemento_frozen` en **los dos** lados.
