# Dynamic Frozen Tubes Menu

## Context

The FROZEN TUBES section on the menu page is currently hardcoded in `menu-data.ts`. When coffees come and go (stock runs out, new orders arrive), someone has to manually update the code. The goal: make it fully automatic based on stock and pending orders.

## What triggers a frozen tube to appear on the menu

A frozen tube appears if ANY of these is true:
1. Has frozen tube stock > 0 in any location (BRU1 or BRU2)
2. The source bag (bolsa origen) has stock > 0
3. The source bag has a pending order (estado = 'borrador' or 'enviado')

## DB Changes

Add 3 nullable columns to `ingredientes`:
- `frozen_origen_id` (FK to self) — points frozen tube → source bag ingredient
- `suplemento_frozen` (float) — the +X CHF supplement for the menu
- `coste_kg_frozen` (float) — cost per kg in CHF for tube cost calculation (19g/tube)

Only frozen tube ingredients use these fields. Regular ingredients leave them NULL.

## Data to Create

**5 BD frozen tubes (under both BRU1 parent=289 and BRU2 parent=290):**
- Frozen BD Lord → origen: 200g BD Lord, supplement: +5, cost/kg: 49.40 * 0.935
- Frozen BD Lazo Bloom → origen: 200g BD Lazo Bloom, supplement: +5, cost/kg: 49.90 * 0.935
- Frozen BD Lalo → origen: 100g BD Lalo, supplement: +6, cost/kg: 56.60 * 0.935
- Frozen BD Meltic → origen: 100g BD Meltic, supplement: +11, cost/kg: 89.10 * 0.935
- Frozen BD Tennessee → origen: 100g BD Tennessee, supplement: +12, cost/kg: 91.00 * 0.935

**Link existing DABOV frozen tubes to their source bags:**
- Frozen COE Salvador → 130g DABOV COE Salvador
- Frozen COE Ethiopia → 130g DABOV COE Ethiopia
- Frozen Ethiopia Alo Mosto → 200g DABOV Ethiopia Alo Mosto
- Frozen Panama Lerida → 200g DABOV Panama Lerida
- Frozen Colombia Banana Fermentation → 200g DABOV Colombia Banana
- Frozen Costa Rica La Ortiga → 200g DABOV Costa Rica Thermal (same coffee, different name)
- Frozen Ethiopia Karamo → 200g DABOV Ethiopia Karamo
- Frozen Mexico La Perla → 200g DABOV Mexico La Perla
- Frozen Nicaragua El Suspiro → 200g DABOV Nicaragua El Suspiro

## API Endpoint

`GET /api/menu/frozen` (requires auth like other endpoints)

Returns array of:
```json
{
  "name": "DABOV COE Salvador",
  "chf_per_tube": 1.65,
  "supplement": 12,
  "multi_total": 9.6,
  "multi_supplement": 9.7
}
```

Logic:
1. Query all ingredients where `suplemento_frozen IS NOT NULL`
2. Group by coffee name (strip "Frozen " prefix and " Bru1"/" Bru2" suffix to deduplicate)
3. For each unique coffee, check visibility:
   - Sum frozen tube stock across all locations (both Bru1+Bru2 variants)
   - Check source bag stock via `frozen_origen_id` → `stock_actual()`
   - Check pending orders: any `lineas_pedido` for the source bag in orders with estado in ('borrador', 'enviado')
4. If visible, calculate CHF/tube from `coste_kg_frozen * 0.019`
5. Calculate multipliers using DOPPIO_PVP=3.90 and DOPPIO_COST=0.41

## Frontend Changes

**menu-data.ts:** Remove `FROZEN_TUBES` array and related constants (keep only `FROZEN_GRAMS_PER_TUBE`)

**page.tsx (menu):** 
- Fetch `/api/menu/frozen` on load
- Render the table from API data instead of hardcoded data
- Same table structure: Café, CHF/tubo, Supl., x Total, x Supl.
- If no frozen tubes available, hide the section entirely

## Constants

- Grams per tube: 19
- EUR→CHF: 0.935
- Doppio PVP: 3.90 CHF
- Doppio cost: 0.41 CHF

## Testing

1. BD coffees have pending order → should appear in menu
2. DABOV coffees with frozen stock → should appear
3. DABOV coffee with no stock and no bags → should NOT appear (e.g., Costa Rica La Ortiga if no stock)
4. Remove all stock and orders for a coffee → disappears from menu
5. Add stock back → reappears
