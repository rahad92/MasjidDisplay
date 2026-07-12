# MasjidDisplay

A TV-friendly prayer-time dashboard for the Islamic Center of Delaware County.

The display:

- Fetches live Adhan times from AlAdhan
- Fetches live Iqamah times from the ICDC schedule API
- Calculates Maghrib Iqamah when the API specifies an offset
- Shows a live clock, Gregorian date, Hijri date, sunrise, Jumu'ah and announcements
- Highlights the next prayer
- Keeps the last successful schedule in browser storage for temporary outages
- Is optimized for a 16:9 television and GitHub Pages

## Run locally

Because the page loads JSON files, do not double-click `index.html`.

### VS Code Live Server

1. Install the **Live Server** extension.
2. Right-click `index.html`.
3. Select **Open with Live Server**.

### Python alternative

From the repository folder:

```bash
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

## Customize

Edit:

- `config/config.json` for mosque name, city, country, timezone and refresh interval.
- `data/announcements.json` for the scrolling messages.
- `css/style.css` for visual changes.

## Publish with GitHub Pages

1. Commit and push the project to GitHub.
2. Open the repository on GitHub.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Push to the `main` branch.

The included workflow deploys the site automatically.

Your URL should be:

```text
https://rahad92.github.io/MasjidDisplay/
```

## Fire TV

1. Open the published URL in Silk Browser or TV Bro.
2. Add it to bookmarks.
3. Use full-screen mode when available.
4. Disable the TV's screen saver or sleep timer if the display should remain visible.
5. For reliable unattended startup, consider a kiosk browser or a Raspberry Pi later.

## Data sources

- Iqamah: `https://icdc.skyhub.pk/api/v1/iqamah/get`
- Adhan: `https://api.aladhan.com/v1/timingsByCity`

Both endpoints returned cross-origin access headers in the supplied browser capture, so the GitHub Pages site can request them directly.

## Important

Verify the displayed calculation method and prayer times against the mosque's official schedule before placing the display into production.
