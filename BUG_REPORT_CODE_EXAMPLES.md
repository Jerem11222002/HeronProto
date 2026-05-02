# Bug Report Feature - Code Examples & Snippets

## Component Usage Examples

### Basic Usage in Settings Page

```jsx
import BugReportModal from '../../components/BugReportModal/BugReportModal';
import BugReportHistory from '../../components/BugReportHistory/BugReportHistory';

export default function Settings() {
  const [bugModalOpen, setBugModalOpen] = useState(false);
  const [bugReports, setBugReports] = useState([]);
  const [bugSubmitLoading, setBugSubmitLoading] = useState(false);
  const [bugSubmitSuccess, setBugSubmitSuccess] = useState('');
  const [bugSubmitError, setBugSubmitError] = useState('');

  const submitBugReport = async (reportData) => {
    setBugSubmitLoading(true);
    setBugSubmitSuccess('');
    setBugSubmitError('');
    
    try {
      const res = await fetch(`${API_BASE}/api/bug-reports`, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          ...getAuthHeaders(), 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          title: reportData.title,
          description: reportData.description,
          category: reportData.category,
          severity: reportData.severity,
          pageUrl: window.location.href
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setBugSubmitSuccess('Bug report submitted successfully!');
        
        // Refresh reports
        const bugRes = await fetch(`${API_BASE}/api/bug-reports/my-reports`, {
          credentials: 'include',
          headers: getAuthHeaders()
        });
        
        if (bugRes.ok) {
          const bugData = await bugRes.json();
          if (bugData.success) setBugReports(bugData.reports || []);
        }
        
        // Close modal after success
        setTimeout(() => {
          setBugModalOpen(false);
          setBugSubmitSuccess('');
        }, 2000);
      } else {
        setBugSubmitError(data.message || 'Failed to submit bug report');
      }
    } catch (err) {
      setBugSubmitError('Network error: ' + err.message);
    } finally {
      setBugSubmitLoading(false);
    }
  };

  return (
    <div className="settings">
      {/* Other settings sections... */}
      
      {/* Bug Report Section */}
      <section className="bug-report-section">
        <button 
          onClick={() => setBugModalOpen(true)}
          className="open-modal-btn"
        >
          <span className="btn-icon">📤</span>
          <span className="btn-text">Report a Bug</span>
        </button>
        
        <BugReportHistory reports={bugReports} />
      </section>

      {/* Modal */}
      <BugReportModal
        isOpen={bugModalOpen}
        onClose={() => setBugModalOpen(false)}
        onSubmit={submitBugReport}
        isLoading={bugSubmitLoading}
        successMessage={bugSubmitSuccess}
        errorMessage={bugSubmitError}
      />
    </div>
  );
}
```

## Advanced Usage Examples

### Custom Styling

```jsx
// Override default styles with CSS modules
import styles from './CustomBugReport.module.scss';

<BugReportModal
  isOpen={isOpen}
  onClose={onClose}
  onSubmit={onSubmit}
  className={styles.customModal}
/>
```

### With Custom Error Handling

```jsx
const submitBugReport = async (reportData) => {
  try {
    const res = await fetch('/api/bug-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    });

    if (!res.ok) {
      if (res.status === 400) {
        throw new Error('Invalid report data');
      } else if (res.status === 401) {
        throw new Error('Please log in to submit a report');
      } else if (res.status === 429) {
        throw new Error('Too many reports. Please try again later.');
      } else {
        throw new Error('Server error. Please try again.');
      }
    }

    const data = await res.json();
    
    if (data.success) {
      // Handle success
      onSuccess(data.report);
    } else {
      throw new Error(data.message || 'Unknown error');
    }
  } catch (error) {
    onError(error.message);
  }
};
```

### With Report Filtering

```jsx
// Filter reports by severity
const criticalReports = bugReports.filter(r => r.severity === 'critical');

// Filter reports by status
const pendingReports = bugReports.filter(r => r.status === 'pending');

// Filter reports by category
const bugReports = bugReports.filter(r => r.category === 'bug');

// Combine filters
const criticalBugs = bugReports.filter(
  r => r.severity === 'critical' && r.category === 'bug'
);
```

### With Report Statistics

```jsx
// Calculate report statistics
const reportStats = {
  total: bugReports.length,
  pending: bugReports.filter(r => r.status === 'pending').length,
  inProgress: bugReports.filter(r => r.status === 'in-progress').length,
  resolved: bugReports.filter(r => r.status === 'resolved').length,
  critical: bugReports.filter(r => r.severity === 'critical').length,
  byCategory: {
    bug: bugReports.filter(r => r.category === 'bug').length,
    ui: bugReports.filter(r => r.category === 'ui').length,
    performance: bugReports.filter(r => r.category === 'performance').length,
    security: bugReports.filter(r => r.category === 'security').length,
    feature: bugReports.filter(r => r.category === 'feature').length,
    other: bugReports.filter(r => r.category === 'other').length
  }
};
```

## Form Validation Examples

### Custom Validation

```jsx
// Validate title
const validateTitle = (title) => {
  if (!title.trim()) return 'Title is required';
  if (title.length < 5) return 'Title must be at least 5 characters';
  if (title.length > 200) return 'Title must not exceed 200 characters';
  if (!/^[a-zA-Z0-9\s\-.,!?()]+$/.test(title)) {
    return 'Title contains invalid characters';
  }
  return null;
};

// Validate description
const validateDescription = (description) => {
  if (!description.trim()) return 'Description is required';
  if (description.length < 10) return 'Description must be at least 10 characters';
  if (description.length > 5000) return 'Description must not exceed 5000 characters';
  return null;
};

// Validate entire form
const validateForm = (formData) => {
  const errors = {};
  
  const titleError = validateTitle(formData.title);
  if (titleError) errors.title = titleError;
  
  const descError = validateDescription(formData.description);
  if (descError) errors.description = descError;
  
  return errors;
};
```

## API Integration Examples

### Backend Endpoint Implementation (Node.js/Express)

```javascript
// POST /api/bug-reports
router.post('/bug-reports', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, severity, pageUrl } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!title || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and description are required' 
      });
    }

    // Create bug report
    const bugReport = new BugReport({
      userId,
      title: title.trim(),
      description: description.trim(),
      category,
      severity,
      pageUrl,
      status: 'pending',
      createdAt: new Date()
    });

    await bugReport.save();

    // Send notification email
    await sendBugReportNotification(userId, bugReport);

    res.json({
      success: true,
      message: 'Bug report submitted successfully',
      report: bugReport
    });
  } catch (error) {
    console.error('Error submitting bug report:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit bug report' 
    });
  }
});

// GET /api/bug-reports/my-reports
router.get('/bug-reports/my-reports', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const reports = await BugReport.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch bug reports' 
    });
  }
});
```

## Styling Examples

### Custom Modal Styling

```scss
// Override modal styling
.custom-bug-report-modal {
  .bug-report-modal {
    max-width: 700px; // Wider modal
    
    .modal-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      
      h2 {
        color: white;
      }
    }
    
    .modal-form {
      .form-group {
        label {
          color: #667eea;
          font-weight: 700;
        }
      }
    }
    
    .modal-actions {
      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
    }
  }
}
```

### Custom History Styling

```scss
// Override history styling
.custom-bug-report-history {
  .bug-report-history {
    .report-card {
      border-left: 4px solid #667eea;
      
      &:hover {
        border-left-color: #764ba2;
        box-shadow: 0 8px 16px rgba(102, 126, 234, 0.2);
      }
    }
    
    .status-badge {
      border-radius: 20px;
      padding: 6px 14px;
    }
  }
}
```

## Testing Examples

### Unit Tests (Jest)

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import BugReportModal from './BugReportModal';

describe('BugReportModal', () => {
  it('renders modal when isOpen is true', () => {
    render(<BugReportModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Submit Bug Report')).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    render(<BugReportModal isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText('Submit Bug Report')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<BugReportModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables submit button when form is invalid', () => {
    render(<BugReportModal isOpen={true} onClose={() => {}} />);
    const submitBtn = screen.getByText('Submit Report');
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button when form is valid', () => {
    render(<BugReportModal isOpen={true} onClose={() => {}} />);
    const titleInput = screen.getByPlaceholderText('Brief description of the issue');
    const descInput = screen.getByPlaceholderText(/Please describe the issue/);
    
    fireEvent.change(titleInput, { target: { value: 'Test Title' } });
    fireEvent.change(descInput, { target: { value: 'Test Description' } });
    
    const submitBtn = screen.getByText('Submit Report');
    expect(submitBtn).not.toBeDisabled();
  });
});
```

### Integration Tests

```javascript
describe('Bug Report Feature Integration', () => {
  it('submits bug report and updates history', async () => {
    const { getByText, getByPlaceholderText } = render(<Settings />);
    
    // Open modal
    fireEvent.click(getByText('Report a Bug'));
    
    // Fill form
    fireEvent.change(getByPlaceholderText('Brief description of the issue'), {
      target: { value: 'Test Bug Title' }
    });
    fireEvent.change(getByPlaceholderText(/Please describe the issue/), {
      target: { value: 'This is a test bug description' }
    });
    
    // Submit
    fireEvent.click(getByText('Submit Report'));
    
    // Wait for success message
    await waitFor(() => {
      expect(getByText(/Bug report submitted successfully/)).toBeInTheDocument();
    });
    
    // Verify report appears in history
    await waitFor(() => {
      expect(getByText('Test Bug Title')).toBeInTheDocument();
    });
  });
});
```

## Accessibility Examples

### Keyboard Navigation

```jsx
// Handle keyboard events
const handleKeyDown = (e) => {
  if (e.key === 'Escape') {
    onClose();
  }
  if (e.key === 'Enter' && e.ctrlKey) {
    // Submit form with Ctrl+Enter
    handleSubmit();
  }
};

// Add to modal
<div onKeyDown={handleKeyDown}>
  {/* Modal content */}
</div>
```

### ARIA Labels

```jsx
// Proper ARIA labels
<button
  type="button"
  className="close-btn"
  onClick={handleClose}
  aria-label="Close bug report modal"
  title="Close"
>
  <Close size={24} />
</button>

// Form with ARIA
<input
  id="title"
  type="text"
  aria-label="Bug report title"
  aria-required="true"
  aria-invalid={!!errors.title}
  aria-describedby={errors.title ? 'title-error' : 'title-counter'}
/>
```

## Performance Optimization Examples

### Memoization

```jsx
import { useMemo } from 'react';

const BugReportHistory = ({ reports }) => {
  // Memoize filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter(r => r.status === filterStatus);
  }, [reports, filterStatus]);

  return (
    <div>
      {filteredReports.map(report => (
        <ReportCard key={report._id} report={report} />
      ))}
    </div>
  );
};
```

### Lazy Loading

```jsx
import { lazy, Suspense } from 'react';

const BugReportModal = lazy(() => import('./BugReportModal'));

// Usage
<Suspense fallback={<div>Loading...</div>}>
  <BugReportModal isOpen={isOpen} onClose={onClose} />
</Suspense>
```

## Error Handling Examples

### Try-Catch Pattern

```jsx
const submitBugReport = async (reportData) => {
  try {
    const response = await fetch('/api/bug-reports', {
      method: 'POST',
      body: JSON.stringify(reportData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
```

### Error Boundary

```jsx
class BugReportErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Bug Report Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Error loading bug report feature</div>;
    }

    return this.props.children;
  }
}

// Usage
<BugReportErrorBoundary>
  <BugReportModal {...props} />
</BugReportErrorBoundary>
```

---

These examples demonstrate various ways to use, customize, test, and optimize the Bug Report feature components.
