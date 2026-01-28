# 🌍 SLSC Needs Severity Toolset

A multi-country web tool for uploading, tagging, and managing numeric and categorical vulnerability datasets linked to admin boundaries. Supports multiple countries with country-specific data isolation.

**Note:** This is the new multi-country version, evolved from the original Philippines-only toolset.

Built with **Next.js 14 + Supabase + TailwindCSS**  
Deployed via **Vercel**

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- Supabase project (PostgreSQL)
- Vercel or local dev environment

### 2. Run locally (default: stable)

**Use `npm start` so the app runs reliably.** It builds then serves in production mode.

```bash
npm install
npm start
```

Wait for **"✓ Ready"**, then open **http://localhost:3000** and do a **hard refresh** (Cmd+Shift+R or Ctrl+Shift+R) the first time.

- **If you see 500s or "Something went wrong":** run `npm start` again, then hard-refresh. Avoid `npm run dev` for daily use; it is flaky with chunk loading.
- **If the port is stuck:** `lsof -ti:3000 | xargs kill -9` then `npm start`.
- **Hot reload (less stable):** `npm run dev` — only if you need it; use `npm start` if you see crashes.

---

### 3. Database Schema

Run the following SQL in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  admin_level INTEGER CHECK (admin_level BETWEEN 0 AND 3),
  type TEXT NOT NULL CHECK (type IN ('numeric', 'categorical')),
  indicator_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dataset_values_numeric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  value NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS public.dataset_values_categorical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE,
  admin_pcode TEXT NOT NULL,
  category TEXT NOT NULL,
  value NUMERIC
);
