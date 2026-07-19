# Build Guide

## Prerequisites

- Python 3.8+ (for local server and map script)
- Node.js 18+ (for scraping scripts)
- GitHub account (for deployment)

## Local Development

### 1. Start Local Server

```bash
cd sales-street-app
python3 -m http.server 8000
```

Open http://localhost:8000 in your browser.

### 2. Test All Features

- [ ] 4 tabs switch correctly
- [ ] Map loads with markers
- [ ] Search filters work
- [ ] District dropdown populates
- [ ] Geolocation prompt appears
- [ ] Google Maps buttons work
- [ ] Report modal opens

### 3. Validate Data

```bash
# Check JSON files are valid
cat data/toilets.json | python3 -m json.tool
cat data/freespace.json | python3 -m json.tool
cat data/charging.json | python3 -m json.tool
cat data/premium_toilets.json | python3 -m json.tool
```

## Data Scraping

### Update Toilet Data

```bash
node scripts/build-toilets.mjs
```

### Update Free Space Data

```bash
node scripts/scrape-freespace.mjs
```

### Update Charging Data

```bash
node scripts/scrape-charging.mjs
```

### Update Premium Toilet Data

```bash
node scripts/scrape-premium.mjs
```

### Generate Map PNG

```bash
pip install Pillow
python3 scripts/make_map_pil.py
```

## Deployment to GitHub Pages

### 1. Create GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/sales-street-app.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: main, folder: / (root)
4. Save

### 3. Enable Actions Permissions

1. Go to repository Settings → Actions → General
2. Workflow permissions: Read and write permissions
3. Save

## Supabase Setup

### 1. Create Account

1. Go to https://supabase.com
2. Sign up with GitHub
3. Create new project

### 2. Create Table

1. Go to SQL Editor
2. Paste contents of `supabase/schema.sql`
3. Run

### 3. Configure Keys

Edit `js/config.js`:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

## PWA Testing

### Chrome DevTools

1. Open Chrome DevTools
2. Go to Application tab
3. Check "Service Workers" section
4. Check "Manifest" section

### Install PWA

1. Open the app in Chrome (mobile or desktop)
2. Click "Install" in the address bar
3. Or use the browser menu → "Install app"

## Troubleshooting

### "Failed to fetch" Error

- Make sure you're using http:// or https:// (not file://)
- Check browser console for CORS errors

### Map Not Loading

- Check internet connection
- OpenStreetMap tiles require HTTPS in production

### Geolocation Not Working

- Requires HTTPS (except localhost)
- Check browser permissions

### Chinese Characters Not Rendering

- Ensure you're using a CJK font
- Check CSS font-family includes "PingFang HK" or "Noto Sans HK"
