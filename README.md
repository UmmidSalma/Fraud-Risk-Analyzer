AI Fraud Detector Frontend

A dark, animated frontend dashboard for an AI-Based Real-Time Digital Payment Fraud & Risk Analyzer.

> Still under development — only the frontend is designed and developed at this stage.

## Project Structure

```
sentinel-kinetic/
├── index.html       — Main dashboard HTML
├── css/
│   └── style.css    — All styles, animations, responsive rules
├── js/
│   └── main.js      — Live counters, charts, scan logic, terminal
└── README.md
```

## How to Run

Just open `index.html` in any modern browser — no build step required.

```bash
# Option 1: Double-click index.html
# Option 2: Serve locally
npx serve .
# or
python -m http.server 8080
```

## Features

- **Engine Classification Panel** — Risk badge, confidence score, progress bar, mini deviation/score charts
- **Live Terminal Log** — Auto-scrolling system log with color-coded entries
- **Process Payment Button** — Triggers animated scan sweep + randomized risk assessment
- **4 Metric Cards** — Flagged count (live), Revenue at Risk, Neural Link Health, Detection Latency
- **AI Model Performance** — Animated progress bars for XGBoost, LSTM, Isolation Forest, Autoencoder
- **Fraud Probability Wheel** — SVG arc chart that updates on each scan
- **Global Threat Heatmap** — World map with color-coded risk nodes
- **7-Day Transaction Volume Chart** — Color-coded bar chart
- **System Health Panel** — CPU / Memory / Network I/O live bars
- **Live Clock & Status Bar** — Real-time UTC clock in footer

## Animations

| Animation | Trigger |
|-----------|---------|
| Glitch logo | Continuous (7s cycle) |
| Scan sweep | Click "PROCESS PAYMENT" |
| Bar chart grow | Page load (staggered) |
| Terminal scroll | Continuous loop |
| Status dot blink | Continuous |
| Flagged counter | Every 2.8s |
| CPU fluctuation | Every 2s |
| Latency ticker | Every 3.5s |
| TXN ID cycle | Every 3.5s |

## Connecting to Your ML Backend

In `js/main.js`, replace `window.runScan` with a real API call:

```js
window.runScan = async function() {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id: currentTxnId })
  });
  const data = await res.json();
  // data.risk_label, data.confidence, data.fraud_probability
  updateFraudWheel(data.fraud_probability);
  // ...
};
```

## Design System

| Token | Value |
|-------|-------|
| Neon accent | `#00f5c8` |
| Blue accent | `#00bfff` |
| Warning | `#ff6b35` |
| Danger | `#ff2d55` |
| Background | `#080d12` |
| Surface | `#0d1520` |
| Font (data) | Share Tech Mono |
| Font (UI) | Rajdhani |

## Minor Project Info

- **Project Title:** AI-Based Real-Time Digital Payment Fraud & Risk Analyzer
- **University:** KLE Technological University

