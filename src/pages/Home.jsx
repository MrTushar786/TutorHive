import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import '../css/App.css';
import { useNavigate } from 'react-router-dom';
import MobileBottomNav from '../component/MobileBottomNav';

export default function Home() {
  const canvasRef = useRef(null);
  const [activeSection, setActiveSection] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsLoaded(true));

    // Three.js Scene Setup with Better Educational 3D Models
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const isMobile = window.innerWidth <= 768;
    camera.position.z = isMobile ? 18 : 12; // Move camera back on mobile


    // Create Pencil
    const createPencil = () => {
      const group = new THREE.Group();

      // Wooden body
      const bodyGeom = new THREE.CylinderGeometry(0.15, 0.15, 2.5, 6);
      const bodyMat = new THREE.MeshPhongMaterial({
        color: 0xFFD700,
        flatShading: true
      });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.rotation.z = Math.PI / 2;
      group.add(body);

      // Tip
      const tipGeom = new THREE.ConeGeometry(0.15, 0.4, 6);
      const tipMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
      const tip = new THREE.Mesh(tipGeom, tipMat);
      tip.rotation.z = -Math.PI / 2;
      tip.position.x = 1.45;
      group.add(tip);

      // Eraser
      const eraserGeom = new THREE.CylinderGeometry(0.17, 0.17, 0.3, 6);
      const eraserMat = new THREE.MeshPhongMaterial({ color: 0xFF69B4 });
      const eraser = new THREE.Mesh(eraserGeom, eraserMat);
      eraser.rotation.z = Math.PI / 2;
      eraser.position.x = -1.35;
      group.add(eraser);

      return group;
    };

    // Create Book Stack
    const createBookStack = () => {
      const group = new THREE.Group();
      const colors = [0xFF6B35, 0x4A90E2, 0x9C27B0];

      for (let i = 0; i < 3; i++) {
        const bookGeom = new THREE.BoxGeometry(1.2, 0.3, 1.6);
        const bookMat = new THREE.MeshPhongMaterial({
          color: colors[i],
          flatShading: true
        });
        const book = new THREE.Mesh(bookGeom, bookMat);
        book.position.y = i * 0.32 - 0.3;
        book.rotation.y = (Math.random() - 0.5) * 0.3;
        group.add(book);
      }

      return group;
    };

    // Create Apple (Teacher's desk classic)
    const createApple = () => {
      const group = new THREE.Group();

      // Apple body
      const appleGeom = new THREE.SphereGeometry(0.5, 32, 32);
      const appleMat = new THREE.MeshPhongMaterial({
        color: 0xFF0000,
        shininess: 100
      });
      const apple = new THREE.Mesh(appleGeom, appleMat);
      apple.scale.y = 0.9;
      group.add(apple);

      // Stem
      const stemGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
      const stemMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
      const stem = new THREE.Mesh(stemGeom, stemMat);
      stem.position.y = 0.6;
      group.add(stem);

      // Leaf
      const leafGeom = new THREE.CircleGeometry(0.2, 8);
      const leafMat = new THREE.MeshPhongMaterial({
        color: 0x228B22,
        side: THREE.DoubleSide
      });
      const leaf = new THREE.Mesh(leafGeom, leafMat);
      leaf.position.set(0.15, 0.65, 0);
      leaf.rotation.y = Math.PI / 4;
      group.add(leaf);

      return group;
    };

    // Create Diploma Roll
    const createDiploma = () => {
      const group = new THREE.Group();

      // Paper roll
      const rollGeom = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 32);
      const rollMat = new THREE.MeshPhongMaterial({
        color: 0xFFFACD,
        shininess: 30
      });
      const roll = new THREE.Mesh(rollGeom, rollMat);
      group.add(roll);

      // Ribbon
      const ribbonGeom = new THREE.TorusGeometry(0.25, 0.05, 16, 32);
      const ribbonMat = new THREE.MeshPhongMaterial({ color: 0xFF6B35 });
      const ribbon = new THREE.Mesh(ribbonGeom, ribbonMat);
      ribbon.rotation.x = Math.PI / 2;
      group.add(ribbon);

      return group;
    };

    // Create Atom (Science/Knowledge symbol)
    const createAtom = () => {
      const group = new THREE.Group();

      // Nucleus
      const nucleusGeom = new THREE.SphereGeometry(0.25, 32, 32);
      const nucleusMat = new THREE.MeshPhongMaterial({
        color: 0xFFD700,
        emissive: 0xFFD700,
        emissiveIntensity: 0.3
      });
      const nucleus = new THREE.Mesh(nucleusGeom, nucleusMat);
      group.add(nucleus);

      // Electron orbits
      const orbitGeom = new THREE.TorusGeometry(1, 0.03, 16, 100);
      const orbitMat = new THREE.MeshPhongMaterial({
        color: 0x4A90E2,
        transparent: true,
        opacity: 0.7
      });

      for (let i = 0; i < 3; i++) {
        const orbit = new THREE.Mesh(orbitGeom, orbitMat);
        orbit.rotation.x = (Math.PI / 3) * i;
        orbit.rotation.y = (Math.PI / 4) * i;
        group.add(orbit);

        // Electrons
        const electronGeom = new THREE.SphereGeometry(0.1, 16, 16);
        const electronMat = new THREE.MeshPhongMaterial({
          color: 0x00D4FF,
          emissive: 0x00D4FF,
          emissiveIntensity: 0.5
        });
        const electron = new THREE.Mesh(electronGeom, electronMat);
        electron.position.x = 1;
        orbit.add(electron);
      }

      return group;
    };

    const floatingObjects = [];
    const objectTypes = [createPencil, createBookStack, createApple, createDiploma, createAtom];

    // Reduce objects on mobile for clarity and performance
    const objectCount = isMobile ? 6 : 12;

    for (let i = 0; i < objectCount; i++) {
      const createFunc = objectTypes[i % objectTypes.length];
      const obj = createFunc();

      // Better positioning - avoid center
      const angle = (i / 12) * Math.PI * 2;
      const radius = 8 + Math.random() * 4;

      obj.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8 - 3
      );

      obj.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const scale = 0.6 + Math.random() * 0.6;
      obj.scale.set(scale, scale, scale);

      floatingObjects.push({
        mesh: obj,
        speedX: (Math.random() - 0.5) * 0.005,
        speedY: (Math.random() - 0.5) * 0.005,
        rotSpeedX: (Math.random() - 0.5) * 0.01,
        rotSpeedY: (Math.random() - 0.5) * 0.01,
        rotSpeedZ: (Math.random() - 0.5) * 0.01,
        initialX: obj.position.x,
        initialY: obj.position.y
      });
      scene.add(obj);
    }

    // Enhanced Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, -5, 3);
    scene.add(fillLight);

    const accentLight = new THREE.PointLight(0xFF6B35, 1);
    accentLight.position.set(0, 0, 8);
    scene.add(accentLight);

    // Animation
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // Smooth mouse movement
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      floatingObjects.forEach((obj, index) => {
        // Rotation
        obj.mesh.rotation.x += obj.rotSpeedX;
        obj.mesh.rotation.y += obj.rotSpeedY;
        obj.mesh.rotation.z += obj.rotSpeedZ;

        // Floating motion
        obj.mesh.position.x = obj.initialX + Math.sin(elapsed * 0.5 + index) * 0.5;
        obj.mesh.position.y = obj.initialY + Math.cos(elapsed * 0.7 + index) * 0.5;

        // Subtle mouse interaction - much less aggressive
        obj.mesh.position.x += mouseX * 0.3;
        obj.mesh.position.y += mouseY * 0.3;
      });

      // Rotate accent light
      accentLight.position.x = Math.sin(elapsed * 0.5) * 5;
      accentLight.position.z = Math.cos(elapsed * 0.5) * 5 + 3;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const isMobileNow = window.innerWidth <= 768;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      camera.position.z = isMobileNow ? 18 : 12;
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      // Cleanup Three.js resources
      scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionIndex = parseInt(entry.target.dataset.section);
            setActiveSection(sectionIndex);
            entry.target.classList.add('section-visible');
          }
        });
      },
      { threshold: 0.3 }
    );

    const sections = document.querySelectorAll('.scroll-section');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (index) => {
    const section = document.querySelector(`[data-section="${index}"]`);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const navigate = useNavigate();
  function handleStart() {
    navigate('/auth');
  }
  return (
    <div className="landing-container">
      <canvas ref={canvasRef} className="webgl-canvas" />

      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-content">
          <div className="logo-container">
            <div className="logo-icon">🐝</div>
            <div className="logo">TutorHive</div>
          </div>
          <div className="nav-links">
            <button onClick={() => scrollToSection(0)} className={activeSection === 0 ? 'active' : ''}>Home</button>
            <button onClick={() => scrollToSection(1)} className={activeSection === 1 ? 'active' : ''}>Features</button>
            <button onClick={() => scrollToSection(2)} className={activeSection === 2 ? 'active' : ''}>How It Works</button>
            <button onClick={() => scrollToSection(3)} className={activeSection === 3 ? 'active' : ''}>Get Started</button>
          </div>
        </div>
      </nav>

      <div className="scroll-container">
        {/* Hero Section */}
        <section className={`scroll-section hero-section ${isLoaded ? 'loaded' : ''}`} data-section="0">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">✨</span>
              <span>Your Learning Journey Starts Here</span>
            </div>

            <h1 className="hero-title">
              Welcome to <span className="brand-highlight">TutorHive</span>
              <br />
              <span className="hero-subtitle-inline">Where Knowledge Meets Innovation</span>
            </h1>

            <p className="hero-description">
              Connect with expert tutors instantly. Get real-time feedback.
              <br />Transform your learning experience with our AI-powered platform.
            </p>

            <div className="hero-cta-group">
              <button onClick={() => handleStart()} className="hero-cta-button primary">
                <span>Start Learning Now</span>
                <span className="cta-icon">→</span>
              </button>
              <button onClick={() => scrollToSection(2)} className="hero-cta-button secondary">
                <span className="play-icon">▶</span>
                <span>See How It Works</span>
              </button>
            </div>

            <div className="hero-visual-cards">
              <div className="visual-card student-card">
                <div className="card-icon">📚</div>
                <div className="card-title">For Students</div>
                <div className="card-stats">
                  <div className="stat-item">
                    <div className="stat-value">50K+</div>
                    <div className="stat-label">Active Learners</div>
                  </div>
                  <div className="rating-display">
                    <span className="stars">⭐⭐⭐⭐⭐</span>
                    <span className="rating-text">4.9/5.0</span>
                  </div>
                </div>
              </div>

              <div className="visual-card tutor-card">
                <div className="card-icon">👨‍🏫</div>
                <div className="card-title">For Tutors</div>
                <div className="card-stats">
                  <div className="stat-item">
                    <div className="stat-value">10K+</div>
                    <div className="stat-label">Expert Tutors</div>
                  </div>
                  <div className="growth-badge">
                    <span className="growth-icon">📈</span>
                    <span className="growth-text">+20% Performance</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="trust-badges">
              <div className="trust-item">
                <div className="trust-number">1M+</div>
                <div className="trust-text">Lessons Completed</div>
              </div>
              <div className="trust-divider"></div>
              <div className="trust-item">
                <div className="trust-number">95%</div>
                <div className="trust-text">Success Rate</div>
              </div>
              <div className="trust-divider"></div>
              <div className="trust-item">
                <div className="trust-number">24/7</div>
                <div className="trust-text">Support Available</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="scroll-section features-section" data-section="1">
          <div className="section-header">
            <h2 className="section-title">
              <span className="title-icon">⚡</span>
              Why Choose TutorHive
            </h2>
            <p className="section-description">
              Experience the future of learning with cutting-edge features designed for your success
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card highlight">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">🚀</div>
              </div>
              <h3>Instant Connect</h3>
              <p>Match with the perfect tutor in seconds using our AI-powered recommendation engine.</p>
              <div className="feature-badge">Most Popular</div>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">🎯</div>
              </div>
              <h3>Smart Matching</h3>
              <p>Our intelligent algorithm finds tutors that match your learning style and goals.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">📊</div>
              </div>
              <h3>Progress Tracking</h3>
              <p>Visualize your improvement with detailed analytics and personalized insights.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">⏰</div>
              </div>
              <h3>Flexible Scheduling</h3>
              <p>Book sessions anytime, anywhere. Learn at your own pace with 24/7 availability.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">💬</div>
              </div>
              <h3>Live Feedback</h3>
              <p>Get instant, actionable feedback during sessions to accelerate your learning.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <div className="feature-icon">🏆</div>
              </div>
              <h3>Achievement System</h3>
              <p>Earn badges and rewards as you progress. Stay motivated with gamification.</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="scroll-section how-it-works-section" data-section="2">
          <div className="section-header">
            <h2 className="section-title">
              <span className="title-icon">🎓</span>
              Your Learning Journey in 4 Simple Steps
            </h2>
            <p className="section-description">
              From signup to success - we've made it incredibly easy
            </p>
          </div>

          <div className="steps-timeline">
            <div className="step-card">
              <div className="step-number-wrapper">
                <div className="step-number">1</div>
                <div className="step-pulse"></div>
              </div>
              <div className="step-content">
                <h3>Create Your Profile</h3>
                <p>Tell us about your goals, subjects, and learning preferences. Takes less than 2 minutes!</p>
                <div className="step-icon">📝</div>
              </div>
            </div>

            <div className="timeline-connector"></div>

            <div className="step-card">
              <div className="step-number-wrapper">
                <div className="step-number">2</div>
                <div className="step-pulse"></div>
              </div>
              <div className="step-content">
                <h3>Find Perfect Match</h3>
                <p>Browse expert tutors or let our AI recommend the best matches for your needs.</p>
                <div className="step-icon">🔍</div>
              </div>
            </div>

            <div className="timeline-connector"></div>

            <div className="step-card">
              <div className="step-number-wrapper">
                <div className="step-number">3</div>
                <div className="step-pulse"></div>
              </div>
              <div className="step-content">
                <h3>Book & Learn</h3>
                <p>Schedule sessions at your convenience and start learning with real-time interaction.</p>
                <div className="step-icon">📅</div>
              </div>
            </div>

            <div className="timeline-connector"></div>

            <div className="step-card">
              <div className="step-number-wrapper">
                <div className="step-number">4</div>
                <div className="step-pulse"></div>
              </div>
              <div className="step-content">
                <h3>Track Success</h3>
                <p>Monitor your progress, earn achievements, and watch your skills grow exponentially.</p>
                <div className="step-icon">🎉</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="scroll-section cta-section" data-section="3">
          <div className="cta-content">
            <div className="cta-icon-large">🐝</div>
            <h2 className="cta-title">Ready to Join the TutorHive?</h2>
            <p className="cta-text">
              Join thousands of students and tutors building a smarter future together.
              <br />Start your learning journey today - it's free to get started!
            </p>

            <div className="cta-buttons">
              <button className="btn-primary" onClick={handleStart}>
                Get Started Free
                <span className="btn-arrow">→</span>
              </button>
              {/* <button className="btn-secondary">
                <span className="btn-icon">📞</span>
                Talk to Us
              </button> */}
            </div>

            <div className="cta-guarantees">
              <div className="guarantee-item">
                <span className="guarantee-icon">✓</span>
                <span>No Credit Card Required</span>
              </div>
              <div className="guarantee-item">
                <span className="guarantee-icon">✓</span>
                <span>Cancel Anytime</span>
              </div>
              <div className="guarantee-item">
                <span className="guarantee-icon">✓</span>
                <span>Money-Back Guarantee</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Scroll Indicator */}
      <div className="scroll-indicator">
        {[0, 1, 2, 3].map((i) => (
          <button
            key={i}
            className={`scroll-dot ${activeSection === i ? 'active' : ''}`}
            onClick={() => scrollToSection(i)}
            aria-label={`Go to section ${i + 1}`}
          />
        ))}
      </div>
      <MobileBottomNav
        activeSection={activeSection}
        scrollToSection={scrollToSection}
        handleStart={handleStart}
      />
    </div>
  );
};