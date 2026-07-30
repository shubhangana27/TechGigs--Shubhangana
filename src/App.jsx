import React, { useState } from 'react';
import Login from './components/Login';

// Placeholder views
const StudentPortal = () => <h2>Student Portal</h2>;
const AdminPortal = () => <h2>Admin Portal</h2>;

export default function App() {
  // Store the current page state ('login', 'student-portal', or 'admin-portal')
  const [currentPage, setCurrentPage] = useState('login');

  return (
    <div>
      {currentPage === 'login' && (
        <Login onNavigate={(page) => setCurrentPage(page)} />
      )}
      {currentPage === 'student-portal' && <StudentPortal />}
      {currentPage === 'admin-portal' && <AdminPortal />}
    </div>
  );
}