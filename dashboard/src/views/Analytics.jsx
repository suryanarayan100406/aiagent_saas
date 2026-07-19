// Analytics: enquiries over time, pipeline breakdown, busiest hours, bot vs held.
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid,
} from 'recharts';
import { api } from '../api.js';

export default function Analytics() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.stats(30).then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) return <div className="page muted">Loading analytics…</div>;

  const days = Object.entries(stats.byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, n]) => ({ date: date.slice(5), enquiries: n }));
  const hours = stats.byHour.map((n, h) => ({ hour: `${h}`, n }));

  const inbound = stats.byType.inbound || 0;
  const auto = stats.byType.auto_reply || 0;
  const held = stats.byType.held || 0;
  const won = stats.pipeline.won || 0;
  const convRate = stats.totalContacts ? Math.round((won / stats.totalContacts) * 100) : 0;

  return (
    <div className="page">
      <h1>Analytics</h1>
      <div className="sub">Last 30 days</div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat"><div className="n">{inbound}</div><div className="l">Enquiries received</div></div>
        <div className="stat"><div className="n">{auto}</div><div className="l">Auto-replied by bot</div></div>
        <div className="stat"><div className="n">{held}</div><div className="l">Held for approval</div></div>
        <div className="stat"><div className="n">{convRate}%</div><div className="l">Conversion (won)</div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Enquiries per day</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={days}>
              <CartesianGrid stroke="#262b36" />
              <XAxis dataKey="date" stroke="#8a919e" fontSize={12} />
              <YAxis stroke="#8a919e" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1e222b', border: '1px solid #262b36' }} />
              <Line type="monotone" dataKey="enquiries" stroke="#25d366" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Busiest hours</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hours}>
              <CartesianGrid stroke="#262b36" />
              <XAxis dataKey="hour" stroke="#8a919e" fontSize={11} interval={1} />
              <YAxis stroke="#8a919e" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1e222b', border: '1px solid #262b36' }} />
              <Bar dataKey="n" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Pipeline</h3>
        <div className="row" style={{ gap: 20 }}>
          {['new', 'visit', 'quoted', 'won', 'lost'].map((s) => (
            <div key={s}>
              <div className="n" style={{ fontSize: 22, fontWeight: 700 }}>{stats.pipeline[s] || 0}</div>
              <span className={`pill ${s}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
