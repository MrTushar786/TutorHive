import React from 'react';
import { Home, Zap, GraduationCap, Rocket } from 'lucide-react';
import '../css/App.css';

const MobileBottomNav = ({ activeSection, scrollToSection, handleStart }) => {
    const getColor = (isActive) => isActive ? '#FF6B35' : '#718096'; // Orange if active, Gray if not

    return (
        <div className="mobile-bottom-nav">
            <button
                className={`nav-item ${activeSection === 0 ? 'active' : ''}`}
                onClick={() => scrollToSection(0)}
            >
                <span className="nav-icon"><Home size={20} color={getColor(activeSection === 0)} /></span>
                <span className="nav-label">Home</span>
            </button>

            <button
                className={`nav-item ${activeSection === 1 ? 'active' : ''}`}
                onClick={() => scrollToSection(1)}
            >
                <span className="nav-icon"><Zap size={20} color={getColor(activeSection === 1)} /></span>
                <span className="nav-label">Features</span>
            </button>

            <button
                className={`nav-item ${activeSection === 2 ? 'active' : ''}`}
                onClick={() => scrollToSection(2)}
            >
                <span className="nav-icon"><GraduationCap size={20} color={getColor(activeSection === 2)} /></span>
                <span className="nav-label">Guide</span>
            </button>

            <button
                className="nav-item special"
                onClick={handleStart}
            >
                <span className="nav-icon"><Rocket size={20} color="white" /></span>
                <span className="nav-label">Get Started</span>
            </button>
        </div>
    );
};

export default MobileBottomNav;
