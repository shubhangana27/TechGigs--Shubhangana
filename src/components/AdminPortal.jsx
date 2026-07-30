import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import './AdminPortal.css';

export default function AdminPortal({ adminUser, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time listener for all tickets
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tickets'), (snapshot) => {
      const fetched = snapshot.docs.map((d) => {
        const data = d.data();
        const now = new Date();
        const due = new Date(data.dueDate);
        const isBreached = data.status !== 'Resolved' && due < now;

        return {
          id: d.id,
          ...data,
          isEscalated: isBreached || data.isEscalated
        };
      });

      // Sort: Escalated & unresolved first, then newest
      fetched.sort((a, b) => {
        if (a.isEscalated && !b.isEscalated) return -1;
        if (!a.isEscalated && b.isEscalated) return 1;
        return new Date(b.createdAt?.toDate ? b.createdAt.toDate() : 0) - new Date(a.createdAt?.toDate ? a.createdAt.toDate() : 0);
      });

      setTickets(fetched);
    });

    return () => unsubscribe();
  }, []);

  // Update ticket status in Firestore
  const handleStatusChange = async (ticketDocId, newStatus) => {
    try {
      const ticketRef = doc(db, 'tickets', ticketDocId);
      await updateDoc(ticketRef, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Could not update status. Please try again.');
    }
  };

  // Compute live SLA indicator
  const renderSLA = (dueDateStr, status) => {
    if (status === 'Resolved') {
      return <span className="badge badge-success">Closed</span>;
    }

    const now = new Date();
    const due = new Date(dueDateStr);
    const diffMs = due - now;

    if (diffMs <= 0) {
      return <span className="badge badge-escalated">⚠️ ESCALATED (SLA Breached)</span>;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return <span className="badge badge-active">⏱️ {hours}h {mins}m remaining</span>;
  };

  // Filter queue items
  const filteredTickets = tickets.filter((t) => {
    const matchCategory = categoryFilter === 'All' || t.category === categoryFilter;
    const matchStatus = statusFilter === 'All' || 
                         (statusFilter === 'Escalated' ? t.isEscalated : t.status === statusFilter);
    const matchSearch = t.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        t.studentRegistration.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        t.studentName.toLowerCase().includes(searchTerm.toLowerCase());

    return matchCategory && matchStatus && matchSearch;
  });

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <h2>Campus Admin Dashboard — Maintenance Queue</h2>
          <p>Logged in as: <strong>{adminUser?.adminId || 'Administrator'}</strong></p>
        </div>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </header>

      {/* Filter Toolbar */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Filter Category:</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="All">All Categories</option>
            <option value="Electricity">Electricity</option>
            <option value="Plumbing">Plumbing</option>
            <option value="Carpentry">Carpentry</option>
            <option value="Internet">Internet/Wi-Fi</option>
            <option value="Cleaning">Cleaning</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Filter Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Unresolved">Unresolved</option>
            <option value="In Progress">In Progress</option>
            <option value="Resolved">Resolved</option>
            <option value="Escalated">⚠️ Escalated Only</option>
          </select>
        </div>

        <div className="filter-group search-group">
          <input 
            type="text" 
            placeholder="Search Ticket ID or Reg No..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Queue Table */}
      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Date</th>
              <th>Block / Room</th>
              <th>Student Info</th>
              <th>Category & Description</th>
              <th>Photo Proof</th>
              <th>SLA Status</th>
              <th>Action / Change Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-records">No grievances match current filters.</td>
              </tr>
            ) : (
              filteredTickets.map((t) => (
                <tr key={t.id} className={t.isEscalated && t.status !== 'Resolved' ? 'row-escalated' : ''}>
                  <td>
                    <span className="ticket-badge">{t.ticketId}</span>
                  </td>
                  <td>
                    {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 'N/A'}
                  </td>
                  <td>
                    <strong>{t.hostelBlock}</strong><br />
                    <small>Room {t.roomNumber}</small>
                  </td>
                  <td>
                    <div><strong>{t.studentName}</strong></div>
                    <small className="text-muted">{t.studentRegistration}</small>
                  </td>
                  <td>
                    <span className="category-pill">{t.category}</span>
                    <p className="table-desc">{t.description}</p>
                  </td>
                  <td>
                    {t.photoUrl ? (
                      <a href={t.photoUrl} target="_blank" rel="noreferrer" className="photo-link">
                        🖼️ View Photo
                      </a>
                    ) : (
                      <span className="text-muted">No Attachment</span>
                    )}
                  </td>
                  <td>{renderSLA(t.dueDate, t.status)}</td>
                  <td>
                    <select 
                      className={`status-select ${t.status.toLowerCase().replace(' ', '-')}`}
                      value={t.status}
                      onChange={(e) => handleStatusChange(t.id, e.target.value)}
                    >
                      <option value="Unresolved">Unresolved</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}