# Renovation

> **Note:** This project was fully created by AI.

A web-based project management application for planning and tracking home renovation projects. It provides integrated tools for organizing tasks, managing finances, scheduling events, and maintaining notes — all in one place.

## Features

- **Tasks** — Create and manage tasks with subtasks, assignees, date ranges, and dependencies. Visualize your project timeline with a built-in Gantt chart.
- **Finance** — Track renovation expenses, manage invoices (paper or Google Drive), flag items for loan coverage, set a budget, and view spending breakdowns with pie charts.
- **Calendar** — Schedule events such as contractor visits, deliveries, and your own work sessions. Supports drag-and-drop rescheduling and multi-day events.
- **Notes** — Write and organize notes using a full-featured Markdown editor with GitHub Flavored Markdown support.
- **Backup & Restore** — Export all data to a compressed JSON file and restore it at any time.
- **Dark mode** — Automatically follows your system preference.

## Tech Stack

- [React](https://react.dev/) 19 + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — build tool and dev server
- [React Router](https://reactrouter.com/) — client-side routing
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling
- [Recharts](https://recharts.org/) — charts and data visualization
- [react-big-calendar](https://github.com/jquense/react-big-calendar) — calendar with drag-and-drop
- [@uiw/react-md-editor](https://uiwjs.github.io/react-md-editor/) — Markdown editing
- [date-fns](https://date-fns.org/) — date utilities
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) — unit testing

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [Yarn](https://yarnpkg.com/)

### Installation

```bash
yarn install
```

### Development

```bash
yarn dev
```

The app will be available at `http://localhost:5173`.

## Available Scripts

| Script | Description |
|---|---|
| `yarn dev` | Start the development server |
| `yarn build` | Type-check and build for production |
| `yarn preview` | Preview the production build locally |
| `yarn lint` | Run ESLint |
| `yarn lint:fix` | Run ESLint and auto-fix issues |
| `yarn test` | Run the test suite once |
| `yarn test:watch` | Run tests in watch mode |
| `yarn test:coverage` | Run tests and generate a coverage report |

## Project Structure

```
src/
├── components/     # Shared UI components
├── contexts/       # Global state (AppContext with localStorage persistence)
├── hooks/          # Custom React hooks
├── pages/
│   ├── Calendar/   # Event scheduling
│   ├── Finance/    # Expense tracking
│   ├── Notes/      # Markdown notes
│   └── Tasks/      # Task management & Gantt chart
├── types/          # TypeScript type definitions
└── utils/          # Formatting, compression, and report helpers
```

## Deployment

The project is configured for deployment on [Vercel](https://vercel.com/). A `vercel.json` file is included that rewrites all routes to `index.html` for proper SPA routing.

## Google Drive Storage (optional)

By default the app stores all project data locally in the browser (OPFS / localStorage). To enable **Google Drive** as an alternative storage back-end, follow the steps below.

### 1 – Create a Google Cloud project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or reuse an existing one).
2. In **APIs & Services → Library**, enable the **Google Drive API**.

### 2 – Configure the OAuth consent screen

1. In **APIs & Services → OAuth consent screen**, choose **External** (or **Internal** for a G Suite domain).
2. Fill in the required fields (app name, support e-mail, etc.).
3. Add the scope `https://www.googleapis.com/auth/drive.appdata`.
4. Add your own e-mail address as a **test user** while the app is in _Testing_ mode.

### 3 – Create an OAuth 2.0 client ID

1. Go to **APIs & Services → Credentials** and click **Create credentials → OAuth client ID**.
2. Select **Web application** as the application type.
3. Under **Authorised JavaScript origins**, add every URL the app will be served from, for example:
   - `http://localhost:5173` (local dev)
   - `https://<your-project>.vercel.app` (production)
4. Leave **Authorised redirect URIs** empty (the implicit / token flow does not use redirects).
5. Copy the **Client ID** that is shown.

### 4 – Set the environment variable

| Variable | Description |
|---|---|
| `VITE_STORAGE_GDRIVE_CLIENT_ID` | The OAuth 2.0 Client ID from step 3 |

**Local development** – create a `.env.local` file in the repo root:

```env
VITE_STORAGE_GDRIVE_CLIENT_ID=YOUR_CLIENT_ID_HERE
```

**Vercel deployment** – add the variable in **Project Settings → Environment Variables**.

### How it works

When `VITE_STORAGE_GDRIVE_CLIENT_ID` is set, the app shows a storage-selection modal on every load (the choice is never persisted). Selecting **Google Drive** triggers a Google sign-in popup via the [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/overview) token model and requests the `drive.appdata` scope. Project files are stored in the special [appdata folder](https://developers.google.com/drive/api/guides/appdata) which is invisible to the user in the Drive UI. The OAuth access token is kept only in memory and is never written to `localStorage` or any other browser storage.