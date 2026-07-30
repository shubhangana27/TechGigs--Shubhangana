import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';

// Placeholder views for next steps
const StudentPortal = () => <h2>Student Portal</h2>;
const AdminPortal = () => <h2>Admin Portal</h2>;

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/student-portal" element={<StudentPortal />} />
        <Route path="/admin-portal" element={<AdminPortal />} />
      </Routes>
    </Router>
  );
}