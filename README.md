# TutorHive

A modern, full-stack tutoring platform connecting students with educators for seamless learning experiences, scheduling, and real-time collaboration.

## Key Features

- **Role-Based Dashboards:** Dedicated interfaces for Students (gamified progress, booking) and Tutors (analytics, schedule management).
- **Real-Time Communication:** Integrated instant messaging and video calling features powered by Socket.IO.
- **Smart Booking System:** Seamless session scheduling with status tracking (Upcoming, Completed, Cancelled).
- **Interactive UI:** engaging user experience with 3D elements (Three.js) and smooth animations (Framer Motion).
- **Secure Authentication:** Robust user verification and session management.
- **Mobile-First Design:** Fully responsive layout optimized for all devices.

## Tech Stack

**Frontend**
- React 19
- Vite
- Framer Motion & Three.js (R3F)
- Lucide React (Icons)
- Vanilla CSS / Modern Layouts

**Backend**
- Node.js & Express
- MongoDB (Mongoose)
- Socket.IO (Real-time events)
- JSON Web Tokens (Auth)

## Folder Structure

```
TutorHive/
├── src/                # Frontend React application
│   ├── components/     # Reusable UI components
│   ├── pages/          # Application routes/pages
│   ├── student/        # Student-specific dashboard logic
│   ├── tutor/          # Tutor-specific dashboard logic
│   └── css/            # Global styles
├── server/             # Backend API
│   ├── src/
│   │   ├── controllers/# Route controllers
│   │   ├── models/     # Database schemas
│   │   └── routes/     # API endpoints
│   └── app.js          # Entry point
└── public/             # Static assets
```

## Setup & Installation

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/tutorhive.git
cd tutorhive
```

**2. Setup Backend**
```bash
cd server
npm install
# Create .env file (see Environment Variables)
npm run dev
```

**3. Setup Frontend**
```bash
# In a new terminal, go to root
cd ..
npm install
npm run dev
```

## Environment Variables

Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:5173
```

Create a `.env` file in the root (`frontend`) directory:
```env
VITE_API_URL=http://localhost:5000/api
```

## How to Run

1.  Start the **Backend Server**: `npm run dev` (inside `/server`)
2.  Start the **Frontend Client**: `npm run dev` (inside root)
3.  Open `http://localhost:5173` in your browser.

## Future Improvements

-   **AI Matching:** Smart algorithms to recommend tutors based on learning style.
-   **Payment Integration:** Stripe/PayPal integration for secure transaction handling.
-   **Mobile App:** React Native mobile application for on-the-go access.

## License

MIT
