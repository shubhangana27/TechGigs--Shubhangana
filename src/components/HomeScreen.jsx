import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import './HomeScreen.css';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('student'); // 'student' or 'admin'
  const [idInput, setIdInput] = useState(''); // Reg No or Admin ID
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Map RegNo / AdminID to an internal email format
      const email = `${idInput.trim().toLowerCase()}@campus.edu`;

      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Fetch role from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Ensure student isn't logging into admin tab or vice versa
        if (userData.role !== activeTab) {
          setError(`Unauthorized: This account is not a ${activeTab}.`);
          setLoading(false);
          return;
        }

        // Navigate based on role
        if (userData.role === 'student') {
          navigate('/student-portal');
        } else {
          navigate('/admin-portal');
        }
      } else {
        setError('User record not found in database.');
      }
    } catch (err) {
      setError('Invalid credentials. Please check your ID and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="auth-card">
        <h2>Campus Grievance Portal</h2>
        <p className="subtitle">Maintenance & Redressal Tracking System</p>

        {/* Tab Selection */}
        <div className="tab-group">
          <button
            className={`tab-btn ${activeTab === 'student' ? 'active' : ''}`}
            onClick={() => { setActiveTab('student'); setError(''); }}
          >
            Student Login
          </button>
          <button
            className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => { setActiveTab('admin'); setError(''); }}
          >
            Admin Login
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>
              {activeTab === 'student' ? 'Registration Number' : 'Admin ID'}
            </label>
            <input
              type="text"
              required
              placeholder={activeTab === 'student' ? 'e.g. 21BCE0123' : 'e.g. ADMIN101'}
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Logging in...' : `Login as ${activeTab === 'student' ? 'Student' : 'Admin'}`}
          </button>
        </form>
      </div>
    </div>
  );
}