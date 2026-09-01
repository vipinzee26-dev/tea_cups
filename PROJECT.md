# Project: Tea & Refreshment Office Tracker App

Build a responsive, modern single-page web application using **React (Vite + TypeScript + Tailwind CSS)** with **Lucide React** icons and **Firebase Firestore** for serverless database storage.

Deployable directly on **Vercel** on the 100% free Spark tier (no billing, payment cards, or paid subscriptions required).

---

## 1. Core Architecture & Tech Stack

- **Framework:** React 18+ (Vite, TypeScript, Tailwind CSS, Lucide React).
- **Database/Backend:** Firebase Web SDK v10+ (`firebase/firestore`, `firebase/app`).
  - Configuration file `src/lib/firebase.ts` reading from Vite environment variables:
    - `VITE_FIREBASE_API_KEY`
    - `VITE_FIREBASE_AUTH_DOMAIN`
    - `VITE_FIREBASE_PROJECT_ID`
    - `VITE_FIREBASE_STORAGE_BUCKET`
    - `VITE_FIREBASE_MESSAGING_SENDER_ID`
    - `VITE_FIREBASE_APP_ID`
- **Styling:** Clean, mobile-friendly Tailwind CSS layout with quick data entry fields, responsive tables, modal dialogs, and a month selector.
- **Reporting:**
  - One-click **"Copy WhatsApp Format"** clipboard button.
  - One-click **"Print / Save PDF"** via `@react-to-print` or CSS print stylesheets (`window.print()`).

---

## 2. Firestore Data Model & Initial Seed Setup

Create a initialization script/service `src/services/firebaseService.ts` structuring Firestore collections:

### Firestore Collections Structure

1. **`vendors` Collection:**
   - Document ID: `morning-ramakrishna`
     ```json
     {
       "id": "morning-ramakrishna",
       "name": "Ramakrishna",
       "shift": "Morning",
       "isActive": true,
       "items": [
         { "id": "coffee", "name": "Coffee", "price": 13, "isActive": true },
         { "id": "tea", "name": "Tea", "price": 12, "isActive": true },
         { "id": "biscuits", "name": "Biscuits", "price": 6, "isActive": true }
       ]
     }
     ```
   - Document ID: `evening-kumar`
     ```json
     {
       "id": "evening-kumar",
       "name": "Kumar",
       "shift": "Evening",
       "isActive": true,
       "items": [
         { "id": "coffee", "name": "Coffee", "price": 13, "isActive": true },
         { "id": "tea", "name": "Tea", "price": 12, "isActive": true },
         { "id": "biscuits", "name": "Biscuits", "price": 6, "isActive": true }
       ]
     }
     ```

2. **`daily_entries` Collection:**
   - Document ID format: `{YYYY-MM-DD}_{vendorId}` (e.g., `2026-08-03_morning-ramakrishna`)
   - Document Structure:
     ```json
     {
       "date": "2026-08-03",
       "vendorId": "morning-ramakrishna",
       "items": {
         "coffee": { "quantity": 16, "unitPrice": 13, "subtotal": 208 },
         "tea": { "quantity": 3, "unitPrice": 12, "subtotal": 36 },
         "biscuits": { "quantity": 8, "unitPrice": 6, "subtotal": 48 }
       },
       "totalAmount": 292,
       "notes": "",
       "updatedAt": "2026-08-03T10:00:00Z"
     }
     ```

---

## 3. Features & Requirements

### A. Vendor & Supplement / Snack Management

- Support the two primary vendors:
  - **Morning Vendor:** Ramakrishna
  - **Evening Vendor:** Kumar
- Provide UI to add, edit, or remove vendors.
- Per-vendor item pricing:
  - Adjust rates independently for each vendor.
  - Add snacks or supplementary items dynamically (e.g., Samosa @ ₹15, Puff @ ₹20) for specific vendors.

### B. Daily Entry & Calendar / Monthly View

- Select **Month & Year** (defaults to the current month).
- Switch seamlessly between **Morning Shift (Ramakrishna)** and **Evening Shift (Kumar)** tabs.
- **Monthly Grid Table:**
  - Auto-generate every calendar day of the selected month (1st to the last day).
  - Direct numeric count inputs for Coffee, Tea, Biscuits, and additional snacks.
  - Days with no entries display `0` across all items and `0` total.
  - Automated row calculation: $\sum(\text{Quantity} \times \text{Unit Price})$.
  - Top summary cards showing:
    - **Total Coffee**
    - **Total Tea**
    - **Total Biscuits**
    - **Total Snacks**
    - **Grand Total (₹)**

### C. WhatsApp Export Generator

Include a **"Copy for WhatsApp"** button that formats and copies markdown directly to the clipboard:

```text
*📊 DAILY BREAKDOWN (1-31 AUGUST)*
*Vendor: Ramakrishna (Morning)*

*Date* | *Coffee* | *Tea* | *Biscuits* | *Total*
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
1-August-2026: 0 | 0 | 0 | *0*
2-August-2026: 0 | 0 | 0 | *0*
3-August-2026: 16 ☕ | 3 🍵 | 8 🍪 | *292*
...
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
*📈 MONTH TOTALS*
• *Total Tea:* 40 🍵
• *Total Coffee:* 267 ☕
• *Total Biscuits:* 94 🍪
• *Grand Total:* *₹4,515*
```
