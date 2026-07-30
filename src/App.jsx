import React, { useState } from 'react';
import Login from './components/Login'; // or HomeScreen depending on your file name

// Placeholders for now — we will build these next!
import StudentPortal from './components/StudentPortal';
import AdminPortal from './components/AdminPortal';

export default function App() {
  // Store page state ('login', 'student-portal', or 'admin-portal')
  const [currentPage, setCurrentPage] = useState('login');
  
  // Store logged-in user data
  const [user, setUser] = useState(null);

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('login');
  };

  return (
    <div>
      {currentPage === 'login' && (
        <Login 
          onNavigate={(page) => setCurrentPage(page)} 
          setUser={(userData) => setUser(userData)} 
        />
      )}

      {currentPage === 'student-portal' && (
        <StudentPortal user={user} onLogout={handleLogout} />
      )}

      {currentPage === 'admin-portal' && (
        <AdminPortal user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}