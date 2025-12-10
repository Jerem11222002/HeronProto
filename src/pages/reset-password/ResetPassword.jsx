import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './resetPassword.scss';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token] = useState(searchParams.get('token'));
  const [email] = useState(searchParams.get('email'));
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  // Verify token on mount
  useEffect(() => {
    if (!token || !email) {
      setError('Invalid reset link');
      setVerifying(false);
      return;
    }

    const verify = async () => {
      try {
        await axios.post('/api/auth/verify-reset-token', { token, email });
        setVerifying(false);
      } catch (err) {
        setError('Reset link has expired or is invalid. Please request a new one.');
        setVerifying(false);
      }
    };

    verify();
  }, [token, email]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.newPassword || !form.confirmPassword) {
      setError('Both password fields are required');
      return;
    }

    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/auth/reset-password', {
        token,
        email,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword
      });

      setSuccess(response.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="resetPassword">
        <div className="card">
          <p>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (error && verifying === false && !success) {
    return (
      <div className="resetPassword">
        <div className="card">
          <h1>Reset Password</h1>
          <div className="error-message">{error}</div>
          <p className="back-link">
            <a onClick={() => navigate('/forgot-password')}>Request a new reset link</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="resetPassword">
      <div className="card">
        <h1>Reset Your Password</h1>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            name="newPassword"
            placeholder="New Password"
            value={form.newPassword}
            onChange={handleChange}
            required
            disabled={loading || !!success}
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            disabled={loading || !!success}
          />
          <button type="submit" disabled={loading || !!success}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <p className="back-link">
          <a onClick={() => navigate('/login')}>Back to Login</a>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
