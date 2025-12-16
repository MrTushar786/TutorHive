import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import '../css/Login.css';
import useAuth from '../hooks/useAuth';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState('student');
  const canvasRef = useRef(null);
  const navigate = useNavigate();
  const { user, login, register } = useAuth();
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState('idle');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    hourlyRate: '',
    expertise: '',
    availability: ''
  });

  useEffect(() => {
    if (user) {
      navigate(user.role === 'tutor' ? '/tutordashboard' : '/studentdashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // Three.js Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.position.z = 8;

    // Create simple floating books
    const createBook = (color) => {
      const geometry = new THREE.BoxGeometry(0.8, 1, 0.15);
      const material = new THREE.MeshPhongMaterial({
        color: color,
        flatShading: true
      });
      return new THREE.Mesh(geometry, material);
    };

    const colors = [0xFF6B35, 0x4A90E2, 0x9C27B0, 0xFFC107, 0x4CAF50];
    const books = [];

    for (let i = 0; i < 8; i++) {
      const book = createBook(colors[i % colors.length]);
      book.position.set(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 5 - 2
      );
      book.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      books.push({
        mesh: book,
        rotSpeed: (Math.random() - 0.5) * 0.02
      });
      scene.add(book);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xFF6B35, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      books.forEach((book, i) => {
        book.mesh.rotation.y += book.rotSpeed;
        book.mesh.position.y += Math.sin(elapsed + i) * 0.003;
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  const handleInputChange = (e) => {
    setFormError('');
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setStatus('loading');

    try {
      if (isLogin) {
        await login({
          email: formData.email,
          password: formData.password
        });
      } else {
        await register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          role: userType,
          hourlyRate: userType === 'tutor' && formData.hourlyRate ? Number(formData.hourlyRate) : undefined,
          expertise: userType === 'tutor' && formData.expertise
            ? formData.expertise.split(',').map((item) => item.trim()).filter(Boolean)
            : undefined,
          availability: userType === 'tutor' && formData.availability
            ? formData.availability.split(',').map((item) => item.trim()).filter(Boolean)
            : undefined
        });
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setStatus('idle');
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setFormError('');
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      hourlyRate: '',
      expertise: '',
      availability: ''
    });
  };





  return (
    <div className="auth-container">
      <canvas ref={canvasRef} className="auth-canvas" />

      <div className="auth-content">
        {/* Left Side - Branding */}
        <div className="auth-branding">
          <div className="brand-logo">
            <div className="logo-icon-large">🐝</div>
            <h1 className="brand-name">TutorHive</h1>
          </div>

          <div className="brand-tagline">
            <h2>Where Knowledge Meets Innovation</h2>
            <p>Join thousands of students and tutors building a smarter future together.</p>
          </div>

          <div className="auth-stats">
            <div className="stat-box">
              <div className="stat-number">50K+</div>
              <div className="stat-label">Active Students</div>
            </div>
            <div className="stat-box">
              <div className="stat-number">10K+</div>
              <div className="stat-label">Expert Tutors</div>
            </div>
            <div className="stat-box">
              <div className="stat-number">1M+</div>
              <div className="stat-label">Lessons Given</div>
            </div>
          </div>

          <div className="auth-features">
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>Instant tutor matching</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>Real-time feedback</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>Progress tracking</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span>24/7 availability</span>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="auth-form-container">
          <div className="auth-form-card">
            <div className="form-header">
              <h2>{isLogin ? 'Welcome Back!' : 'Create Account'}</h2>
              <p>{isLogin ? 'Sign in to continue your learning journey' : 'Start your journey with TutorHive today'}</p>
            </div>

            {/* User Type Selection */}
            {!isLogin && (
              <div className="user-type-selector">
                <button
                  className={`type-btn ${userType === 'student' ? 'active' : ''}`}
                  onClick={() => setUserType('student')}
                >
                  <span className="type-icon">📚</span>
                  <span>I'm a Student</span>
                </button>
                <button
                  className={`type-btn ${userType === 'tutor' ? 'active' : ''}`}
                  onClick={() => setUserType('tutor')}
                >
                  <span className="type-icon">👨‍🏫</span>
                  <span>I'm a Tutor</span>
                </button>
              </div>
            )}



            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="auth-form">
              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="name">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              )}

              {!isLogin && userType === 'tutor' && (
                <>
                  <div className="form-group">
                    <label htmlFor="hourlyRate">Hourly Rate (USD)</label>
                    <input
                      type="number"
                      id="hourlyRate"
                      name="hourlyRate"
                      min="10"
                      max="200"
                      value={formData.hourlyRate}
                      onChange={handleInputChange}
                      placeholder="e.g. 45"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="expertise">Expertise (comma separated)</label>
                    <input
                      type="text"
                      id="expertise"
                      name="expertise"
                      value={formData.expertise}
                      onChange={handleInputChange}
                      placeholder="Calculus, Algebra, Geometry"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="availability">Availability (comma separated)</label>
                    <input
                      type="text"
                      id="availability"
                      name="availability"
                      value={formData.availability}
                      onChange={handleInputChange}
                      placeholder="Mon-Fri, Evening"
                      required
                    />
                  </div>
                </>
              )}

              {isLogin && (
                <div className="form-extras">
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    <span>Remember me</span>
                  </label>
                  <a href="#" className="forgot-password">Forgot Password?</a>
                </div>
              )}

              {!isLogin && (
                <label className="checkbox-label terms">
                  <input type="checkbox" required />
                  <span>I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></span>
                </label>
              )}

              {formError && (
                <div className="form-error" role="alert">
                  {formError}
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={status === 'loading'}>
                {status === 'loading' ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button onClick={toggleAuthMode} className="toggle-btn">
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          </div>

          <div className="back-home">
            <a href="/">← Back to Home</a>
          </div>
        </div>
      </div>
    </div>
  );
};