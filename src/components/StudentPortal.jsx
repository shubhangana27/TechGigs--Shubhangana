import React, { useState, useEffect } from 'react';
import { db, storage, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Clock, AlertTriangle, CheckCircle, Upload, Plus, History } from 'lucide-react';
import './StudentPortal.css';

// Default SLA hours per category
const CATEGORY_SLA = {
  Electricity: 12, // High priority
  Plumbing: 24,
  Carpentry: 48,
  Internet: 12,
  Cleaning: 8
};

export default function StudentPortal({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('new'); // 'new' or 'history'
  const [hostelBlock, setHostelBlock] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);

  // Fetch tickets raised by current student
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
      setTickets(fetchedTickets);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hostelBlock || !roomNumber || !category || !description) {
      alert('Please fill out all required fields.');
      return;
    }

    setLoading(true);
    try {
      let photoUrl = '';

      // Upload image if selected
      if (file) {
        const fileRef = ref(storage, `complaints/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        photoUrl = await getDownloadURL(fileRef);
      }

      // Generate Ticket ID
      const ticketId = `TICK-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const slaHours = CATEGORY_SLA[category] || 24;
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + slaHours);

      // Save to Firestore
      await addDoc(collection(db, 'tickets'), {
        ticketId,
        studentName: user.name || 'Student',
        studentRegistration: user.registrationNumber,
        studentEmail: user.email,
        hostelBlock,
        roomNumber,
        category,
        description,
        photoUrl,
        status: 'Unresolved', // 'Unresolved' | 'In Progress' | 'Resolved'
        slaHours,
        dueDate: dueDate.toISOString(),
        isEscalated: false,
        createdAt: serverTimestamp()
      });

      alert(`Grievance submitted successfully! Ticket ID: ${ticketId}`);
      
      // Reset form
      setHostelBlock('');
      setRoomNumber('');
      setCategory('');
      setDescription('');
      setFile(null);
      setActiveTab('history');
    } catch (err) {
      console.error("Error submitting ticket: ", err);
      alert('Failed to submit complaint. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper for SLA Countdown / Status Display
  const getSlaStatus = (dueDateStr, status) => {
    if (status === 'Resolved') {
      return <span className="badge badge-success"><CheckCircle size={14}/> Resolved</span>;
    }
    const now = new Date();
    const due = new Date(dueDateStr);
    const diffMs = due - now;

    if (diffMs <= 0) {
      return <span className="badge badge-danger"><AlertTriangle size={14}/> SLA Breached (Escalated)</span>;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return <span className="badge badge-warning"><Clock size={14}/> Expected in {hours}h {mins}m</span>;
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
          <Plus size={18}/> New Complaint
        </button>
        <button 
          className={activeTab === 'history' ? 'active' : ''} 
          onClick={() => setActiveTab('history')}
        >
          <History size={18}/> My Complaints ({tickets.length})
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="card form-card">
          <h3>Raise a New Maintenance Request</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Hostel Block</label>
                <select value={hostelBlock} onChange={(e) => setHostelBlock(e.target.value)} required>
                  <option value="">-- Select Block --</option>
                  <option value="Block A">Block A</option>
                  <option value="Block B">Block B</option>
                  <option value="Block C">Block C</option>
                  <option value="Block D">Block D</option>
                </select>
              </div>

              <div className="form-group">
                <label>Room Number</label>
                <select value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} required>
                  <option value="">-- Select Room --</option>
                  {[...Array(30)].map((_, i) => (
                    <option key={i + 101} value={`${i + 101}`}>{i + 101}</option>
                  ))}
                </select>
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
              {loading ? 'Submitting...' : 'Submit Complaint'}
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
                    <span>📍 {t.hostelBlock}, Room {t.roomNumber}</span>
                    <span>📅 {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                  </div>
                  {t.photoUrl && (
                    <div className="ticket-image-container">
                      <a href={t.photoUrl} target="_blank" rel="noreferrer">View Photo Proof</a>
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