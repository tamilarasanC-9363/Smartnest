# SmartNest AI — Real Estate Intelligence Platform

> **Find a home that fits your life.** Deterministic AI lifestyle compatibility scoring, side-by-side comparison, intelligent wishlist price tracking, and Razorpay-powered subscriptions.

---

## 📁 Project Architecture & Directory Structure

The project is cleanly separated into two core domains: **Frontend** and **Backend**.

```text
SmartNest/
├── frontend/                          # Client-side React 18 Application
│   ├── src/                           # Source code (Components, Pages, Contexts, Services)
│   │   ├── components/                # UI widgets, layout primitives, subscription modals
│   │   ├── context/                   # React State Contexts (Auth, Compare, Messaging, Toast)
│   │   ├── pages/                     # Public, Buyer, Seller, and Admin portal routes
│   │   ├── services/                  # Client API abstraction, intelligence workflows, mock store
│   │   ├── App.jsx                    # Application route tree
│   │   ├── index.css                  # Global design tokens and styles
│   │   └── main.jsx                   # Vite entry point
│   ├── public/                        # Static assets & public dataset
│   ├── dist/                          # Production distribution build
│   ├── index.html                     # HTML root template
│   ├── package.json                   # Frontend package manifest
│   ├── vite.config.js                 # Vite bundler configuration (port 5173, host: true)
│   └── vercel.json                    # Single-Page-Application rewrite rules
│
├── backend/                           # Server-Side APIs, Database & Verification
│   ├── server/                        # Express 4 Payment & Subscription Gateway
│   │   ├── .env                       # Backend environment configuration
│   │   ├── .env.example               # Template environment configuration
│   │   ├── package.json               # Backend dependencies (express, cors, dotenv)
│   │   ├── paymentController.js       # Subscription checkout, verification, and webhooks
│   │   ├── razorpayClient.js          # Razorpay SDK initialization & signature verification
│   │   └── server.js                  # Express microservice entry point (port 5000)
│   ├── smartnest_properties.csv       # Coimbatore real estate master dataset
│   ├── supabase_schema.sql            # PostgreSQL / Supabase DDL schema & RLS policies
│   └── test-api.js                    # End-to-end verification and testing suite
│
├── docs/                              # Project Documentation
│   └── PAYMENT_GATEWAY_INTEGRATION.md # Razorpay & subscription architecture specification
│
├── node_modules/                      # Shared root dependencies
├── .gitattributes                     # Git line ending configuration
├── package-lock.json                  # Locked dependency manifest
├── package.json                       # Root script orchestrator
└── README.md                          # Project documentation
```

---

## 🚀 Quick Start

### 1. Run the Frontend (Vite Dev Server)
From the project root:
```bash
npm run dev
```
- **Local URL:** [http://localhost:5173/](http://localhost:5173/)
- **Network URL:** Exposed on LAN (`host: true`)

*(Alternatively, run `npm run dev` directly from inside the `frontend/` directory).*

### 2. Run the Backend (Payment Gateway Server)
From the project root:
```bash
npm run server
```
- **Local URL:** [http://localhost:5000/](http://localhost:5000/)
- **Health Check:** `GET http://localhost:5000/api/health`

*(Or run `npm start` inside `backend/server/`).*

### 3. Run the Verification Test Suite
From the project root:
```bash
npm test
```
Verifies role authentication, lifestyle compatibility scoring (Test 1), AI property comparison (Test 2), explainable matching (Test 3), and wishlist price alerts with deduplication (Test 4).

### 4. Build for Production
From the project root:
```bash
npm run build
```

---

## 🔑 Mode Switching (Demo vs Live)
- **Demo Mode (Default):** Runs an in-memory client-side simulated backend with simulated latency (300ms). Perfect for zero-configuration testing and grading.
- **Live Mode:** Connects to an external REST backend configured via `VITE_SMARTNEST_API_URL` in `frontend/.env`.
