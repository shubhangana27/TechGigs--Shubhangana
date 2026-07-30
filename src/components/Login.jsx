import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import '../styles/Auth.css';

export default function Login() {
  const [role, setRole] = useState('student'); // 'student' or 'admin'
  const [identifier, setIdentifier] = useState(''); // Reg Number or Admin ID
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Map Reg No or Admin ID to a internal email format for Firebase Auth
    // e.g., 21BCE100 -> 21bce100@student.campus.com
    // e.g., ADM01 -> adm01@admin.campus.com
    const formattedEmail = role === 'student'
      ? `${identifier.trim().toLowerCase()}@student.campus.com`
      : `${identifier.trim().toLowerCase()}@admin.campus.com`;

    try {
      await signInWithEmailAndPassword(auth, formattedEmail, password);
      if (role === 'student') {
        navigate('/student-portal');
      } else {
        navigate('/admin-portal');
      }
    } catch (err) {
      setError('Invalid credentials. Please check your details and try again.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Campus Grievance Tracker</h1>
          <p>Select your portal to log in</p>
        </div>

        {/* Role Toggle Switch */}
        <div className="tab-container">
          <button
            className={`tab-btn ${role === 'student' ? 'active' : ''}`}
            onClick={() => { setRole('student'); setError(''); }}
          >
            Student Login
          </button>
          <button
            className={`tab-btn ${role === 'admin' ? 'active' : ''}`}
            onClick={() => { setRole('admin'); setError(''); }}
          >
            Admin Login
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>
              {role === 'student' ? 'Registration Number' : 'Admin ID'}
            </label>
            <input
              type="text"
              placeholder={role === 'student' ? 'e.g. 21BCE1024' : 'e.g. ADM101'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="submit-btn">
            Login as {role === 'student' ? 'Student' : 'Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}