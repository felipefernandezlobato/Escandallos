# Escandallos — App de Costeo de Recetas

## Resumen

Aplicacion web para gestionar los escandallos (fichas de coste) de una cafeteria con brunch y bebidas. Permite mantener un repositorio de ingredientes con precios actualizados, crear y editar recetas con calculo automatico de costes, definir objetivos de margen por categoria y visualizar la rentabilidad del negocio en un dashboard.

---

## Stack Tecnico

| Capa | Tecnologia | Notas |
|---|---|---|
| Frontend | Next.js + React + Tailwind CSS | UI responsive, mobile-friendly |
| Backend | FastAPI (Python) | API REST, auto-documentacion en /docs |
| Base de datos | SQLite | Fichero local, sin coste, sin setup |
| Hosting frontend | Vercel (free tier) | Hecho por el equipo de Next.js |
| Hosting backend | Render o Railway (free tier) | Soporte Python nativo |
| Coste total | 0 EUR | Free tiers cubren todo |

**Nota:** Los free tiers pueden "dormir" el backend tras inactividad (~10-30s de cold start en la primera peticion del dia). Una vez que alguien lo usa por la manana, se mantiene activo todo el dia.

---

## Modelo de Datos

### Ingredientes

| Campo | Tipo | Descripcion |
|---|---|---|
| id | int | Identificador unico |
| nombre | string | Nombre del ingrediente |
| categoria | string | Categoria (lacteo, fruta, seco, cafe, alcohol...) |
| unidad_compra | string | Unidad en la que se compra (kg, litro, unidad, paquete...) |
| cantidad_compra | decimal | Cantidad por compra (ej: 25 para un saco de 25kg) |
| precio_compra | decimal | Precio de compra por unidad de compra |
| unidad_uso | string | Unidad en la que se usa en recetas (g, ml, unidad...) |
| merma_porcentaje | decimal | Porcentaje de merma/desperdicio (0-100) |
| coste_por_unidad_uso | decimal | **Calculado:** coste real por unidad de uso, ajustado por merma |
| proveedor | string | Nombre del proveedor |
| fecha_actualizacion | date | Ultima vez que se actualizo el precio |
| notas | string | Notas opcionales |

**Calculo del coste real:**
```
coste_por_unidad_uso = (precio_compra / cantidad_en_unidades_uso) / (1 - merma_porcentaje / 100)
```

Ejemplo: Fresas a 4.50 EUR/kg, merma 15%
```
coste_por_gramo = (4.50 / 1000) / (1 - 0.15) = 0.00529 EUR/g
```

### Recetas

| Campo | Tipo | Descripcion |
|---|---|---|
| id | int | Identificador unico |
| nombre | string | Nombre de la receta |
| categoria | string | Categoria (bebida, brunch, postre, snack...) |
| porciones_por_lote | int | Cuantas raciones salen de una preparacion |
| precio_venta | decimal | Precio de venta al publico (opcional) |
| es_subreceta | boolean | Si es una sub-receta reutilizable |
| notas | string | Notas de preparacion, emplatado, etc. |
| fecha_creacion | date | Fecha de creacion |
| fecha_modificacion | date | Ultima modificacion |

### Lineas de Receta (ingredientes de cada receta)

| Campo | Tipo | Descripcion |
|---|---|---|
| id | int | Identificador unico |
| receta_id | int | FK a la receta |
| ingrediente_id | int | FK al ingrediente (null si es sub-receta) |
| subreceta_id | int | FK a otra receta usada como sub-receta (null si es ingrediente) |
| cantidad | decimal | Cantidad usada |
| unidad | string | Unidad (debe ser compatible con unidad_uso del ingrediente) |

### Categorias

| Campo | Tipo | Descripcion |
|---|---|---|
| id | int | Identificador unico |
| nombre | string | Nombre de la categoria |
| tipo | string | "ingrediente" o "receta" |
| margen_objetivo | decimal | Margen objetivo para recetas de esta categoria (%) |

### Historial de Precios

| Campo | Tipo | Descripcion |
|---|---|---|
| id | int | Identificador unico |
| ingrediente_id | int | FK al ingrediente |
| precio_anterior | decimal | Precio antes del cambio |
| precio_nuevo | decimal | Precio nuevo |
| fecha_cambio | date | Fecha del cambio |

---

## Conversiones de Unidades

El sistema manejara conversiones automaticas entre unidades compatibles:

| Familia | Unidades | Conversiones |
|---|---|---|
| Peso | kg, g, mg | 1 kg = 1000 g = 1.000.000 mg |
| Volumen | litro, ml, cl | 1 litro = 1000 ml = 100 cl |
| Unidad | unidad | Sin conversion (1:1) |

Cuando un ingrediente se compra en kg pero se usa en g en las recetas, el sistema convierte automaticamente para calcular el coste correcto.

---

## Secciones de la App

### 1. Panel Principal (Dashboard)

Pagina de inicio con vision general del negocio:

**Alertas:**
- Recetas cuyo margen ha caido por debajo del objetivo
- Ingredientes con cambios de precio recientes
- Recetas sin precio de venta definido

**Rankings:**
- Items mas rentables (mayor margen %)
- Items mas caros (mayor coste por racion)
- Filtrable por categoria

**Tendencias:**
- Evolucion del coste por ingrediente a lo largo del tiempo
- Evolucion del margen medio por categoria
- Graficos de linea simples

### 2. Recetas

Listado de todas las recetas, filtrable por categoria:

- Vista de tarjetas o lista con: nombre, categoria, coste/racion, margen, precio venta
- Indicador de margen: verde (por encima del objetivo), amarillo (cerca), rojo (por debajo)
- Click para ver detalle completo de la receta
- Boton "Nueva receta" accesible desde aqui
- Busqueda por nombre

**Vista de detalle de receta:**

| Ingrediente | Cantidad | Unidad | Coste unit. | Merma | Coste real |
|---|---|---|---|---|---|
| Pan brioche | 1 | unidad | 0.35 | 5% | 0.37 |
| Huevo | 2 | unidad | 0.18 | 0% | 0.36 |
| Jamon iberico | 40 | g | 0.065/g | 15% | 3.06 |
| **Sub-receta:** Holandesa | 60 | ml | — | — | 0.82 |

Resumen:
- Coste por racion
- Objetivo de margen (de la categoria)
- Precio de venta sugerido
- Precio de venta actual
- Margen real con indicador de color

### 3. Nueva Receta (Formulario de Alta)

Formulario para crear recetas nuevas:

1. Nombre de la receta
2. Seleccionar categoria
3. Porciones por lote
4. Anadir ingredientes:
   - Buscador/selector de ingrediente (del repositorio)
   - Cantidad y unidad
   - El coste se calcula en vivo mientras anades ingredientes
5. Anadir sub-recetas:
   - Buscador/selector de sub-recetas existentes
   - Cantidad y unidad
6. Precio de venta (opcional)
7. Notas
8. **Coste total y por racion se muestra en tiempo real** mientras editas

### 4. Ingredientes (Repositorio)

Listado completo de ingredientes:

- Busqueda y filtro por categoria
- Vista de tabla con: nombre, categoria, proveedor, precio compra, merma, coste real/unidad uso
- **Edicion inline** de precios (click en el precio, cambiar, guardar)
- Al cambiar un precio, se registra en el historial y se recalculan todas las recetas afectadas
- Boton para anadir nuevo ingrediente
- Indicador de cuantas recetas usan cada ingrediente

### 5. Importar (Datos de Facturas)

Pantalla para importar datos extraidos de facturas de proveedores:

**Flujo de trabajo:**
1. El usuario sube una factura a Claude (claude.ai o Claude Code)
2. Claude extrae los datos usando un prompt template predefinido (ver seccion Prompt Template)
3. El usuario copia el resultado (formato JSON o tabla)
4. En la app, va a "Importar" y pega los datos
5. La app muestra una vista previa:
   - Ingredientes reconocidos (matched con el repositorio)
   - Ingredientes nuevos (no existen aun)
   - Precios anteriores vs. nuevos
6. El usuario revisa, corrige si es necesario, y confirma
7. Los precios se actualizan y los costes se recalculan en cascada

**Prompt Template para Claude:**
```
Analiza esta factura de proveedor y extrae los datos en el siguiente formato JSON:

{
  "proveedor": "nombre del proveedor",
  "fecha": "YYYY-MM-DD",
  "items": [
    {
      "nombre": "nombre del producto",
      "cantidad": 0,
      "unidad": "kg/litro/unidad/paquete",
      "precio_total": 0.00,
      "precio_unitario": 0.00
    }
  ]
}

Reglas:
- Usa siempre punto como separador decimal
- Si el precio unitario no aparece, calculalo dividiendo precio_total / cantidad
- Ignora lineas de IVA, totales, o datos que no sean productos
- Normaliza las unidades a: kg, g, litro, ml, unidad, paquete
```

### 6. Configuracion

- Gestionar categorias (crear, editar, eliminar) para ingredientes y recetas
- Definir margenes objetivo por categoria de receta
- Definir conversiones de unidades personalizadas (si se necesitan)
- Descargar copia de seguridad (fichero SQLite)
- Restaurar desde copia de seguridad
- Exportar recetas a CSV/Excel
- Exportar listado de ingredientes a CSV/Excel

---

## Navegacion

- **Desktop:** Sidebar izquierdo con las 6 secciones
- **Mobile:** Barra de navegacion inferior (tabs) con las secciones principales (Panel, Recetas, Ingredientes, Importar) y menu hamburguesa para el resto

---

## Cascada de Costes

Comportamiento critico del sistema: cuando cambia un precio o una merma de un ingrediente, los costes se recalculan automaticamente en cadena:

```
Precio ingrediente cambia
  → Recalcular coste_por_unidad_uso del ingrediente
    → Recalcular coste de todas las sub-recetas que lo usan
      → Recalcular coste de todas las recetas que usan esas sub-recetas
        → Actualizar margenes en el dashboard
          → Generar alertas si algun margen cae por debajo del objetivo
```

---

## Estructura del Proyecto

```
escandallos/
├── frontend/                  # Next.js
│   ├── src/
│   │   ├── app/               # Pages (App Router)
│   │   │   ├── page.tsx       # Dashboard / Panel principal
│   │   │   ├── recetas/       # Listado y detalle de recetas
│   │   │   ├── ingredientes/  # Repositorio de ingredientes
│   │   │   ├── importar/      # Importacion de facturas
│   │   │   └── configuracion/ # Ajustes
│   │   ├── components/        # Componentes reutilizables
│   │   └── lib/               # Utilidades, API client, tipos
│   ├── public/
│   ├── package.json
│   └── next.config.js
│
├── backend/                   # FastAPI
│   ├── app/
│   │   ├── main.py            # Entry point FastAPI
│   │   ├── models.py          # Modelos SQLAlchemy
│   │   ├── schemas.py         # Schemas Pydantic (validacion)
│   │   ├── database.py        # Conexion SQLite
│   │   ├── routers/
│   │   │   ├── ingredientes.py
│   │   │   ├── recetas.py
│   │   │   ├── categorias.py
│   │   │   ├── importar.py
│   │   │   └── backup.py
│   │   └── services/
│   │       ├── costes.py      # Logica de calculo de costes y cascada
│   │       └── conversiones.py # Conversiones de unidades
│   ├── data/
│   │   └── escandallos.db     # Fichero SQLite
│   ├── requirements.txt
│   └── alembic/               # Migraciones de BD
│
├── PLAN.md                    # Este fichero
└── README.md
```

---

## API Endpoints

### Ingredientes
- `GET /api/ingredientes` — Listar todos (con filtros por categoria)
- `GET /api/ingredientes/{id}` — Detalle de un ingrediente
- `POST /api/ingredientes` — Crear ingrediente
- `PUT /api/ingredientes/{id}` — Actualizar ingrediente (dispara recalculo en cascada)
- `DELETE /api/ingredientes/{id}` — Eliminar ingrediente
- `GET /api/ingredientes/{id}/historial` — Historial de precios
- `GET /api/ingredientes/{id}/recetas` — Recetas que usan este ingrediente

### Recetas
- `GET /api/recetas` — Listar todas (con filtros por categoria, sub-receta)
- `GET /api/recetas/{id}` — Detalle completo con desglose de costes
- `POST /api/recetas` — Crear receta
- `PUT /api/recetas/{id}` — Actualizar receta
- `DELETE /api/recetas/{id}` — Eliminar receta

### Categorias
- `GET /api/categorias` — Listar todas
- `POST /api/categorias` — Crear categoria
- `PUT /api/categorias/{id}` — Actualizar categoria (nombre, margen objetivo)
- `DELETE /api/categorias/{id}` — Eliminar categoria

### Importar
- `POST /api/importar/preview` — Recibe datos de factura, devuelve preview con matches
- `POST /api/importar/confirm` — Confirma la importacion y actualiza precios

### Dashboard
- `GET /api/dashboard/alertas` — Alertas activas
- `GET /api/dashboard/rankings` — Rankings de rentabilidad
- `GET /api/dashboard/tendencias` — Datos para graficos de tendencias

### Backup
- `GET /api/backup/descargar` — Descargar fichero SQLite
- `POST /api/backup/restaurar` — Restaurar desde fichero
- `GET /api/export/recetas` — Exportar recetas a CSV
- `GET /api/export/ingredientes` — Exportar ingredientes a CSV

---

## Progreso de Implementacion

### Fase 1 — Setup de Proyectos
- [x] 1.1 Inicializar repositorio git
- [x] 1.2 Setup del proyecto FastAPI (backend/) con estructura de carpetas
- [x] 1.3 Configurar SQLite + SQLAlchemy + conexion a base de datos
- [x] 1.4 Configurar Alembic para migraciones
- [x] 1.5 Setup del proyecto Next.js (frontend/) con Tailwind CSS
- [x] 1.6 Configurar API client en frontend para comunicarse con backend
- [x] 1.7 Verificar que frontend y backend se comunican correctamente

### Fase 2 — Modelo de Datos y Logica de Negocio
- [x] 2.1 Modelo de Categorias (SQLAlchemy + migracion)
- [x] 2.2 Modelo de Ingredientes (SQLAlchemy + migracion)
- [x] 2.3 Modelo de Recetas + Lineas de Receta (SQLAlchemy + migracion)
- [x] 2.4 Modelo de Historial de Precios (SQLAlchemy + migracion)
- [x] 2.5 Servicio de conversiones de unidades (kg↔g, litro↔ml, etc.)
- [x] 2.6 Servicio de calculo de costes (merma + coste por unidad de uso)
- [x] 2.7 Servicio de cascada de costes (ingrediente → sub-recetas → recetas → alertas)
- [x] 2.8 Tests unitarios de conversiones, costes y cascada
- [x] 2.9 Seed data: categorias por defecto + unidades

### Fase 3 — CRUD Backend (API Endpoints)
- [x] 3.1 CRUD Categorias: GET, POST, PUT, DELETE /api/categorias
- [x] 3.2 CRUD Ingredientes: GET, POST, PUT, DELETE /api/ingredientes
- [x] 3.3 Historial de precios: GET /api/ingredientes/{id}/historial
- [x] 3.4 Recetas que usan un ingrediente: GET /api/ingredientes/{id}/recetas
- [x] 3.5 CRUD Recetas: GET, POST, PUT, DELETE /api/recetas
- [x] 3.6 Detalle de receta con desglose de costes: GET /api/recetas/{id}
- [x] 3.7 Endpoint de importacion: POST /api/importar/preview + /api/importar/confirm
- [x] 3.8 Tests de endpoints con datos de prueba (25 tests en test_endpoints.py)

### Fase 4 — Frontend: Layout y Navegacion
- [x] 4.1 Layout principal con sidebar (desktop)
- [x] 4.2 Navegacion inferior con tabs (mobile)
- [x] 4.3 Componentes compartidos: tablas, formularios, buscador, indicadores de margen
- [x] 4.4 Responsive design base (probar desktop + mobile)

### Fase 5 — Frontend: Ingredientes
- [x] 5.1 Pagina de listado de ingredientes (tabla con busqueda y filtros por categoria)
- [x] 5.2 Edicion inline de precios (click → editar → guardar → cascada)
- [x] 5.3 Formulario de nuevo ingrediente
- [x] 5.4 Vista de detalle de ingrediente (historial de precios, recetas que lo usan)
- [x] 5.5 Indicador de cuantas recetas usan cada ingrediente

### Fase 6 — Frontend: Recetas
- [x] 6.1 Pagina de listado de recetas (tarjetas con coste, margen, indicador de color)
- [x] 6.2 Filtros por categoria + busqueda por nombre
- [x] 6.3 Vista de detalle de receta (tabla de ingredientes con costes, resumen, margen)
- [x] 6.4 Drill-down en sub-recetas (click para ver desglose)
- [x] 6.5 Formulario de nueva receta con calculo de coste en vivo
- [x] 6.6 Edicion de receta existente (modificar cantidades, ingredientes, porciones)

### Fase 7 — Frontend: Importacion de Facturas
- [x] 7.1 Pantalla de importacion: area de texto para pegar JSON
- [x] 7.2 Vista previa: ingredientes matcheados vs. nuevos, precios anteriores vs. nuevos
- [ ] 7.3 Correccion manual de matches antes de confirmar
- [x] 7.4 Confirmacion y actualizacion de precios con cascada
- [x] 7.5 Documentar prompt template de Claude para extraccion de facturas

### Fase 8 — ~~Frontend: Dashboard (Panel Principal)~~ ELIMINADO
- ~~[x] 8.1 Seccion de alertas~~ — Dashboard eliminado (redundante con Menú)
- ~~[x] 8.2 Rankings de rentabilidad~~ — Dashboard eliminado
- ~~[ ] 8.3 Graficos de tendencias~~ — Dashboard eliminado
- [x] 8.4 Endpoints de dashboard en backend (se mantienen para uso futuro)

### Fase 9 — Frontend: Configuracion
- [x] 9.1 Gestion de categorias (crear, editar, eliminar)
- [x] 9.2 Definir margenes objetivo por categoria de receta
- [x] 9.3 Pagina de configuracion de unidades

### Fase 10 — Backup, Export y Deploy
- [x] 10.1 Endpoint de descarga de backup (fichero SQLite)
- [x] 10.2 Endpoint de restauracion desde backup
- [x] 10.3 Exportacion de recetas a CSV
- [x] 10.4 Exportacion de ingredientes a CSV
- [x] 10.5 Botones de backup y export en la pagina de Configuracion
- [x] 10.6 Manejo de errores y estados vacios en todo el frontend
- [x] 10.7 Test final responsive (probar en movil real)
- [x] 10.8 Deploy frontend a Vercel (https://frontend-bruteam.vercel.app)
- [x] 10.9 Deploy backend a Render (https://bru-escandallos-api.onrender.com)
- [x] 10.10 Verificacion end-to-end en produccion
- [x] 10.11 Autenticacion con password compartido (HMAC token, 7 dias)
- [x] 10.12 Login page con branding BRÜ
- [x] 10.13 Proteccion de todos los endpoints (31 endpoints)

### Fase 11 — Pedidos e Inventario

Objetivo: Reemplazar el sistema actual de pedidos/inventario en Google Sheets por un módulo integrado en la app. El jefe de cocina introduce el inventario actual, la app recomienda qué pedir basándose en consumo histórico, y genera pedidos agrupados por proveedor.

#### 11.1 — Modelo de Datos
- [ ] 11.1.1 Modelo InventarioRegistro: ingrediente_id, cantidad, unidad, fecha_registro (snapshot semanal del stock on-hand)
- [ ] 11.1.2 Modelo Pedido: fecha, proveedor, estado (borrador/enviado/recibido), notas
- [ ] 11.1.3 Modelo LineaPedido: pedido_id, ingrediente_id, cantidad_pedida, unidad, cantidad_recibida (null hasta recepción), precio_unitario
- [ ] 11.1.4 Migraciones Alembic para las nuevas tablas
- [ ] 11.1.5 Servicio de cálculo de consumo medio (basado en historial de pedidos + inventario)

#### 11.2 — Importar Datos Históricos del Excel
- [ ] 11.2.1 Script para parsear "ESTUDIO ingredientes" del Excel: mapear filas a ingredientes, columnas I+ a pedidos por fecha
- [ ] 11.2.2 Extraer inventario on-hand de los comentarios de celdas
- [ ] 11.2.3 Calcular consumo semanal real: pedido_semana_anterior + inventario_anterior - inventario_actual
- [ ] 11.2.4 Cargar datos históricos en las nuevas tablas (~25 semanas de datos)

#### 11.3 — Backend: API de Inventario y Pedidos
- [ ] 11.3.1 CRUD Inventario: POST /api/inventario (registrar stock actual), GET /api/inventario (historial)
- [ ] 11.3.2 GET /api/inventario/recomendacion — calcula qué pedir: consumo_medio_semanal - stock_actual + margen_seguridad
- [ ] 11.3.3 CRUD Pedidos: GET, POST, PUT, DELETE /api/pedidos
- [ ] 11.3.4 POST /api/pedidos/{id}/recibir — registrar recepción, actualizar precios de ingredientes si cambiaron
- [ ] 11.3.5 GET /api/pedidos/por-proveedor — agrupar recomendación por proveedor para generar pedido
- [ ] 11.3.6 GET /api/consumo/{ingrediente_id} — historial de consumo semanal + media móvil

#### 11.4 — Frontend: Registro de Inventario
- [ ] 11.4.1 Página /inventario — lista rápida de ingredientes con input numérico para stock actual
- [ ] 11.4.2 Agrupado por categoría, con búsqueda rápida
- [ ] 11.4.3 Botón "Guardar inventario" que registra el snapshot completo
- [ ] 11.4.4 Vista de historial de inventario (qué se registró cada semana)

#### 11.5 — Frontend: Recomendación y Pedidos
- [ ] 11.5.1 Página /pedidos — vista de recomendación: ingrediente, stock actual, consumo medio, cantidad sugerida
- [ ] 11.5.2 El usuario puede ajustar cantidades antes de confirmar
- [ ] 11.5.3 Vista agrupada por proveedor (Prodega, Rietschi, etc.) para hacer el pedido fácil
- [ ] 11.5.4 Botón "Crear pedido" que guarda el pedido como borrador
- [ ] 11.5.5 Flujo de recepción: marcar pedido como recibido, ajustar cantidades reales, actualizar precios si cambiaron
- [ ] 11.5.6 Historial de pedidos anteriores

#### 11.6 — Frontend: Análisis de Consumo
- [ ] 11.6.1 Gráfico de consumo semanal por ingrediente (últimas 12 semanas)
- [ ] 11.6.2 Alertas de stock bajo (por debajo de 2 días de consumo)
- [ ] 11.6.3 Tendencias de consumo (subiendo/bajando/estable)
- [ ] 11.6.4 Coste semanal total de pedidos por proveedor

#### 11.7 — Mejora de Importación de Facturas
- [ ] 11.7.1 Al importar factura, actualizar precios de ingredientes existentes automáticamente
- [ ] 11.7.2 Preview claro: precio anterior vs nuevo, con % de cambio
- [ ] 11.7.3 Confirmar → actualiza precios + crea historial + recalcula costes
- [ ] 11.7.4 Opción de crear pedido desde la factura importada (registrar como "recibido")

#### 11.8 — Tests y Deploy
- [ ] 11.8.1 Tests de endpoints de inventario y pedidos
- [ ] 11.8.2 Test de cálculo de consumo medio y recomendación
- [ ] 11.8.3 Deploy a producción (push → auto-deploy)

---

## Backlog (v2+)

### Prioridad alta (v1.1)
- **Menú dinámico en base de datos** — Guardar items del menú, PVPs y links a recetas en la BD en vez de hardcoded. Editable desde la app
- **Ajustar rendimiento Cold Brew** — Pesar exactamente cuánto rinde la receta (actualmente estimado en 3.5L)
- **Recetas que faltan** — Fresh Orange Juice, Croissant plain, Focaccias
- **PVPs botellas de vino** — Confirmar precios de venta por botella (actualmente copa×4)

### Prioridad media (v2)
- **Simulador de impacto de precios** — "Si la leche sube a X, cuanto cambian los margenes?"
- ~~**Comparador de proveedores**~~ — HECHO (Prodega/Rietschi/Covin/Caporaso/Pfaff/Covin, agrupado por categoría)
- ~~**Vista de historial de precios**~~ — HECHO (página detalle de ingrediente /ingredientes/[id])
- **Integracion directa con Claude API** — Procesar facturas dentro de la app sin salir a claude.ai
- **Fichas imprimibles** — Generar PDF del escandallo para colgar en la cocina
- ~~**Importar precios desde facturas PDF**~~ — Parcialmente HECHO (PDF upload + extracción de texto)

### Prioridad baja (v2+)
- **Backups automaticos a la nube** — Copia diaria a Google Drive o Dropbox
- **Fotos de platos** — Subir foto del plato terminado a cada receta
- **Historial de cambios en recetas** — Ver versiones anteriores de una receta
- **Multi-local** — Si abres mas cafeterias, gestionar escandallos por local
- **Contabilizar CO2 cerveza** — Repartir coste de botella CO2 entre las cervezas de grifo

---

## Decisiones de Diseno

| Decision | Eleccion | Razon |
|---|---|---|
| Idioma UI | Espanol | Equipo trabaja en espanol |
| Autenticacion | Ninguna | Equipo pequeno, todos con acceso completo |
| Base de datos | SQLite | Gratis, sin setup, suficiente para el volumen |
| Procesamiento de facturas | Externo via Claude | Sin coste adicional, aprovecha suscripcion existente |
| Hosting | Vercel + Render free tiers | Coste total: 0 EUR |
| Sub-recetas | Si | Esencial para preparaciones base compartidas |
| Merma | Si | Critico para costes reales en productos frescos |
| Conversiones de unidades | Automaticas | Evita errores de calculo manual |
| Roles/permisos | No | Innecesario para equipo pequeno |
