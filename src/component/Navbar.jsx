import { Link } from "react-router-dom";
import "../css/Navbar.css";

export default function Navbar() {
  return (
    <>
    {/* ===================================================================================== */}

      <nav className="navbar" aria-label="Main navigation">
        <div className="navbar-left">
          <img src="/home-education.png" alt="TutorHive logo" width={30} height={30} />
          <h2>TutorHive</h2>
        </div>

        <div className="navbar-right">
          <Link to="/">Home</Link>
          <Link to="/about">About Us</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/faq">FAQ</Link>
          <Link to="/login" className="login">Login</Link>
          
        </div>
      </nav>

    {/* ===================================================================================== */}
    </>
  );
}
