import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import './MessageSearch.scss';

const MessageSearch = ({ messages, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results = messages.filter((msg) =>
      msg.text?.toLowerCase().includes(query.toLowerCase())
    );

    setSearchResults(results);
  }, [messages]);

  return (
    <div className="message-search">
      <div className="search-header">
        <div className="search-input-wrapper">
          <SearchIcon className="search-icon" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
        </div>
        <button onClick={onClose} className="close-btn" title="Close search">
          <CloseIcon />
        </button>
      </div>

      <div className="search-results">
        {searchQuery && searchResults.length === 0 ? (
          <div className="no-results">No messages found</div>
        ) : searchResults.length > 0 ? (
          <div className="results-list">
            {searchResults.map((msg, idx) => (
              <div key={idx} className="search-result-item">
                <p className="result-text">{msg.text}</p>
                <span className="result-time">
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Start typing to search messages...</p>
          </div>
        )}
      </div>
    </div>
  );
};

MessageSearch.propTypes = {
  messages: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MessageSearch;
