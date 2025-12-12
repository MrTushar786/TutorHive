# TutorHive Platform

TutorHive is a comprehensive, production-ready learning marketplace that connects students with expert tutors. It combines a modern, immersive React/Vite frontend with a robust Node.js + MongoDB backend, featuring advanced real-time capabilities for messaging and video calls.

## 🚀 Features

- **User Authentication**: Secure JWT-based authentication for Students and Tutors.
- **Dynamic Dashboards**: Personalized dashboards for students to manage bookings and for tutors to manage their classes.
- **Real-time Messaging**: Instant messaging system between students and tutors using WebSockets (`/ws/messages`).
- **Video Calling**: Enterprise-grade video conferencing with WebRTC and Socket.IO (`/bridge`), supporting screen sharing and peer-to-peer connection.
- **Booking System**: Complete workflow for scheduling, confirming, and managing tutoring sessions.
- **Search & Discovery**: Find tutors by subject, availability, and rating.
- **Responsive Design**: Fully responsive UI providing a seamless experience across desktop and mobile devices.

## 🛠 Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Vanilla CSS (Custom Glassmorphism Design System)
- **Routing**: React Router 7
- **Visuals**: Three.js (@react-three/fiber) for 3D hero elements
- **State/Data**: Context API + Custom Hooks

### Backend
- **Runtime**: Node.js + Express
- **Database**: MongoDB (Mongoose ODM)
- **Real-time**: 
  - **Native WebSockets (`ws`)**: For text messaging.
  - **Socket.IO**: For video call signaling and rooms.
- **Security**: Helmet, CORS, JWT-based Route Protection
- **Validation**: Zod + Custom Middleware

## 📋 Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **MongoDB**: Local instance running on port 27017 or a MongoDB Atlas URI.

## ⚙️ Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd TutorHive1
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    npm install
    ```

3.  **Install Backend Dependencies:**
    ```bash
    cd server
    npm install
    cd ..
    ```

## 🔧 Configuration

Create environment configuration files in the appropriate directories.

### Frontend (`.env`)
Create a `.env` file in the root directory:
```env
VITE_API_URL=http://localhost:5000
```
*Note: If testing on a mobile device on the same network, change `localhost` to your PC's local IP address.*

### Backend (`server/.env`)
Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/tutorhive
JWT_SECRET=your_super_secure_jwt_secret_key_here
CLIENT_URL=http://localhost:5173,http://192.168.1.X:5173
```
*Note: Add your local IP to `CLIENT_URL` to allow CORS requests from mobile devices.*

## 🏃‍♂️ Running the Application

To run the full stack (frontend + backend), you will need two terminal windows.

### 1. Start the Backend Server
This runs the API, WebSocket server, and Socket.IO signaling server.
```bash
cd server
npm run dev
```
*Server runs on port 5000.*

### 2. Start the Frontend Development Server
The frontend is configured to run with host access enabled, allowing other devices on the network to connect.
```bash
npm run dev
```
*Frontend runs on http://localhost:5173 (and your local network IP).*

## 📱 Testing on Mobile / Network

1.  Find your computer's local IP address (e.g., `192.168.1.5`).
2.  Update `VITE_API_URL` in the **frontend** `.env` to this IP: `http://192.168.1.5:5000`.
3.  Update `CLIENT_URL` in the **backend** `server/.env` to include your frontend IP: `http://192.168.1.5:5173`.
4.  Restart both servers.
5.  Open `http://192.168.1.5:5173` on your mobile browser.

## 💾 Database Seeding

To verify the app with sample data (mock tutors, students, and bookings):

```bash
cd server
npm run seed
```

## 📂 Project Structure

```
TutorHive1/
├── public/              # Static assets
├── src/
│   ├── api/             # API client functions
│   ├── auth/            # Auth pages (Login/Signup)
│   ├── components/      # Reusable UI components (Messaging, VideoCall, etc.)
│   ├── context/         # React Contexts (Auth, Data)
│   ├── hooks/           # Custom React Hooks
│   ├── pages/           # Main Page Views
│   ├── server/          # Backend Source Code
│   │   ├── config/      # DB Connection
│   │   ├── controllers/ # Route Logic
│   │   ├── models/      # Mongoose Schemas
│   │   ├── routes/      # efficient Express Routes
│   │   ├── websocket/   # WebSocket & Socket.IO Handlers
│   │   └── server.js    # Entry Point
│   └── utils/           # Helper functions & Socket Clients
└── package.json         # Project Dependencies
```

## 🤝 Contributing

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---
Happy Hacking! 🎓🐝
