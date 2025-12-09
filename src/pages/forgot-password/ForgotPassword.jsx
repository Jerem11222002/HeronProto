import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './forgotPassword.scss';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/auth/forgot-password', { email });

      setSuccess(response.data.message);
      setEmail('');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgotPassword">
      <div className="card">
        <h1>Forgot Password?</h1>
        <p>Enter your email and we'll send you a link to reset your password.</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading || !!success}
          />
          <button type="submit" disabled={loading || !!success}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="back-link">
          <a onClick={() => navigate('/login')}>Back to Login</a>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;