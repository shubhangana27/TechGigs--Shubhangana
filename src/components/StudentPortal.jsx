import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { evaluateTicketUrgency } from '../services/aiPrioritizer';
import './StudentPortal.css';

const IMGBB_API_KEY = 'ed03a0331775e65e02bce77426567b93';

const CATEGORY_SLA = {
  Electricity: 12,
  Plumbing: 24,
  Carpentry: 48,
  Internet: 12,
  Cleaning: 8
};

const CATEGORY_STYLES = {
  Electricity: { bg: '#fef9c3', color: '#854d0e', border: '#fde047' }, // Soft Pastel Yellow
  Plumbing: { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' },    // Soft Pastel Blue
  Carpentry: { bg: '#f5ebe0', color: '#78350f', border: '#e6ccb2' },   // Soft Light Brown / Beige
  Internet: { bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' },    // Soft Pastel Purple
  Cleaning: { bg: '#dcfce7', color: '#15803d', border: '#86efac' }     // Soft Pastel Green
};

export default function StudentPortal({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('new');
  const [hostelBlock, setHostelBlock] = useState('');
  const [gender, setGender] = useState('');
  const [wing, setWing] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [customTime, setCustomTime] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'tickets'),
      where('studentRegistration', '==', user.registrationNumber)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTickets = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      fetchedTickets.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });

      setTickets(fetchedTickets);
    }, (error) => {
      console.error("Firestore read error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const uploadToImgBB = async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (data.success) {
      return data.data.url;
    } else {
      throw new Error(data.error?.message || 'Failed to upload image to ImgBB');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gender || !hostelBlock || !wing || !roomNumber || !category || !description) {
      alert('Please fill out all required fields.');
      return;
    }

    setLoading(true);
    try {
      let photoUrl = '';
      if (file) {
        photoUrl = await uploadToImgBB(file);
      }

      const aiAssessment = await evaluateTicketUrgency(category, description);

      const ticketId = `TICK-${Math.floor(100000 + Math.random() * 900000)}`;
      const slaHours = CATEGORY_SLA[category] || 24;
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + slaHours);

      await addDoc(collection(db, 'tickets'), {
        ticketId,
        studentName: user.name || 'Student',
        studentRegistration: user.registrationNumber,
        studentEmail: user.email || '',
        gender,
        hostelBlock,
        wing,
        roomNumber,
        category,
        description,
        photoUrl,
        status: 'Pending Admin Approval',
        slaHours,
        dueDate: dueDate.toISOString(),
        proposedVisitTime: null,
        adminRemarks: ['New ticket filed by student.'],
        isEscalated: false,
        createdAt: serverTimestamp(),

        urgencyScore: aiAssessment.urgencyScore, 
        urgencyLabel: aiAssessment.urgencyLabel, 
        aiReasoning: aiAssessment.aiReasoning    
      });

      alert(`Grievance submitted successfully! Sent to Admin. Ticket ID: ${ticketId}`);

      setGender('');
      setHostelBlock('');
      setWing('');
      setRoomNumber('');
      setCategory('');
      setDescription('');
      setFile(null);
      setActiveTab('history');
    } catch (err) {
      console.error("Submission Error:", err);
      alert(`Error submitting complaint: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTime = async (ticketDocId) => {
    try {
      const ticketRef = doc(db, 'tickets', ticketDocId);
      const ticket = tickets.find(t => t.id === ticketDocId);
      const newRemarks = [...(ticket.adminRemarks || []), `[Student Log]: Accepted visit time (${formatDisplayTime(ticket.proposedVisitTime)}).` ];

      await updateDoc(ticketRef, {
        status: 'Scheduled',
        adminRemarks: newRemarks
      });
      alert('You have accepted the visit schedule.');
    } catch (err) {
      console.error('Acceptance error:', err);
      alert('Failed to accept visit time.');
    }
  };

  const handleCounterPropose = async () => {
    if (!customTime) {
      alert('Please select a valid date and time.');
      return;
    }

    try {
      const ticketRef = doc(db, 'tickets', selectedTicket.id);
      const newRemarks = [...(selectedTicket.adminRemarks || []), `[Student Log]: Requested modified visit time to ${formatDisplayTime(customTime)}.` ];

      await updateDoc(ticketRef, {
        status: 'Pending Admin Approval',
        proposedVisitTime: customTime,
        adminRemarks: newRemarks
      });

      alert('Requested visit time change submitted to admin.');
      setSelectedTicket(null);
      setCustomTime('');
    } catch (err) {
      console.error('Modification error:', err);
      alert('Failed to send modified schedule.');
    }
  };

  const formatDisplayTime = (isoString) => {
    if (!isoString) return 'Not Scheduled Yet';
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderStatusBadge = (t) => {
    if (t.status === 'Resolved') return <span className="badge badge-success">✓ Resolved</span>;
    if (t.status === 'Pending Admin Approval') return <span className="badge badge-warning">⏳ Awaiting Admin Review</span>;
    if (t.status === 'Pending Student Confirmation') return <span className="badge badge-warning">📅 Action Required: Review Visit Time</span>;
    if (t.status === 'Scheduled') return <span className="badge badge-success">🗓️ Scheduled</span>;
    return <span className="badge badge-warning">{t.status}</span>;
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp?.toDate) return 'Just now';
    const dateObj = timestamp.toDate();
    return `${dateObj.toLocaleDateString()} at ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const studentRegNo = user?.registrationNumber || user?.idInput || 'Student';

  return (
    <div className="portal-container">
     
      <header className="portal-header">
        <div className="header-titles">
          <h1>Student Portal</h1>
          <p className="welcome-tag">Welcome, <strong>{studentRegNo}</strong>!</p>
        </div>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </header>

      <div className="tab-navigation">
        <button 
          className={activeTab === 'new' ? 'active' : ''} 
          onClick={() => setActiveTab('new')}
        >
          ➕ New Complaint
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
        >
          📋 My Complaints ({tickets.length})
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="form-card-container">
          <div className="card form-card">
            <div className="card-header">
              <h3>Raise a Maintenance Request</h3>
              <p>Fill out the details below to log your grievance.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Hostel Type</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} required>
                    <option value="">-- Select --</option>
                    <option value="Boys">Boys Hostel</option>
                    <option value="Girls">Girls Hostel</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Hostel Block</label>
                  <select value={hostelBlock} onChange={(e) => setHostelBlock(e.target.value)} required>
                    <option value="">-- Select Block --</option>
                    <option value="Block 1">Block 1</option>
                    <option value="Block 2">Block 2</option>
                    <option value="Block 3">Block 3</option>
                    <option value="Block 4">Block 4</option>
                    <option value="Block 5">Block 5</option>
                    <option value="Block 6">Block 6</option>
                    <option value="Block 7">Block 7</option>
                    <option value="Block 8">Block 8</option>
                    <option value="Block R">Recreational Block</option>
                    <option value="Block S">Special Block</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Wing</label>
                  <select value={wing} onChange={(e) => setWing(e.target.value)} required>
                    <option value="">-- Select Wing --</option>
                    <option value="None">None</option>
                    <option value="A">Wing A</option>
                    <option value="B">Wing B</option>
                    <option value="C">Wing C</option>
                    <option value="D">Wing D</option>
                    <option value="E">Wing E</option>
                    <option value="F">Wing F</option>
                    <option value="G">Wing G</option>
                    <option value="H">Wing H</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Room Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 302"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Grievance Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} required>
                  <option value="">-- Select Category --</option>
                  <option value="Electricity">Electricity (SLA: 12h)</option>
                  <option value="Plumbing">Plumbing (SLA: 24h)</option>
                  <option value="Carpentry">Carpentry (SLA: 48h)</option>
                  <option value="Internet">Internet / Wi-Fi (SLA: 12h)</option>
                  <option value="Cleaning">Cleaning / Housekeeping (SLA: 8h)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Description of Issue</label>
                <textarea 
                  rows="3" 
                  placeholder="Describe the problem clearly..." 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Upload Photo Proof (Optional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setFile(e.target.files[0])} 
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Analyzing with AI & Submitting...' : 'Submit Complaint'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="card history-card">
          <h3>Your Complaint History</h3>
          {tickets.length === 0 ? (
            <p className="no-data">No complaints submitted yet.</p>
          ) : (
            <div className="ticket-list">
              {tickets.map((t) => {
                const score = t.urgencyScore || 3;
                const label = t.urgencyLabel || (score >= 4 ? 'Critical' : score === 3 ? 'Medium' : 'Low');
                
                const catStyle = CATEGORY_STYLES[t.category] || { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' };

                return (
                  <div key={t.id} className="ticket-item">
                    <div className="ticket-header">
                      <div>
                        <span className="ticket-id">{t.ticketId}</span>
                        
                        <span 
                          className="ticket-category"
                          style={{
                            backgroundColor: catStyle.bg,
                            color: catStyle.color,
                            border: `1px solid ${catStyle.border}`
                          }}
                        >
                          {t.category}
                        </span>

                        <span 
                          style={{
                            marginLeft: '8px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            display: 'inline-block',
                            backgroundColor: score >= 4 ? '#ffebee' : score === 3 ? '#fff3e0' : '#e8f5e9',
                            color: score >= 4 ? '#c62828' : score === 3 ? '#e65100' : '#2e7d32',
                            border: `1px solid ${score >= 4 ? '#ef5350' : score === 3 ? '#ffb74d' : '#81c784'}`
                          }}
                        >
                          🤖 Urgency: {label} ({score}/5)
                        </span>
                      </div>
                      {renderStatusBadge(t)}
                    </div>
                    <p className="ticket-desc">{t.description}</p>
                    
                    <div className="schedule-panel">
                      <strong>Scheduled Visit Time: </strong> 
                      <span>{formatDisplayTime(t.proposedVisitTime)}</span>
                    </div>

                    {t.status === 'Pending Student Confirmation' && (
                      <div className="action-panel">
                        <p>⚠️ Admin proposed a visit schedule. Please confirm or request an alternate time:</p>
                        <button className="confirm-btn" onClick={() => handleAcceptTime(t.id)}>
                          ✓ Accept Proposed Time
                        </button>
                        <button className="modify-btn" onClick={() => setSelectedTicket(t)}>
                          ✏️ Modify Time
                        </button>
                      </div>
                    )}

                    {t.adminRemarks && t.adminRemarks.length > 0 && (
                      <div className="remarks-log">
                        <small><strong>Activity Log:</strong></small>
                        <ul>
                          {t.adminRemarks.map((remark, idx) => (
                            <li key={idx}><small>{remark}</small></li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="ticket-meta">
                      <span>📍 {t.gender ? `${t.gender}'s` : ''} {t.hostelBlock}, Wing {t.wing}, Room {t.roomNumber}</span>
                      <span>🕒 Filed: {formatDateTime(t.createdAt)}</span>
                    </div>
                    {t.photoUrl && (
                      <div className="ticket-image-container">
                        <a href={t.photoUrl} target="_blank" rel="noreferrer">🖼️ View Photo Proof</a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedTicket && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Propose Alternate Visit Time</h3>
            <p>Ticket: <strong>{selectedTicket.ticketId}</strong> ({selectedTicket.category})</p>
            <div className="form-group">
              <label>Select preferred Date & Time:</label>
              <input 
                type="datetime-local" 
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setSelectedTicket(null)}>Cancel</button>
              <button className="modal-btn-confirm" onClick={handleCounterPropose}>Submit New Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}