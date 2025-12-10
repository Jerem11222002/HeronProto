import React from 'react';
import PropTypes from 'prop-types';
import './loadingSpinner.scss';

const LoadingSpinner = ({ message = 'Loading...' }) => (
  <div className="loading-spinner" role="status" aria-label={message}>
    <div className="spinner"></div>
    {message && <p className="message">{message}</p>}
  </div>
);

LoadingSpinner.propTypes = {
  message: PropTypes.string
};

export default LoadingSpinner;
