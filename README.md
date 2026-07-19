# 📍 Sales Street Kit

A mobile-first PWA that helps street-working salespeople find **toilets, work spaces, charging points, and rated premium toilets** nearby in Hong Kong.

## Features

- 🚻 **Toilets** — Public toilets across 18 districts
- 💺 **Work Spaces** — Libraries, community centres, co-working spots
- 🔋 **Charging** — Power bank rental, USB charging stations
- ⭐ **Premium Toilets** — Rated high-quality toilets in shopping malls
- 🗺️ **Interactive Map** — Leaflet + OpenStreetMap
- 📍 **Location** — Find nearby places sorted by distance
- 🔍 **Search** — Filter by keyword, district, free/paid
- 🧭 **Navigation** — Direct Google Maps integration
- 📱 **PWA** — Installable, works offline
- 📝 **Community Reports** — Submit new locations via Supabase

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Vanilla JS + HTML + CSS |
| Map | Leaflet 1.9.4 + OpenStreetMap |
| Data | Static JSON files |
| Backend | Supabase (report feature) |
| PWA | Service Worker + manifest |
| Auto-update | GitHub Actions + Node.js |
| Map PNG | Python + Pillow |

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/sales-street-app.git
cd sales-street-app

# Start local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

## Project Structure

```
sales-street-app/
├── index.html              # Main HTML
├── css/style.css           # Styles
├── js/
│   ├── app.js              # Core logic
│   └── config.js           # Supabase config
├── data/                   # Static JSON data
│   ├── toilets.json
│   ├── freespace.json
│   ├── charging.json
│   └── premium_toilets.json
├── icons/                  # PWA icons + map PNG
├── scripts/                # Data scraping scripts
├── supabase/schema.sql     # Database schema
└── .github/workflows/      # Auto-update workflow
```

## Data Sources

- **Toilets**: FEHD (Food and Environmental Hygiene Department) Open Data
- **Free Spaces**: LCSD (Leisure and Cultural Services Department), Home Affairs
- **Charging**: Various charging station operators
- **Premium Toilets**: Curated database with LLM-estimated ratings

## Community Reports

Users can submit new locations via the report feature (FAB button). Reports are stored in Supabase and require admin approval before appearing in the app.

### Setup Supabase

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run the SQL in `supabase/schema.sql`
4. Add your `SUPABASE_URL` and `SUPABASE_ANON_KEY` to `js/config.js`

## Auto-Update

The GitHub Action runs weekly to fetch the latest FEHD toilet data. See `.github/workflows/update-toilets.yml`.

## License

MIT
