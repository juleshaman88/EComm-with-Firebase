import { useState } from 'react';
import { loginWithEmail, registerWithEmail } from '../firebaseServices';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage('');
      setError('');

      if (mode === 'register') {
        await registerWithEmail(email, password);
        setMessage('Registration successful. You are now signed in.');
      } else {
        await loginWithEmail(email, password);
        setMessage('Login successful.');
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="panel auth-panel">
        <h1>Welcome to Your E-Commerce App</h1>
        <p>Use your email and password to login or create a new account.</p>
        <div className="action-row">
          <button
            type="button"
            className={mode === 'login' ? '' : 'secondary-button'}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === 'register' ? '' : 'secondary-button'}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>
        <div className="form-grid">
          <input
            type="email"
            value={email}
            placeholder="Email"
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            value={password}
            placeholder="Password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
        </button>
        {message ? <p className="status-message success-message">{message}</p> : null}
        {error ? <p className="status-message error-message">{error}</p> : null}
      </section>
    </main>
  );
}
