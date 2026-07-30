import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import './StudentPortal.css';

const IMGBB_API_KEY = 'ed03a0331775e65e02bce77426567b93'; // Replace with your actual ImgBB API key

const CATEGORY_SLA = {
  Electricity: 12,
  Plumbing: 24,
  Carpentry: 48,
  Internet: 12,
  Cleaning: 8
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

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'tickets'),
      where('studentRegistration', '==', user.registrationNumber)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort newest submission first for student view
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
        status: 'Unresolved',
        slaHours,
        dueDate: dueDate.toISOString(),
        isEscalated: false,
        createdAt: serverTimestamp()
      });

      alert(`Grievance submitted successfully! Ticket ID: ${ticketId}`);
      
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

  const getSlaStatus = (dueDateStr, status) => {
    if (status === 'Resolved') {
      return <span className="badge badge-success">✓ Resolved</span>;
    }
    const now = new Date();
    const due = new Date(dueDateStr);
    const diffMs = due - now;

    if (diffMs <= 0) {
      return <span className="badge badge-danger">⚠️ SLA Breached (Escalated)</span>;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return <span className="badge badge-warning">⏱️ Expected in {hours}h {mins}m</span>;
  };

  // Helper to format date and time nicely
  const formatDateTime = (timestamp) => {
    if (!timestamp?.toDate) return 'Just now';
    const dateObj = timestamp.toDate();
    const dateStr = dateObj.toLocaleDateString();
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} at ${timeStr}`;
  };

  return (
    <div className="portal-container">
      <header className="portal-header">
        <div>
          <h2>Student Grievance Portal</h2>
          <p>Logged in as: <strong>{user?.name || user?.registrationNumber}</strong></p>
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
        <div className="card form-card">
          <h3>Raise a New Maintenance Request</h3>
          <form onSubmit={handleSubmit}>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Boys/Girls</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} required>
                  <option value="">-- Select--</option>
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
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
                  <option value="Block R">Recreational</option>
                  <option value="Block S">Special</option>
                </select>
              </div>

              <div className="form-group">
                <label>Wing</label>
                <select value={wing} onChange={(e) => setWing(e.target.value)} required>
                  <option value="">-- Select--</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="F">F</option>
                  <option value="G">G</option>
                  <option value="H">H</option>
                </select>
              </div>

              <div className="form-group">
                <label>Room Number</label>
                <input
                  type="text"
                  placeholder="Enter room number"
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
                <option value="Internet">Internet/Wi-Fi (SLA: 12h)</option>
                <option value="Cleaning">Cleaning/Housekeeping (SLA: 8h)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Description of Issue</label>
              <textarea 
                rows="4" 
                placeholder="Describe the problem clearly..." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Upload Photo Proof</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => setFile(e.target.files[0])} 
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Uploading & Submitting...' : 'Submit Complaint'}
            </button>
          </form>
        </div>
      ) : (
        <div className="card history-card">
          <h3>Your Complaint History</h3>
          {tickets.length === 0 ? (
            <p className="no-data">No complaints submitted yet.</p>
          ) : (
            <div className="ticket-list">
              {tickets.map((t) => (
                <div key={t.id} className="ticket-item">
                  <div className="ticket-header">
                    <div>
                      <span className="ticket-id">{t.ticketId}</span>
                      <span className="ticket-category">{t.category}</span>
                    </div>
                    {getSlaStatus(t.dueDate, t.status)}
                  </div>
                  <p className="ticket-desc">{t.description}</p>
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}