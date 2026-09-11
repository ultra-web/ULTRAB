# Benue Technology Registry & Compliance Platform

BTRCP is a browser-based prototype for Benue State technology licensing, device registration, compliance enforcement, public verification, warranty tracking, and account administration.

## Files

- `index.html` - application interface and modal markup
- `btrcp-app.js` - application logic and local browser storage

## Run locally

Open `index.html` in a modern browser. The application loads its frontend dependencies from public CDNs, so an internet connection is required for Tailwind CSS, Font Awesome, Chart.js, and JsBarcode.

Demo accounts:

- Master admin: `admin@bitda.gov` / `admin123`
- Company: `company@ultradigital.ng` / `company123`
- Customer: `customer@demo.ng` / `customer123`

## Notes

This is a frontend prototype. Data is stored in the browser's `localStorage`, and payment and notification integrations are simulated.
