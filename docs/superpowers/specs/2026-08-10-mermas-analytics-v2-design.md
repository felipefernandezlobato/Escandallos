# Mermas Analytics v2 — Interactive Dashboard

## Problem

The current analytics tab has no date range selection (always shows current period), charts are static (no drill-down), and there's no way to browse or search all waste records.

## Design

### Architecture

**Client-side filtering**: Fetch all records for the selected date range from `GET /api/mermas?fecha_desde=X&fecha_hasta=Y&limit=2000`, then do all filtering, charting, and drill-downs in JavaScript. No new backend endpoints needed. This gives instant click interactions with no loading spinners on drill-down.

### 1. Date Range Selector

A row at the top of the Analisis tab with quick preset buttons and two date inputs.

**Quick presets**: Esta semana, Este mes, Ultimo mes, Ultimo trimestre, Todo. Each auto-fills desde/hasta and triggers a re-fetch.

**Custom dates**: Two `<input type="date">` fields (Desde / Hasta) that override presets. Typing or picking a date triggers re-fetch.

**Default on load**: "Este mes".

The existing Dia/Semana/Mes toggle stays below — it controls the time chart bar grouping, independent of the date range.

### 2. Interactive Charts — Click to Filter

All three chart sections become clickable:

- **Time chart bar click**: filters everything to that time period (e.g., a specific week)
- **Category bar click**: filters to that ingredient category (e.g., "Fruta")
- **Motivo bar click**: filters to that motivo (e.g., "Roto")

**Filter chips** display above the charts showing active filters:
```
Filtros: [Semana: W32 ✕] [Categoria: Fruta ✕]   [Limpiar todos]
```

Behavior:
- Clicking ✕ on a chip removes that filter
- Filters stack (week + category + motivo can all be active)
- Clicking the same bar again deselects it
- Summary cards, all charts, and the records list update to reflect active filters
- Bars have hover cursor and highlight on click (active bar gets full opacity, others dim)

### 3. Records List

Replaces the current hardcoded Top 10 with two sections:

**Top Items table**: Shows all items (not just 10), sorted by cost descending. If more than 10, shows first 10 with a "Ver mas" button to expand.

**Full records table**: A sortable table of individual waste records matching the current date range + active chart filters.

Columns: Fecha, Item (with category tag), Cantidad + unidad, Motivo, Ubicacion, Coste.

Sortable by clicking column headers (toggles asc/desc). Default sort: newest first.

Shows 50 records at a time with "Ver mas" button to load the next 50.

When a chart bar is clicked, this table auto-filters to show matching records.

### Data Flow

```
Date Range (presets/custom)
    ↓
Fetch all records from API
    ↓
Store in state as `allRecords`
    ↓
Apply chart click filters (tiempo/categoria/motivo)
    ↓
`filteredRecords` drives:
  - Summary cards (count, cost, % change)
  - Time chart bars (grouped by dia/semana/mes)
  - Category bars
  - Motivo bars
  - Top items table
  - Full records list
```

### Files to Modify

- `frontend/src/app/mermas/page.tsx` — rewrite the Analisis tab section
- No backend changes needed (API already supports fecha_desde/fecha_hasta)

### No Changes To

- Registrar tab (untouched)
- Backend API endpoints
- Database schema
- Navigation
