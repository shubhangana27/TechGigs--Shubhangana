import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import './HomeScreen.css';

export default function Login({ onNavigate, setUser }) {
  const [activeTab, setActiveTab] = useState('student'); // 'student' or 'admin'
  const [idInput, setIdInput] = useState(''); // Reg No or Admin ID
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanId = idInput.trim();
      
      // Determine collection name and search field based on active tab
      const collectionName = activeTab === 'student' ? 'users' : 'admins';
      const searchField = activeTab === 'student' ? 'registrationNumber' : 'adminId';

      // 1. Query root-level collection directly using collection()
      const q = query(
        collection(db, collectionName),
        where(searchField, '==', cleanId)
      );

      const querySnapshot = await getDocs(q);

      // Check if user exists in Firestore
      if (querySnapshot.empty) {
        setError(`No ${activeTab} account found with ID "${cleanId}".`);
        setLoading(false);
        return;
      }

      // Extract user document
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Determine role (use document field if it exists, otherwise fallback to current tab)
      const userRole = userData.role || activeTab;

      // 2. Direct password check against Firestore document
      if (userData.password !== password) {
        setError('Incorrect password. Please try again.');
        setLoading(false);
        return;
      }

      // 3. Login success -> Save user data and switch page
      const loggedUser = { id: userDoc.id, ...userData, role: userRole };

      if (setUser) setUser(loggedUser);
      localStorage.setItem('currentUser', JSON.stringify(loggedUser));

      if (userRole === 'student') {
        onNavigate('student-portal');
      } else {
        onNavigate('admin-portal');
      }

    } catch (err) {
      console.error('Login Error:', err);
      setError('System error. Please check your Firestore rules or internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="auth-card">
        <h2>Campus Grievance Tracker</h2>
        <p className="subtitle">Select your portal to log in</p>

        {/* Tab Selection */}
        <div className="tab-group">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'student' ? 'active' : ''}`}
            onClick={() => { setActiveTab('student'); setError(''); }}
          >
            Student Login
          </button>
          <button
            type="button"
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
              placeholder={activeTab === 'student' ? 'e.g. 24BAI10038' : 'e.g. AAA1'}
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              required
              placeholder="Enter password"
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