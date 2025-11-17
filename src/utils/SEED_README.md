# Seed Data Management

## ⚠️ Important Security Notice

The `seed.ts` file currently contains **REAL business data** including:
- Real pricing information
- Real station locations and names  
- Real route schedules
- Real promo codes

## For GitHub Publication

Before publishing to GitHub, you have two options:

### Option 1: Replace with Demo Data (Recommended for Public Repos)

Modify `seed.ts` to contain only example/demo data:
- Replace real prices with rounded/example prices (e.g., 50 → 100, 75 → 150)
- Replace specific station names with generic examples
- Use demo promo codes (already done: DEMO10, SAMPLE20, EXAMPLE5)

### Option 2: Keep Real Data Private (Recommended for Production)

1. **Create `seed.production.ts`** with your real production data
2. **Keep `seed.ts`** with demo/example data only
3. The `.gitignore` already excludes `*.production.ts` files
4. Use `seed.production.ts` only in your production environment

## Usage

```bash
# For development/testing (uses seed.ts with demo data)
npm run seed

# For production (if you create seed.production.ts)
# You would need to create a separate script:
# npm run seed:production
```

## Current Status

- ✅ Promo codes: Already changed to demo codes (DEMO10, SAMPLE20, EXAMPLE5)
- ⚠️ Routes: Still contain real pricing and station data
- ✅ `.gitignore`: Already configured to exclude production seed files

## Next Steps

1. **For GitHub**: Modify route prices in `seed.ts` to be example values
2. **For Production**: Create `seed.production.ts` with real data (will be auto-ignored by git)

