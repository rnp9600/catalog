# Patel Marketing — Wholesale Kitchenware Catalogue

262 products across 8 brands. Plain HTML/CSS/JS — no build step, no dependencies.

## Files
    index.html    the whole app
    data.json     all product data (this is your database)
    images/       one .jpg per product

## Run locally
Must be served over http — data.json is fetched, so double-clicking index.html will not work.

    cd site
    python3 -m http.server 8000
    # open http://localhost:8000

## Put it online — two options

### A. Drag and drop (30 seconds)
1. vercel.com/new
2. Drag this whole `site` folder onto the page
3. Framework preset: **Other**, no build command, output directory blank
4. Deploy

### B. GitHub (recommended — auto-redeploys on every change)
    cd site
    git init && git add . && git commit -m "Patel Marketing catalogue v1"
    git branch -M main
    git remote add origin https://github.com/<you>/patel-catalogue.git
    git push -u origin main
Then tell Claude the repo name and it can link and deploy it for you.

## Editing products
Everything lives in `data.json`. One object per product:

    {
      "img": "px_kadhai",           // must match images/px_kadhai.jpg
      "name": "Cast Iron Kadhai",
      "brand": "Paxton CI",
      "cat": "Cast Iron",           // becomes a filter chip
      "sub": "Kadhai",
      "desc": "Twin loop handles",
      "spec": "Pan 10-18 inch wide",
      "price": null,                // null = "Enquire"; a number = shown incl. GST
      "stock": "active",            // or "out"
      "feat": false,                // true = Featured badge
      "sizes": ["8 inch - 1.8 kg"], // optional expandable size/weight list
      "code": null,                 // supplier code, e.g. "MS 241"
      "hotel": null                 // hotel-size pans only
    }

To swap a photo: drop a better .jpg into images/ with the same filename. Nothing else changes.

## Views
Grid · Gallery · List · Compact, and four themes including Dark.
**Save as PDF** exports whatever is currently filtered, laid out as a printed catalogue.
