import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import './HomeScreen.css';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('student'); // 'student' or 'admin'
  const [idInput, setIdInput] = useState(''); // Registration Number or Admin ID
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanId = idInput.trim();

      // 1. Check if user exists in Firestore first
      const usersRef = collection(db, 'users');
      const fieldToSearch = activeTab === 'student' ? 'registrationNumber' : 'adminId';

      const q = query(
        usersRef,
        where(fieldToSearch, '==', cleanId),
        where('role', '==', activeTab)
      );

      const querySnapshot = await getDocs(q);

      // Block access if user is not in Firestore database
      if (querySnapshot.empty) {
        setError(`Access Denied: No registered ${activeTab} found with ID "${cleanId}".`);
        setLoading(false);
        return;
      }

      // Extract matching user data
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // 2. Authenticate with Firebase Auth using user's Firestore email & typed password
      const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);

      // 3. Store active session data in localStorage
      localStorage.setItem(
        'currentUser',
        JSON.stringify({
          uid: userCredential.user.uid,
          docId: userDoc.id,
          name: userData.name,
          registrationNumber: userData.registrationNumber || null,
          adminId: userData.adminId || null,
          role: userData.role,
          email: userData.email,
        })
      );

      // 4. Navigate to corresponding portal
      if (userData.role === 'student') {
        navigate('/student-portal');
      } else if (userData.role === 'admin') {
        navigate('/admin-portal');
      }

    } catch (err) {
      console.error('Login Error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect password. Please try again.');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="auth-card">
        <h2>Campus Grievance Portal</h2>
        <p className="subtitle">Maintenance & Redressal Tracking System</p>

        {/* Role Selection Tabs */}
        <div className="tab-group">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'student' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('student');
              setError('');
            }}
          >
            Student Login
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('admin');
              setError('');
            }}
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
              placeholder={activeTab === 'student' ? 'e.g. 24BAI10038' : 'e.g. ADMIN101'}
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
            {loading
              ? 'Verifying...'
              : `Login as ${activeTab === 'student' ? 'Student' : 'Admin'}`}
          </button>
        </form>
      </div>
    </div>
  );
}