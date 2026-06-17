# BigQuery Release Hub 🚀

An elegant, agent-friendly web application designed to monitor, filter, and share Google Cloud BigQuery release updates. Built using Python Flask and vanilla client-side technologies (HTML, CSS, JavaScript).

---

## 🌟 Features

* **Granular Feed Parsing**: Automatically parses Google's release notes feed and splits bundled daily updates into individual, category-coded cards (Feature, Announcement, Deprecation, Bug Fix, or Other).
* **Smart Server Caching**: Utilizes a 5-minute memory cache to ensure rapid load times and protect against API rate limits.
* **Instant Filters & Search**: Real-time client-side keyword search and category filter pills.
* **Twitter / X Web Integration**:
  - **Quick-Share**: One-click sharing for single release notes.
  - **Consolidated Thread Generation**: Select multiple cards to draft a combined summary.
  - **Accurate Character Counter**: Replaces hyperlinks with a dummy 23-character count to mirror X's actual link-shortening behavior and keep posts under the 280-character limit.
  - **Web Intent Redirection**: Pre-fills drafts and safely redirects to your browser's Twitter account session without requiring complex API integrations.

---

## 🛠️ Technology Stack

* **Server-side**: Python 3.13+, Flask
* **Client-side**: Vanilla HTML5, Vanilla CSS3 (Custom Properties, Flexbox, Glassmorphism, Animations), Vanilla JS (DOMParser, ES6 Fetch, Local State Management)
* **Fonts & Icons**: Outfit & Inter (Google Fonts), FontAwesome 6

---

## 📁 File Structure

```text
bigquery-release-notes/
│
├── app.py                 # Flask server, Atom XML parser, and caching logic
├── README.md              # Project documentation
├── .gitignore             # Git exclusion rules
│
├── templates/
│   └── index.html         # Main dashboard markup
│
└── static/
    ├── css/
    │   └── style.css      # Glassmorphic stylesheet and dark-theme tokens
    └── js/
        └── app.js         # DOM parser, state manager, filter engine, and composer
```

---

## 🚀 Getting Started

### Prerequisites
Make sure Python 3 is installed.

### 1. Install Dependencies
Install Flask (the project has no other external dependencies):
```bash
pip install flask
```

### 2. Run the Application
Start the Flask development server:
```bash
python app.py
```

### 3. Open in Browser
Visit the app locally at:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🔄 How the Data Flows

1. **Fetch**: The frontend triggers a fetch to `/api/release-notes` (or a force-refresh via `/api/release-notes/refresh`).
2. **Retrieve & Parse (Server)**: Flask requests the Google Cloud RSS feed, parses the Atom structure, caches the payload, and sends JSON back.
3. **Deconstruct (Client)**: `app.js` runs a `DOMParser` over the raw HTML entries, separating them at `<h3>` boundaries to isolate specific features or bug fixes.
4. **Render**: The dashboard populates a vertical timeline with selectable glass cards.
5. **Tweet**: Card selections compile a draft text block that gets passed to Twitter's web intent handler via browser redirection.
