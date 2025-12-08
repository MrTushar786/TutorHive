# TutorHive platform

TutorHive is a production-ready full-stack learning marketplace that pairs an immersive React/Vite frontend with a secure Node.js + MongoDB backend. Students can discover tutors, book sessions in real time, and tutors get a unified workspace to manage their learners.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite, React Router, Three.js hero visuals |
| Backend | Node.js, Express, Mongoose, JWT auth, Zod validation |
| Database | MongoDB |
| Tooling | ESLint, Nodemon (API dev), Vite build pipeline |

## Prerequisites

- Node.js 20+
- npm 10+
- A running MongoDB instance (local or Atlas)

## Environment variables

Create the following files based on your environment.

### Frontend (`.env` in the project root)

```
VITE_API_URL=http://localhost:5000
```

### Backend (`server/.env`)

```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/tutorhive
JWT_SECRET=replace-this-with-a-strong-secret
CLIENT_URL=http://localhost:5173
```

## Installation

```bash
# Frontend deps
npm install

# Backend deps
cd server
npm install
```

## Database seed (optional but recommended)

The backend ships with a seeding utility that creates demo tutors, students, and bookings:

```bash
cd server
npm run seed
```

## Development workflow

Open two terminals:

```bash
# Terminal 1 – frontend
npm run dev

# Terminal 2 – backend
cd server
npm run dev
```

The frontend expects the API at `VITE_API_URL`, so keep both servers running.

## Production build

```bash
npm run build           # frontend build (outputs to dist/)
cd server && npm start  # run API in production mode
```

Serve the `/dist` folder through your static host (Netlify, Vercel, S3, etc.) and deploy `server/` to your Node platform of choice. Be sure to set the same environment variables in production.

## Testing & linting

```bash
npm run lint        # frontend lint
cd server && npm run dev  # API with Nodemon + ESLint on save
```

## Feature highlights

- Password-based auth with JWT + protected Express routes
- Student & tutor dashboards powered by live API data
- Session booking workflow backed by MongoDB
- 3D hero animations and fully responsive UI
- Shared loading/error states and secure route guards

Feel free to extend the API (e.g., messaging, payments) or plug in your own AI-driven tutor matching—everything is structured for easy iteration. Happy hacking! 🎓🐝
