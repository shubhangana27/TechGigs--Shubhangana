import React, { useState } from 'react';
import Login from './components/Login'; 

import StudentPortal from './components/StudentPortal';
import AdminPortal from './components/AdminPortal';

export default function App() {
  const [currentPage, setCurrentPage] = useState('login');
  
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