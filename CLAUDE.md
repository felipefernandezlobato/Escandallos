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
- SQLite database (file-based, no external database service)
- Manual backups via download from the app. No automated cloud backups in v1
- Price history is tracked: every ingredient price change is recorded with date and old/new values

## Tech Stack

- **Frontend:** Next.js (React) + Tailwind CSS — hosted on Vercel (free tier)
- **Backend:** FastAPI (Python) + SQLAlchemy — hosted on Render or Railway (free tier)
- **Database:** SQLite (file on the backend server)
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
- Data must be exportable (CSV) and backupable (SQLite file download)

## Project Structure

```
escandallos/
├── frontend/    # Next.js + Tailwind
├── backend/     # FastAPI + SQLite
├── PLAN.md      # Implementation plan and full design spec
└── CLAUDE.md    # This file — business rules and project context
```

## Backlog (not in v1)

- Price change impact simulator
- Automated cloud backups (Google Drive/Dropbox)
- Dish photos on recipes
- Printable recipe cards (PDF)
- Recipe version history
- Supplier comparison
- In-app AI invoice processing (Claude API)
- Multi-location support
