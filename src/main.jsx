import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./AppRouter";
import { AuthProvider } from "./context/AuthProvider";


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </React.StrictMode>
);
