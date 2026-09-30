# Workspace Radar AI ⚡🏢
### Autonomous Commercial Lead Intelligence & Scraping Brain for Flexible Workspaces

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4.0-38B2AC.svg)](https://tailwindcss.com/)
[![Gemini](https://img.shields.io/badge/Google%20GenAI-Gemini%203.8%20Flash-orange.svg)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Workspace Radar AI** is a production-grade commercial lead intelligence and prospecting engine tailored for flexible workspace operators, coworking hub managers, and commercial real estate brokers.

It autonomously discovers real enterprise candidates across the open web, scores their propensity for coworking and shared office space, extracts verified decision-maker contacts, and renders interactive animatic market analytics.

---

## 🌟 Key Features

### 1. 🧠 Gemini 3.8 Flash Autonomous Lead Intelligence
- Dynamically discovers real enterprises across any target city (Mumbai, Bangalore, Pune, Hyderabad, Delhi NCR, etc.) and commercial niche.
- **Truthful Data Guarantee**: Strictly prohibits fabricated dummy phone numbers or guessed emails. Legitimate unverified contacts are explicitly labeled as `Missing` rather than presenting faulty data.

### 2. 🛡️ Per-Data-Point Confidence Scores & Visual Badges
- Every scraped attribute displays an explicit confidence score and verification channel:
  - **Corporate Email**: e.g., `95% certainty` · *Corporate Domain MX & Live HTTP Scraping*
  - **Direct Phone**: e.g., `94% certainty` · *Commercial Telecom Registry & Live Scraping*
  - **Decision Maker**: e.g., `96% certainty` · *LinkedIn Leadership & MCA Corporate Registry*
  - **Commercial Address**: e.g., `98% certainty` · *Google Maps Commercial Footprint & ROC Filing*
  - **Website Domain**: e.g., `99% certainty` · *Active SSL Certificate & Live DNS Resolution*
- High-confidence verified data ($\ge 90\%$) is marked with green verified shields, while pattern-inferred data ($< 90\%$) is badged in amber.

### 3. 📊 Animatic Market Analytics & Visual Telemetry
- **Propensity Histogram**: Dynamic animated gradient bars with interactive hover counts and click-to-filter capability.
- **Sector Breakdown Donut Chart**: Multi-segment SVG ring with stroke-dash animations, percentage labels, and interactive legend.
- **Commercial Submarket Density Radar**: Spatial clustering across core commercial business districts (e.g., BKC, Andheri East, Lower Parel).
- **Seat Demand Forecasting**: Projected flexible desk capacity breakdown and monthly commercial leasing value calculation.

### 4. 🌐 Live HTTP Web Scraper & URL Inspector
- Real-time backend scraper that fetches and inspects any live URL to extract verified emails, telephone numbers, and leadership profiles with zero external API dependencies.

### 5. 📑 Executive Multi-Format Exports
- **Colorful Multi-Sheet Excel (`.xlsx`)**: Formatted master prospects sheet with auto-filtered columns + executive KPI summary dashboard.
- **Landscape PDF Executive Report**: Styled grid with zebra striping, priority color tags, and pagination.
- **RFC 4180 CSV Export**: Universal spreadsheet compatibility.

### 6. ⚡ CRM Webhook Synchronization
- Export-ready data formatting and one-click push simulation for **HubSpot** and **Salesforce** with copy-ready CSV payloads.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion
- **Backend / API**: Express 4, Vite middleware in development, Node.js static asset server in production
- **AI Engine**: `@google/genai` TypeScript SDK (model: `gemini-3.8-flash`)
- **Export Engines**: `xlsx` (SheetJS), `jspdf`, `jspdf-autotable`
- **Reliability**: React `ErrorBoundary` layer for zero-crash stability, graceful fallbacks when offline or without API keys

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Node.js 18.0 or higher
- npm 9.0 or higher

### 1. Clone the repository
```bash
git clone https://github.com/your-username/workspace-radar-ai.git
cd workspace-radar-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root directory (or copy from `.env.example`):
```bash
cp .env.example .env
```

Add your Gemini API Key:
```env
GEMINI_API_KEY="your-gemini-api-key-here"
PORT=3000
```
> *Note: If no API key is provided, the application automatically operates using its built-in verified commercial catalog and live HTTP web scraper.*

### 4. Start the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Production Build & Deployment

### Production Build
```bash
npm run build
```
This generates the optimized static bundle in `dist/`.

### Run in Production
```bash
npm start
```
Runs the Express server which serves the static `dist/` bundle on port `3000` (or `process.env.PORT`).

---

## 🚢 Deployment Recipes

### Deploy to Render / Railway / Cloud Run
1. Connect your GitHub repository.
2. Set Build Command: `npm run build`
3. Set Start Command: `npm start`
4. Add Environment Variable:
   - `GEMINI_API_KEY` = your Gemini API key
   - `NODE_ENV` = `production`

### Deploy to Vercel
1. Import repository on Vercel.
2. Framework Preset: **Vite**
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Add Environment Variable `GEMINI_API_KEY` in Project Settings.

---

## 🔒 Data Privacy & Integrity

- **Zero-Storage Logging**: No customer PII or scraped telemetry is permanently logged or shared.
- **Rate-Limited Scraper**: Built-in batch chunking (concurrency of 4) to respect target website servers and prevent IP blocks.
- **Truthful Missing Protocol**: Incomplete records are transparently designated as `Missing` rather than fabricated.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
