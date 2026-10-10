import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Users, Search, LogOut, Plus, RefreshCw, X, ShieldCheck } from 'lucide-react';
import api from './api';

const emptyWorkshop = { code: '', title: '', instructor: '', startsAt: '', capacity: 10, location: '', description: '', status: 'Scheduled' };
const dateLabel = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const errorText = err => err?.response?.data?.message || 'Something went wrong. Please try again.';

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { const { data } = await api.post('/auth/login', { email, password }); localStorage.setItem('workshop_token', data.token); onLogin(data.user); }
    catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }
  return <main className="login-wrap"><section className="login-card">
    <div className="brand-mark"><CalendarDays size={25}/></div><p className="eyebrow">COMMUNITY TRAINING CENTRE</p>
    <h1>Workshop Desk</h1><p className="muted">A simpler way to manage workshops and registrations.</p>
    <form onSubmit={submit} className="form-stack">
      <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>
      {error && <p className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    </form><p className="hint">Development demo: admin@example.com / Admin123!</p>
  </section></main>;
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [workshops, setWorkshops] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('workshops');
  const [filters, setFilters] = useState({ from: '', to: '', status: '', available: false });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [workshopForm, setWorkshopForm] = useState(null);
  const [registerForm, setRegisterForm] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'Staff' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('workshop_token');
    if (!token) { setAuthReady(true); return; }
    api.get('/auth/me').then(r=>setUser(r.data)).catch(()=>localStorage.removeItem('workshop_token')).finally(()=>setAuthReady(true));
  }, []);

  const loadWorkshops = useCallback(async () => {
    const params = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.status) params.status = filters.status;
    if (filters.available) params.available = 'true';
    const { data } = await api.get('/workshops', { params }); setWorkshops(data);
  }, [filters]);
  const loadRegistrations = useCallback(async () => {
    const { data } = await api.get('/registrations', selected ? { params: { workshopId: selected._id } } : {});
    setRegistrations(data);
  }, [selected]);
  const loadUsers = useCallback(async () => { const { data } = await api.get('/users'); setUsers(data); }, []);

  useEffect(() => { if (user) loadWorkshops().catch(e=>setError(errorText(e))); }, [user, loadWorkshops]);
  useEffect(() => { if (user && tab === 'history') loadRegistrations().catch(e=>setError(errorText(e))); }, [user, tab, loadRegistrations]);
  useEffect(() => { if (user?.role === 'Admin' && tab === 'users') loadUsers().catch(e=>setError(errorText(e))); }, [user, tab, loadUsers]);

  async function refresh() {
    setError(''); setMessage('');
    try { await loadWorkshops(); if (tab === 'history') await loadRegistrations(); if (tab === 'users' && user.role === 'Admin') await loadUsers(); }
    catch (e) { setError(errorText(e)); }
  }
  function logout() { localStorage.removeItem('workshop_token'); setUser(null); setWorkshops([]); setRegistrations([]); setUsers([]); }
  async function createWorkshop(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const payload = { ...workshopForm, capacity: Number(workshopForm.capacity), startsAt: new Date(workshopForm.startsAt).toISOString() };
      if (workshopForm._id) await api.patch(`/workshops/${workshopForm._id}`, payload);
      else await api.post('/workshops', payload);
      setWorkshopForm(null); setMessage(workshopForm._id ? 'Workshop updated.' : 'Workshop created.'); await loadWorkshops();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function registerAttendee(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await api.post('/registrations', registerForm); setRegisterForm(null); setMessage('Attendee registered successfully.'); await loadWorkshops(); if (tab==='history') await loadRegistrations(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function cancelRegistration(id) {
    if (!window.confirm('Cancel this registration? The record will remain in history.')) return;
    setError(''); setMessage('');
    try { await api.patch(`/registrations/${id}/cancel`); setMessage('Registration cancelled and seat released.'); await loadWorkshops(); await loadRegistrations(); }
    catch (e) { setError(errorText(e)); }
  }
  async function createUser(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await api.post('/users', userForm); setUserForm({ name:'', email:'', password:'', role:'Staff' }); setMessage('Account created.'); await loadUsers(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  const activeRegistrations = useMemo(()=>registrations.filter(r=>r.status==='Active').length,[registrations]);

  if (!authReady) return <div className="loading">Loading your workspace…</div>;
  if (!user) return <Login onLogin={setUser}/>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="side-brand"><div className="brand-mark small"><CalendarDays size={20}/></div><div><strong>Workshop Desk</strong><small>Training Centre</small></div></div>
      <p className="side-label">WORKSPACE</p>
      <button className={`nav-item ${tab==='workshops'?'active':''}`} onClick={()=>{setTab('workshops');setSelected(null)}}><CalendarDays size={18}/> Workshops</button>
      <button className={`nav-item ${tab==='history'?'active':''}`} onClick={()=>{setTab('history');setSelected(null)}}><Users size={18}/> Registration history</button>
      {user.role==='Admin' && <><p className="side-label">ADMINISTRATION</p><button className={`nav-item ${tab==='users'?'active':''}`} onClick={()=>setTab('users')}><ShieldCheck size={18}/> Staff accounts</button></>}
      <div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div className="user-info"><strong>{user.name}</strong><small>{user.role}</small></div></div><button className="logout" onClick={logout}><LogOut size={16}/> Sign out</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><p className="eyebrow">COMMUNITY PROGRAMMES</p><h1>{tab==='workshops'?'Workshops':tab==='history'?'Registration history':'Staff accounts'}</h1></div><button className="icon-button" onClick={refresh} title="Refresh"><RefreshCw size={17}/></button></header>
      {message && <div className="notice success">{message}<button onClick={()=>setMessage('')}><X size={15}/></button></div>}
      {error && <div className="notice danger">{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}

      {tab==='workshops' && <>
        <section className="welcome-row"><div><h2>All workshops</h2><p className="muted">See availability and manage attendee registrations.</p></div>{user.role==='Manager' && <button className="primary" onClick={()=>setWorkshopForm({...emptyWorkshop})}><Plus size={17}/> Add workshop</button>}</section>
        <section className="filter-card">
          <div className="filter-heading"><Search size={17}/><strong>Find a workshop</strong></div>
          <div className="filters">
            <label>From<input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label>
            <label>To<input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label>
            <label>Status<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option value="">All statuses</option><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></label>
            <label className="check-label"><input type="checkbox" checked={filters.available} onChange={e=>setFilters({...filters,available:e.target.checked})}/> Seats available</label>
            <button className="secondary" onClick={()=>setFilters({from:'',to:'',status:'',available:false})}>Clear filters</button>
          </div>
        </section>
        <div className="stats-row"><div className="stat-card"><span>Workshops found</span><strong>{workshops.length}</strong></div><div className="stat-card"><span>Open for registration</span><strong>{workshops.filter(w=>w.status==='Scheduled'&&w.seatsAvailable>0).length}</strong></div><div className="stat-card"><span>Total free seats</span><strong>{workshops.reduce((n,w)=>n+w.seatsAvailable,0)}</strong></div></div>
        {workshops.length===0 ? <div className="empty-state"><CalendarDays size={30}/><h3>No workshops found</h3><p>Try changing your filters or add a workshop.</p></div> :
          <div className="workshop-grid">{workshops.map(w=><article className="workshop-card" key={w._id}>
            <div className="card-top"><span className="code">{w.code}</span><span className={`status status-${w.status.toLowerCase()}`}>{w.status}</span></div>
            <h3>{w.title}</h3><p className="instructor">Led by {w.instructor}</p>
            <div className="detail-line"><CalendarDays size={16}/>{dateLabel(w.startsAt)}</div>
            <div className="detail-line"><Users size={16}/>{w.location||'Location to be confirmed'}</div>
            <div className="seat-area"><div className="seat-label"><span>Seats filled</span><strong>{w.activeCount} / {w.capacity}</strong></div><div className="progress"><span style={{width:`${Math.min(100,w.activeCount/w.capacity*100)}%`}}/></div><small>{w.seatsAvailable} seats remaining</small></div>
            {w.description && <p className="description">{w.description}</p>}
            <div className="card-actions"><button className="secondary" onClick={async()=>{setSelected(w);setTab('history');try{const {data}=await api.get('/registrations',{params:{workshopId:w._id}});setRegistrations(data)}catch(e){setError(errorText(e))}}}>View history</button>
              {(user.role==='Manager')&&<button className="secondary" onClick={()=>setWorkshopForm({...w, startsAt:new Date(w.startsAt).toISOString().slice(0,16)})}>Edit</button>}
              {(user.role==='Manager'||user.role==='Staff')&&w.status==='Scheduled'&&w.seatsAvailable>0&&<button className="primary" onClick={()=>setRegisterForm({workshopId:w._id,attendeeName:'',attendeeEmail:''})}>Register</button>}
            </div>
          </article>)}</div>}
      </>}

      {tab==='history' && <>
        <section className="welcome-row"><div><h2>{selected?selected.title:'All registrations'}</h2><p className="muted">Active and cancelled records are retained for accountability.</p></div>{selected&&<button className="secondary" onClick={()=>{setSelected(null);loadRegistrations()}}>Show all history</button>}</section>
        <div className="history-summary"><div><span>Records shown</span><strong>{registrations.length}</strong></div><div><span>Active</span><strong>{activeRegistrations}</strong></div><div><span>Cancelled</span><strong>{registrations.length-activeRegistrations}</strong></div></div>
        <div className="table-card"><table><thead><tr><th>Attendee</th><th>Workshop</th><th>Status</th><th>Registered by / at</th><th>Cancelled by / at</th><th>Action</th></tr></thead><tbody>
          {registrations.map(r=><tr key={r._id}><td><strong>{r.attendeeName}</strong><small>{r.attendeeEmail}</small></td><td>{r.workshop?.title||'Workshop'}<small>{r.workshop?.code||''}</small></td><td><span className={`status status-${r.status.toLowerCase()}`}>{r.status}</span></td><td>{r.registeredBy?.name||'Unknown'}<small>{dateLabel(r.registeredAt)}</small></td><td>{r.cancelledBy?.name||'—'}<small>{r.cancelledAt?dateLabel(r.cancelledAt):'—'}</small></td><td>{r.status==='Active'&&(user.role==='Manager'||user.role==='Staff')&&<button className="text-danger" onClick={()=>cancelRegistration(r._id)}>Cancel</button>}</td></tr>)}
          {!registrations.length&&<tr><td colSpan="6" className="empty-cell">No registration records yet.</td></tr>}
        </tbody></table></div>
      </>}

      {tab==='users'&&user.role==='Admin'&&<>
        <section className="welcome-row"><div><h2>Team access</h2><p className="muted">Create staff accounts and choose their permissions.</p></div></section>
        <div className="user-layout"><section className="panel"><h3>Create an account</h3><form className="form-stack" onSubmit={createUser}>
          <label>Full name<input value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})} required/></label>
          <label>Email<input type="email" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} required/></label>
          <label>Temporary password<input type="password" minLength="8" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})} required/></label>
          <label>Role<select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}><option>Staff</option><option>Manager</option><option>Admin</option></select></label>
          <button className="primary" disabled={busy}><Plus size={16}/> Create account</button>
        </form></section><section className="panel"><h3>Existing accounts <span className="count">{users.length}</span></h3><div className="account-list">{users.map(u=><div className="account-row" key={u._id}><div className="avatar">{u.name[0]?.toUpperCase()}</div><div className="account-info"><strong>{u.name}</strong><small>{u.email}</small></div><span className="role-pill">{u.role}</span></div>)}</div></section></div>
      </>}
    </main>

    {workshopForm&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setWorkshopForm(null)}}><section className="modal"><div className="modal-head"><div><p className="eyebrow">WORKSHOP DETAILS</p><h2>{workshopForm._id?'Edit workshop':'Add workshop'}</h2></div><button className="icon-button" onClick={()=>setWorkshopForm(null)}><X size={18}/></button></div>
      <form className="form-stack" onSubmit={createWorkshop}><div className="two-col"><label>Workshop code<input value={workshopForm.code} disabled={!!workshopForm._id} onChange={e=>setWorkshopForm({...workshopForm,code:e.target.value})} required/></label><label>Title<input value={workshopForm.title} onChange={e=>setWorkshopForm({...workshopForm,title:e.target.value})} required/></label></div>
      <div className="two-col"><label>Instructor<input value={workshopForm.instructor} onChange={e=>setWorkshopForm({...workshopForm,instructor:e.target.value})} required/></label><label>Location<input value={workshopForm.location||''} onChange={e=>setWorkshopForm({...workshopForm,location:e.target.value})}/></label></div>
      <div className="two-col"><label>Date and time<input type="datetime-local" value={workshopForm.startsAt} onChange={e=>setWorkshopForm({...workshopForm,startsAt:e.target.value})} required/></label><label>Capacity<input type="number" min={Math.max(1,workshopForm.activeCount||0)} value={workshopForm.capacity} onChange={e=>setWorkshopForm({...workshopForm,capacity:e.target.value})} required/></label></div>
      <label>Status<select value={workshopForm.status||'Scheduled'} onChange={e=>setWorkshopForm({...workshopForm,status:e.target.value})}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></label>
      <label>Description<textarea rows="3" value={workshopForm.description||''} onChange={e=>setWorkshopForm({...workshopForm,description:e.target.value})}/></label>
      <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setWorkshopForm(null)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save workshop'}</button></div></form></section></div>}

    {registerForm&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setRegisterForm(null)}}><section className="modal compact"><div className="modal-head"><div><p className="eyebrow">NEW REGISTRATION</p><h2>Register attendee</h2><p className="muted">{workshops.find(w=>w._id===registerForm.workshopId)?.title}</p></div><button className="icon-button" onClick={()=>setRegisterForm(null)}><X size={18}/></button></div>
      <form className="form-stack" onSubmit={registerAttendee}><label>Attendee full name<input autoFocus value={registerForm.attendeeName} onChange={e=>setRegisterForm({...registerForm,attendeeName:e.target.value})} required/></label><label>Attendee email<input type="email" value={registerForm.attendeeEmail} onChange={e=>setRegisterForm({...registerForm,attendeeEmail:e.target.value})} required/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setRegisterForm(null)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Registering…':'Confirm registration'}</button></div></form></section></div>}
  </div>;
}
export default App;
