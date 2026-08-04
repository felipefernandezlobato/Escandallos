# Escandallos — Coffee Shop Recipe Costing App

## Business Context

This is an internal tool for a coffee shop that serves brunch and drinks. The team is small and Spanish-speaking. The app manages "escandallos" — recipe cost cards used in Spanish hospitality to track the true cost of every dish and drink on the menu.

## Business Rules

### Costing
- Every ingredient has a **merma (waste/yield) percentage**. The real cost per usable unit must account for merma: `coste_real = (precio_compra / cantidad_en_unidades_uso) / (1 - merma / 100)`
- When an ingredient price changes, **all recipes and sub-recipes using it must recalculate automatically** (cost cascade)
- Sub-recipes (e.g., salsa holandesa, syrup base) are recipes that can be used as ingredients in other recipes. A sub-recipe change cascades to all parent recipes
- Unit conversions are automatic: ingredients can be purchased in one unit (kg, litro) and used in another (g, ml) in recipes

### Margins & Pricing
- Each recipe category (bebidas, brunch, postres...) has a **margin target** (e.g., 70% for drinks, 65% for brunch)
- The app suggests a sale price based on the category's margin target
- Margin indicators: green (above target), yellow (close), red (below)
- Dashboard alerts when a recipe's margin drops below its category target

### Invoice Import
- Invoice processing happens **outside the app** via Claude (claude.ai or Claude Code) — no in-app AI
- The user pastes structured JSON data extracted from invoices into the app's import screen
- The app matches imported items to existing ingredients, shows a preview, and the user confirms
- This leverages the user's existing Claude subscription at zero extra cost

### Data
- No authentication or user roles — small team, everyone has full access
- **Production:** Neon PostgreSQL (free tier, EU Frankfurt) — persists across Render sleep/wake
- **Local dev:** SQLite (file-based, zero config) — or connect to Neon with DATABASE_URL
- Backups via JSON download from `/api/backup/descargar`
- Price history is tracked: every ingredient price change is recorded with date and old/new values

## Tech Stack

- **Frontend:** Next.js (React) + Tailwind CSS — hosted on Vercel (free tier)
- **Backend:** FastAPI (Python) + SQLAlchemy — hosted on Render (free tier)
- **Database:** Neon PostgreSQL (production) / SQLite (local dev)
- **Total hosting cost:** 0 EUR

## UI Language

The entire UI is in **Spanish**. All labels, messages, placeholders, and content must be in Spanish.

## Categories

Two types of categories, both user-customizable:
- **Ingredient categories:** lacteo, fruta, seco, cafe, alcohol, carne, panaderia, etc.
- **Recipe categories:** bebida, brunch, postre, snack, etc. Each has a margin target.

## Unit System

| Family | Units | Conversions |
|---|---|---|
| Weight | kg, g, mg | 1 kg = 1000 g |
| Volume | litro, ml, cl | 1 litro = 1000 ml = 100 cl |
| Unit | unidad | No conversion |

Ingredients define a purchase unit and a usage unit. The system converts between them automatically.

## Key Constraints

- Must be 100% free to host and run (no paid APIs, no paid databases, no paid hosting)
- No authentication — keep it simple
- Mobile-friendly — kitchen staff may use it on phones/tablets
- Data must be exportable (CSV) and backupable (JSON download)

## Project Structure

```
escandallos/
├── frontend/    # Next.js + Tailwind
├── backend/     # FastAPI + SQLite
├── PLAN.md      # Implementation plan and full design spec
└── CLAUDE.md    # This file — business rules and project context
```

## Database

**Production uses Neon PostgreSQL** (free tier) — data persists across Render sleep/wake cycles.
**Local dev uses SQLite** (file-based, zero config).

The `DATABASE_URL` env var controls which database to use:
- Not set → defaults to `sqlite:///data/escandallos.db` (local dev)
- Set to Neon URL → connects to PostgreSQL (production on Render)

### First-time Neon setup:
1. Create a free account at https://neon.tech
2. Create a project, get the connection string
3. Set `DATABASE_URL` in Render dashboard env vars
4. Run migration: `DATABASE_URL="postgresql://..." alembic upgrade head`
5. Run data import: `DATABASE_URL="postgresql://..." python migrate_to_neon.py`

### Local dev:
Two options:
1. **Connect to Neon (recommended)** — same data as production, no sync needed:
   ```
   DATABASE_URL="postgresql://neondb_owner:npg_HxCRZJiBM3K0@ep-sparkling-morning-asxoz7zv.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require" python -m uvicorn app.main:app --port 8000
   ```
2. **Use local SQLite** — no env var needed, isolated dev database

## Deploy Checklist

After making changes:
1. `git push` — triggers Vercel auto-deploy for frontend
1b. Trigger Vercel deploy (if needed): `curl -s "https://api.vercel.com/v1/integrations/deploy/prj_VpRYLvM9NtDVZY2xJf0Ehc53fREb/iLu6M7L1mE"`
2. Trigger Render deploy: `curl -s "https://api.render.com/deploy/srv-d99vh8u7r5hc73bvaf9g?key=W1tZafHDZ9U"`
3. Wait ~2-3 min, then verify: `curl -s -o /dev/null -w "%{http_code}" https://bru-escandallos-api.onrender.com/api/categorias` (expect 401)
4. Frontend: https://escandallos-bruteam.vercel.app
5. Backend: https://bru-escandallos-api.onrender.com

Render start command is `bash start.sh` (set in dashboard, NOT render.yaml). It auto-handles alembic migrations.

## Supply Chain

- Per-supplier `lead_time_dias` and `ciclo_pedido_dias` in proveedores table
- Par level formula: `media * (cycle + lead) + safety` with supplier-specific values
- Supply chain stats shown on ingredient detail pages (Lead Time, Ciclo Pedido, Consumo/Ciclo)
- Recommendation page fetches fresh data (no localStorage cache for calculated values)

## Coffee Inventory System

- **Parent-child ingredients:** `grupo_ingrediente_id` FK on ingredientes, `activo` flag for show/hide
- **4 color labels** from Dabov catalog: MARRÓN (brown), ROJO (red), BLACK (exclusive), GOLD (competition)
- **Formats:** 1kg beans, 200g retail, 130g competition, frozen tubes, capsules
- **Multi-location:** `ubicacion` field on inventario_registros (BRU1/BRU2)
- **Frozen tubes:** separate parents per location, `consumo_override_semanal` from Lightspeed POS, `par_level_override`. Pricing via `coste_kg_frozen`, `suplemento_frozen`, `frozen_origen_id` columns (NOT `precio_compra`)
- **Café analysis table:** always visible in Cafe tab, single `/api/inventario/cafe-resumen` endpoint
- **Gestionar Cafés:** modal to activate/deactivate coffees
- Display order everywhere: MARRÓN → ROJO → BLACK → GOLD

## Oat Milk Variant

- Recipes with "Leche entera" auto-show a green "Avena" row with swapped cost + 0.50 CHF surcharge
- Shows in both summary cards and ingredient table (↳ Leche de avena line)
- No DB change needed — purely frontend display calculation

## Consumption & Ordering

- `consumo_semanal()` excludes "Pedido recibido" inventory records (they duplicate order data)
- Received orders only used as consumption fallback when no inventory records exist
- `ciclo_pedido_semanas()` auto-detects ordering frequency from order history (weekly/biweekly/monthly)
- `calcular_par_y_safety()` uses auto-detected cycle + supplier lead time for par/safety calculation
- Minimum safety stock = 2 days of consumption (prevents 0 when std_dev is 0)
- Recommendations persist in localStorage (24h), accumulate across submissions, always validated against today's backend data
- Sub-recipe costs displayed per kg/litro (not per g/ml) for readability

## Inventory Page Navigation

- **Never use `router.push()` for tab/vista switching** — causes Suspense freeze
- All in-page state (tab, vista, showRecomendaciones) uses local `useState`
- URL synced with `window.history.replaceState()` for deep linking
- `useRouter` removed entirely from inventario page

## Café Pivot Sorting

- Sub-category order: 1kg → 200g → 130g → Coffee Retail Bags → Tubos Frozen → Frozen → Cápsulas
- Within each size: sorted by color (MARRÓN → ROJO → GOLD → BLACK) via `grupo_ingrediente_id` with name fallback
- Color sub-headers: "1kg · MARRÓN", "200g · ROJO", "130g · GOLD" etc.
- Total rows (Café en grano, Retail color groups, Coffee Retail Bags) styled bold, sort LAST within their color group
- `coffeeColorOrder`/`coffeeColorName` fall through to name-based detection when `grupo_ingrediente_id` not in COLOR_ORDER
- Pivot auto-aggregates parent totals from children (`_child_ids` recursive for grandchildren)
- Retail color groups (325-328) are children of Coffee Retail Bags (279)

## Dabov Pricing

- EUR→CHF multiplier: **1.0891** (includes shipping + import)
- All 1kg, 200g, 130g bags and capsules have prices set
- Frozen tubes: use `coste_kg_frozen` + `suplemento_frozen` + `frozen_origen_id`, NOT `precio_compra`
- Pending: Frozen Nicaragua El Suspiro missing frozen pricing columns

## Ingredient Detail Page

- "Stock Actual" green box shows last inventory recording (quantity, unit, date)
- Alongside Lead Time, Ciclo Pedido, Consumo/Ciclo in 4-column grid

## Safety

- When changing ingredient `unidad_uso`, recipe lines are auto-updated to prevent silent cost breakage
- Never delete DB records without explicit user confirmation — list what will be lost, ask to confirm

## Backlog

- Price change impact simulator
- Automated cloud backups (Google Drive/Dropbox)
- Dish photos on recipes
- Printable recipe cards (PDF)
- Recipe version history
- Supplier comparison
- In-app AI invoice processing (Claude API)
