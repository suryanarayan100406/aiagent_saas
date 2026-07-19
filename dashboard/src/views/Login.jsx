import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setErr(e.code === 'auth/invalid-credential' ? 'Wrong email or password.' : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center">
      <form className="login-card" onSubmit={submit}>
        <h1>Cura<span className="accent">.</span></h1>
        <p className="muted">Sign in to your dashboard</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {err && <div className="error-box">{err}</div>}
        <button className="btn" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
