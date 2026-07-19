import { useState } from 'react';
import { useAuth } from './auth.jsx';
import Login from './views/Login.jsx';
import Inbox from './views/Inbox.jsx';
import Approvals from './views/Approvals.jsx';
import Pipeline from './views/Pipeline.jsx';
import Analytics from './views/Analytics.jsx';
import Knowledge from './views/Knowledge.jsx';
import Team from './views/Team.jsx';
import Status from './views/Status.jsx';

const NAV = [
  { id: 'inbox', label: 'Inbox', icon: '💬' },
  { id: 'approvals', label: 'Approvals', icon: '✅' },
  { id: 'pipeline', label: 'Leads', icon: '📋' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'knowledge', label: 'Knowledge', icon: '🧠', ownerOnly: true },
  { id: 'team', label: 'Team', icon: '👥', ownerOnly: true },
  { id: 'status', label: 'Status', icon: '🩺', ownerOnly: true },
];

export default function App() {
  const { user, profile, loading, error, signOut } = useAuth();
  const [tab, setTab] = useState('inbox');
  const [pendingCount, setPendingCount] = useState(0);

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Login />;

  // Signed in to Firebase but no company profile yet.
  if (!profile) {
    return (
      <div className="center">
        <div className="login-card">
          <h1>Almost there</h1>
          <p className="muted">
            {error || 'Your account is not linked to a company yet.'}
          </p>
          <p className="muted">Ask the owner to add you, then sign in again.</p>
          <button className="btn-ghost" onClick={signOut} style={{ marginTop: 16 }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const isOwner = profile.user.role === 'owner';
  const nav = NAV.filter((n) => !n.ownerOnly || isOwner);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          {profile.company.name?.split(' ')[0] || 'Cura'}<span>.</span>
        </div>
        {nav.map((n) => (
          <div
            key={n.id}
            className={`nav-item ${tab === n.id ? 'active' : ''}`}
            onClick={() => setTab(n.id)}
          >
            <span>{n.icon}</span> {n.label}
            {n.id === 'approvals' && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}
          </div>
        ))}
        <div className="sidebar-foot">
          <div>{profile.user.email}</div>
          <div style={{ margin: '4px 0 8px' }}>
            <span className="pill won">{profile.user.role}</span>
          </div>
          <button className="btn-ghost" onClick={signOut} style={{ width: '100%' }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        {tab === 'inbox' && <Inbox />}
        {tab === 'approvals' && <Approvals onCount={setPendingCount} />}
        {tab === 'pipeline' && <Pipeline />}
        {tab === 'analytics' && <Analytics />}
        {tab === 'knowledge' && isOwner && <Knowledge company={profile.company} />}
        {tab === 'team' && isOwner && <Team me={profile.user} />}
        {tab === 'status' && isOwner && <Status />}
      </main>
    </div>
  );
}
