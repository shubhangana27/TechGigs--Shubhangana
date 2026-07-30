import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import './AdminPortal.css';

// Pastel Category Styles Configuration (Matches Student Portal)
const CATEGORY_STYLES = {
  Electricity: { bg: '#fef9c3', color: '#854d0e', border: '#fde047' },       // Soft Pastel Yellow
  Plumbing: { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },          // Soft Pastel Blue
  Carpentry: { bg: '#f5ebe0', color: '#78350f', border: '#e6ccb2' },         // Soft Light Brown / Beige
  'Internet/Wi-Fi': { bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' },  // Soft Pastel Purple
  Internet: { bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' },          // Fallback support for Internet
  Cleaning: { bg: '#dcfce7', color: '#15803d', border: '#86efac' }           // Soft Pastel Green
};

export default function AdminPortal({ adminUser, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal / Scheduling state
  const [activeTicket, setActiveTicket] = useState(null);
  const [visitTime, setVisitTime] = useState('');
  const [adminRemarkInput, setAdminRemarkInput] = useState('');

  // Real-time listener for all tickets
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tickets'), (snapshot) => {
      const now = new Date();

      const fetched = snapshot.docs.map((d) => {
        const data = d.data();
        const due = new Date(data.dueDate);
        const diffMs = due - now;

        const isBreached = data.status !== 'Resolved' && diffMs <= 0;
        const isUrgent = data.status !== 'Resolved' && diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000;

        return {
          id: d.id,
          ...data,
          isEscalated: isBreached || data.isEscalated,
          isUrgent
        };
      });

      // AI-Enhanced Priority & Escalation Sorting
      fetched.sort((a, b) => {
        const aIsResolved = a.status === 'Resolved';
        const bIsResolved = b.status === 'Resolved';

        // 1. Move resolved tickets to the bottom
        if (!aIsResolved && bIsResolved) return -1;
        if (aIsResolved && !bIsResolved) return 1;

        if (aIsResolved && bIsResolved) {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return dateB - dateA;
        }

        // 2. SLA Escalated tickets go straight to top
        if (a.isEscalated && !b.isEscalated) return -1;
        if (!a.isEscalated && b.isEscalated) return 1;

        // 3. AI Urgency Score Sorting (Higher score = Top priority: 5 down to 1)
        const scoreA = a.urgencyScore || 3;
        const scoreB = b.urgencyScore || 3;
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }

        // 4. SLA Urgent time window check
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;

        // 5. Fallback to submission timestamp (Oldest first)
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateA - dateB;
      });

      setTickets(fetched);
    });

    return () => unsubscribe();
  }, []);

  // Propose or Update Visit Time from Admin side
  const handleSetVisitSchedule = async () => {
    if (!visitTime) {
      alert('Please choose a date and time for the visit.');
      return;
    }

    try {
      const ticketRef = doc(db, 'tickets', activeTicket.id);
      const formattedVisit = new Date(visitTime).toLocaleString();
      
      const newRemark = adminRemarkInput 
        ? `[Admin Log]: Scheduled visit for ${formattedVisit}. Note: ${adminRemarkInput}`
        : `[Admin Log]: Scheduled visit for ${formattedVisit}.`;

      const existingRemarks = activeTicket.adminRemarks || [];

      await updateDoc(ticketRef, {
        proposedVisitTime: visitTime,
        status: 'Pending Student Confirmation',
        adminRemarks: [...existingRemarks, newRemark]
      });

      alert('Visit time updated and sent to student for confirmation!');
      setActiveTicket(null);
      setVisitTime('');
      setAdminRemarkInput('');
    } catch (err) {
      console.error('Failed to update visit schedule:', err);
      alert('Could not update schedule. Try again.');
    }
  };

  // Status updates directly (e.g. Marking as Resolved)
  const handleStatusChange = async (ticketDocId, newStatus) => {
    try {
      const ticketRef = doc(db, 'tickets', ticketDocId);
      const ticket = tickets.find(t => t.id === ticketDocId);
      const existingRemarks = ticket.adminRemarks || [];

      await updateDoc(ticketRef, { 
        status: newStatus,
        adminRemarks: [...existingRemarks, `[Admin Log]: Status changed directly to ${newStatus}.`]
      });
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Could not update status. Please try again.');
    }
  };

  const renderSLA = (dueDateStr, status, isEscalated, isUrgent) => {
    if (status === 'Resolved') {
      return <span className="badge badge-success">Closed</span>;
    }

    const now = new Date();
    const due = new Date(dueDateStr);
    const diffMs = due - now;

    if (diffMs <= 0 || isEscalated) {
      return <span className="badge badge-escalated">🔴 ESCALATED</span>;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (isUrgent) {
      return <span className="badge badge-urgent">⚠️ {hours}h {mins}m left</span>;
    }

    return <span className="badge badge-active">⏱️ {hours}h {mins}m left</span>;
  };

  const renderSubmissionTime = (timestamp) => {
    if (!timestamp?.toDate) return 'N/A';
    const dateObj = timestamp.toDate();
    return (
      <div>
        <strong>{dateObj.toLocaleDateString()}</strong>
        <br />
        <small className="text-muted">
          🕒 {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </small>
      </div>
    );
  };

  const filteredTickets = tickets.filter((t) => {
    const matchCategory = categoryFilter === 'All' || t.category === categoryFilter;
    const matchStatus = statusFilter === 'All' || 
                        (statusFilter === 'Escalated' ? t.isEscalated : t.status === statusFilter);
    
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = (t.ticketId || '').toLowerCase().includes(searchLower) ||
                        (t.studentRegistration || '').toLowerCase().includes(searchLower) ||
                        (t.studentName || '').toLowerCase().includes(searchLower) ||
                        (t.gender || '').toLowerCase().includes(searchLower) ||
                        (t.hostelBlock || '').toLowerCase().includes(searchLower) ||
                        (t.wing || '').toLowerCase().includes(searchLower) ||
                        (t.roomNumber || '').toLowerCase().includes(searchLower);

    return matchCategory && matchStatus && matchSearch;
  });

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <h2>Campus Admin Dashboard</h2>
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
            <option value="Internet/Wi-Fi">Internet/Wi-Fi</option>
            <option value="Cleaning">Cleaning</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Filter Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Pending Admin Approval">Pending Admin Approval</option>
            <option value="Pending Student Confirmation">Pending Student Confirmation</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Resolved">Resolved</option>
            <option value="Escalated">🔴 Escalated Only</option>
          </select>
        </div>

        <div className="filter-group search-group">
          <input 
            type="text" 
            placeholder="Search Ticket, Reg No, Block, Wing..." 
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
              <th style={{ width: '9%' }}>Priority / ID</th>
              <th style={{ width: '9%' }}>Filed Date</th>
              <th style={{ width: '10%' }}>Location</th>
              <th style={{ width: '11%' }}>Student Info</th>
              <th style={{ width: '22%' }}>Category & Description</th>
              <th style={{ width: '12%' }}>Visit Schedule</th>
              <th style={{ width: '11%' }}>Remarks</th>
              <th style={{ width: '9%' }}>SLA</th>
              <th style={{ width: '14%' }}>Status Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-records">No grievances match current filters.</td>
              </tr>
            ) : (
              filteredTickets.map((t) => {
                const catStyle = CATEGORY_STYLES[t.category] || { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' };

                return (
                  <tr 
                    key={t.id} 
                    className={
                      t.status === 'Resolved' 
                        ? 'row-resolved' 
                        : t.isEscalated 
                        ? 'row-escalated' 
                        : t.isUrgent 
                        ? 'row-urgent' 
                        : ''
                    }
                  >
                    <td>
                      <span className="ticket-badge">{t.ticketId}</span>
                      {t.isEscalated && t.status !== 'Resolved' && (
                        <div className="priority-tag priority-high">PRIORITY 1</div>
                      )}
                      {t.isUrgent && !t.isEscalated && t.status !== 'Resolved' && (
                        <div className="priority-tag priority-medium">PRIORITY 2</div>
                      )}
                    </td>
                    <td>
                      {renderSubmissionTime(t.createdAt)}
                    </td>
                    <td>
                      <strong>{t.gender ? `${t.gender}'s Hostel` : 'Hostel'}</strong><br />
                      <span>{t.hostelBlock || 'N/A'} {t.wing ? `• Wing ${t.wing}` : ''}</span><br />
                      <small className="text-muted">Room {t.roomNumber || 'N/A'}</small>
                    </td>
                    <td>
                      <div><strong>{t.studentName}</strong></div>
                      <small className="text-muted">{t.studentRegistration}</small>
                    </td>
                    <td>
                      {/* Styled Pastel Category Tag */}
                      <span
                        className="category-pill"
                        style={{
                          backgroundColor: catStyle.bg,
                          color: catStyle.color,
                          border: `1px solid ${catStyle.border}`
                        }}
                      >
                        {t.category}
                      </span>

                      {/* AI Urgency Pill */}
                      {t.urgencyScore && (
                        <span 
                          style={{
                            marginLeft: '6px',
                            padding: '2px 6px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            display: 'inline-block',
                            backgroundColor: t.urgencyScore >= 4 ? '#ffebee' : t.urgencyScore === 3 ? '#fff3e0' : '#e8f5e9',
                            color: t.urgencyScore >= 4 ? '#c62828' : t.urgencyScore === 3 ? '#e65100' : '#2e7d32',
                            border: `1px solid ${t.urgencyScore >= 4 ? '#ef5350' : t.urgencyScore === 3 ? '#ffb74d' : '#81c784'}`
                          }}
                        >
                          🤖 AI: {t.urgencyLabel || `Level ${t.urgencyScore}`}
                        </span>
                      )}

                      <p className="table-desc">{t.description}</p>

                      {/* AI Note Justification */}
                      {t.aiReasoning && (
                        <small style={{ display: 'block', color: '#555', fontStyle: 'italic', marginTop: '4px' }}>
                          💡 <strong>AI Reason:</strong> {t.aiReasoning}
                        </small>
                      )}

                      {t.photoUrl && (
                        <a href={t.photoUrl} target="_blank" rel="noreferrer" className="photo-link">
                          🖼️ View Photo
                        </a>
                      )}
                    </td>
                    <td>
                      <div className="schedule-info">
                        {t.proposedVisitTime ? (
                          <strong>{new Date(t.proposedVisitTime).toLocaleString()}</strong>
                        ) : (
                          <span className="text-muted">Unscheduled</span>
                        )}
                        <button 
                          className="schedule-btn"
                          onClick={() => {
                            setActiveTicket(t);
                            setVisitTime(t.proposedVisitTime || '');
                          }}
                        >
                          📅 Set/Change Visit
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="remarks-column">
                        {t.adminRemarks && t.adminRemarks.length > 0 ? (
                          <ul>
                            {t.adminRemarks.map((rem, i) => (
                              <li key={i}><small>{rem}</small></li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted">No remarks yet</span>
                        )}
                      </div>
                    </td>
                    <td>{renderSLA(t.dueDate, t.status, t.isEscalated, t.isUrgent)}</td>
                    <td>
                      <select 
                        className={`status-select ${
                          t.status === 'Resolved'
                            ? 'resolved'
                            : t.status === 'In Progress' || t.status === 'Scheduled'
                            ? 'in-progress'
                            : 'unresolved'
                        }`}
                        value={t.status}
                        onChange={(e) => handleStatusChange(t.id, e.target.value)}
                      >
                        <option value="Pending Admin Approval">Pending Admin Approval</option>
                        <option value="Pending Student Confirmation">Pending Student Confirmation</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Visit Scheduling Modal */}
      {activeTicket && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Propose/Schedule Visit Time</h3>
            <p>Ticket: <strong>{activeTicket.ticketId}</strong> — {activeTicket.studentName}</p>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
                Visit Date & Time:
              </label>
              <input 
                type="datetime-local" 
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', fontSize: '13px' }}>
                Admin Note/Remark (Optional):
              </label>
              <textarea 
                rows="2"
                placeholder="Reason for slot or instructions for student..."
                value={adminRemarkInput}
                onChange={(e) => setAdminRemarkInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setActiveTicket(null)}>Cancel</button>
              <button className="modal-btn-confirm" onClick={handleSetVisitSchedule}>Notify Student</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}