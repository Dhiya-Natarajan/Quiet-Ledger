import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../api/auth';
import Navbar from '../components/Navbar';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1 = Request code, 2 = Verify & Reset, 3 = Success
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleRequestCode(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await forgotPassword(email.trim());
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to send reset code. Please check your email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to reset password. Please check your verification code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="auth-wrapper">
        <div className="auth-card" style={{ maxWidth: '440px', width: '100%' }}>
          {step === 1 && (
            <>
              <h2>Reset Password</h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '1.2rem', marginTop: '-0.4rem' }}>
                Enter the email associated with your QuietLedger account. We'll send you a secure 6-digit verification code.
              </p>

              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

              <form onSubmit={handleRequestCode} className="form-stack">
                <label>
                  Account Email
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="e.g. user@example.com"
                    required
                    autoComplete="email"
                  />
                </label>

                <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
                  {loading ? 'Sending Verification Code...' : 'Send Reset Code'}
                </button>
              </form>

              <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                Remember your password? <Link to="/login">Sign In</Link>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Verify & Reset</h2>
              <div style={{ background: 'var(--surface2)', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.2rem', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Code sent to: <strong style={{ color: 'var(--text)' }}>{email}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.8rem', padding: 0, marginTop: '4px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Change email
                </button>
              </div>

              {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

              <form onSubmit={handleResetPassword} className="form-stack">
                <label>
                  6-Digit Verification Code
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    required
                    style={{ letterSpacing: '0.2em', fontSize: '1.1rem', fontWeight: 600, textAlign: 'center' }}
                  />
                </label>

                <label>
                  New Password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    autoComplete="new-password"
                  />
                </label>

                <label>
                  Confirm New Password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    autoComplete="new-password"
                  />
                </label>

                <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
                  {loading ? 'Updating Password...' : 'Reset Password'}
                </button>
              </form>

              <div className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <Link to="/login">Cancel and return to Sign In</Link>
              </div>
            </>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(76, 175, 129, 0.15)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                margin: '0 auto 1.2rem auto'
              }}>
                ✓
              </div>
              <h2>Password Updated!</h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '0.75rem 0 1.5rem 0' }}>
                Your account password has been changed successfully. A security notification was delivered to your inbox.
              </p>
              <button
                className="btn-primary"
                onClick={() => navigate('/login')}
                style={{ width: '100%', padding: '0.65rem' }}
              >
                Sign In Now
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
