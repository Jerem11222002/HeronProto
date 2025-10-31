import React from 'react';
import { useNavigate } from 'react-router-dom';
import './styles.scss';

const RegistrationConfirmation = ({ 
  type = 'general',
  eventName,
  registrationId,
  userName,
  emailSent = true,
  message,
  onClose
}) => {
  const navigate = useNavigate();

  const getConfirmationMessage = () => {
    switch(type) {
      case 'audition':
        return `Your audition registration for ${eventName} has been received. Our team will review your application and contact you with further details.`;
      case 'audience':
        return `Thank you for registering to watch ${eventName}! Your spot has been reserved.`;
      default:
        return message || 'Your registration has been received.';
    }
  };

  return (
    <div className="registration-confirmation">
      <div className="confirmation-content">
        <div className="confirmation-icon">
          <i className="fas fa-check-circle"></i>
        </div>
        
        <h2>Registration Successful!</h2>
        <p className="confirmation-message">{getConfirmationMessage()}</p>
        
        <div className="confirmation-details">
          <p>Registration ID: {registrationId}</p>
          <p>Name: {userName}</p>
          {emailSent && (
            <p className="email-notice">
              A confirmation email has been sent to your registered email address
            </p>
          )}
        </div>

        <div className="confirmation-actions">
          <button 
            className="btn-primary"
            onClick={() => navigate('/events')}
          >
            Back to Events
          </button>
          <button 
            className="btn-secondary"
            onClick={() => navigate('/dashboard')}
          >
            View My Registrations
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationConfirmation;