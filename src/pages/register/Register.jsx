import { useState, useContext, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/authContext";
import { DarkModeContext } from "../../context/darkModeContext";
import "./register.scss";
import umakLogo from "../../assets/umak-logo-black-r.png"; // <-- new import

// Gender options constant
const GENDER_OPTIONS = [
  { value: '', label: 'Select Gender' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' }
];

// Validation patterns
const VALIDATION_PATTERNS = {
  // University of Makati email: firstinitial+lastname.studentid@umak.edu.ph
  // Example: jcarlo.k11936832@umak.edu.ph (john carlo + k11936832)
  email: /^[a-z]+\.(k11|a12)\d{6}@umak\.edu\.ph$/i,
  // Student ID: starts with k11 or a12 followed by 6 digits
  // Example: k11936832 or a12123456
  studentId: /^(k11|a12)\d{6}$/i,
  username: /^[a-zA-Z0-9_]{3,20}$/,
};

// Password strength evaluator
const evaluatePasswordStrength = (password) => {
  if (!password) return { score: 0, label: 'None', color: '#e1e5e9' };
  
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
  
  const levels = [
    { score: 0, label: 'None', color: '#e1e5e9' },
    { score: 1, label: 'Weak', color: '#dc3545' },
    { score: 2, label: 'Fair', color: '#fd7e14' },
    { score: 3, label: 'Good', color: '#ffc107' },
    { score: 4, label: 'Strong', color: '#28a745' },
    { score: 5, label: 'Very Strong', color: '#20c997' }
  ];
  
  return levels[Math.min(score, 5)];
};

const Register = () => {
  const [username, setUsername] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Validation states
  const [validations, setValidations] = useState({
    username: null,
    studentId: null,
    email: null,
    password: null,
    name: null,
  });
  
  const [touched, setTouched] = useState({
    username: false,
    studentId: false,
    email: false,
    password: false,
    name: false,
  });
  
  const [emailAvailable, setEmailAvailable] = useState(null); // null = not checked, true = available, false = taken
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null); // null = not checked, true = available, false = taken
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckId = useRef(0);
  const emailCheckId = useRef(0);
  const firstInvalidFieldRef = useRef(null);
  const passwordStrength = evaluatePasswordStrength(password);

  const { setCurrentUser } = useContext(AuthContext);
  const { setDarkMode } = useContext(DarkModeContext);
  const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  useEffect(() => {
    if (!username || !VALIDATION_PATTERNS.username.test(username)) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(username);
    }, 450);

    return () => clearTimeout(timer);
  }, [username]);

  useEffect(() => {
    if (!email || !VALIDATION_PATTERNS.email.test(email)) {
      setEmailAvailable(null);
      return;
    }

    const timer = setTimeout(() => {
      checkEmailAvailability(email);
    }, 450);

    return () => clearTimeout(timer);
  }, [email]);

  // Validation functions
  const validateField = (fieldName, value) => {
    switch (fieldName) {
      case 'username':
        if (!value) return { valid: false, message: 'Username is required' };
        if (value.length < 3) return { valid: false, message: 'Username must be at least 3 characters' };
        if (value.length > 20) return { valid: false, message: 'Username must be at most 20 characters' };
        if (!VALIDATION_PATTERNS.username.test(value)) return { valid: false, message: 'Username can only contain letters, numbers, and underscores' };
        // Note: Availability check is done separately via checkEmailAvailability()
        return { valid: true, message: 'Username format is valid' };
      
      case 'email':
        if (!value) return { valid: false, message: 'Email is required' };
        if (!VALIDATION_PATTERNS.email.test(value)) return { valid: false, message: 'Email must follow format: firstinitial+lastname.studentid@umak.edu.ph (e.g., jcarlo.k11936832@umak.edu.ph)' };
        // Note: Availability check is done separately via checkEmailAvailability()
        return { valid: true, message: 'Email format is valid' };
      
      case 'password':
        if (!value) return { valid: false, message: 'Password is required' };
        if (value.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
        return { valid: true, message: 'Password meets requirements' };
      
      case 'studentId':
        if (!value) return { valid: false, message: 'Student ID is required' };
        if (!VALIDATION_PATTERNS.studentId.test(value)) return { valid: false, message: 'Student ID must start with K11 or A12 followed by 6 digits (e.g., k11936832 or a12123456)' };
        return { valid: true, message: 'Student ID is valid' };
      
      case 'name':
        if (!value) return { valid: false, message: 'Name is required' };
        if (value.length < 2) return { valid: false, message: 'Name must be at least 2 characters' };
        return { valid: true, message: 'Name looks good' };
      
      default:
        return { valid: false, message: '' };
    }
  };

  // Check email availability
  const checkEmailAvailability = async (emailValue) => {
    if (!emailValue || !VALIDATION_PATTERNS.email.test(emailValue)) {
      setEmailAvailable(null);
      return;
    }

    const currentRequestId = ++emailCheckId.current;
    setCheckingEmail(true);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue }),
      });

      if (response.status === 401) {
        console.warn('Availability check requires backend configuration');
        if (currentRequestId === emailCheckId.current) setEmailAvailable(null);
        setCheckingEmail(false);
        return;
      }

      const data = await response.json();
      if (currentRequestId === emailCheckId.current) {
        setEmailAvailable(data.available === true);
      }
    } catch (err) {
      console.error('Error checking email availability:', err);
      if (currentRequestId === emailCheckId.current) setEmailAvailable(null);
    } finally {
      if (currentRequestId === emailCheckId.current) setCheckingEmail(false);
    }
  };

  // Check username availability
  const checkUsernameAvailability = async (usernameValue) => {
    if (!usernameValue || !VALIDATION_PATTERNS.username.test(usernameValue)) {
      setUsernameAvailable(null);
      return;
    }

    const currentRequestId = ++usernameCheckId.current;
    setCheckingUsername(true);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameValue }),
      });

      if (response.status === 401) {
        console.warn('Availability check requires backend configuration');
        if (currentRequestId === usernameCheckId.current) setUsernameAvailable(null);
        setCheckingUsername(false);
        return;
      }

      const data = await response.json();
      if (currentRequestId === usernameCheckId.current) {
        setUsernameAvailable(data.available === true);
      }
    } catch (err) {
      console.error('Error checking username availability:', err);
      if (currentRequestId === usernameCheckId.current) setUsernameAvailable(null);
    } finally {
      if (currentRequestId === usernameCheckId.current) setCheckingUsername(false);
    }
  };

  // Handle field changes with validation
  const handleFieldChange = (fieldName, value, setter) => {
    setter(value);
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));

    const validation = validateField(fieldName, value);
    setValidations(prev => ({
      ...prev,
      [fieldName]: validation
    }));

    // Reset availability state for invalid or empty fields
    if (fieldName === 'username' && (!value || !VALIDATION_PATTERNS.username.test(value))) {
      setUsernameAvailable(null);
    }

    if (fieldName === 'email' && (!value || !VALIDATION_PATTERNS.email.test(value))) {
      setEmailAvailable(null);
    }
  };

  // Handle field blur
  const handleFieldBlur = (fieldName) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));
    const validation = validateField(fieldName, 
      fieldName === 'username' ? username :
      fieldName === 'email' ? email :
      fieldName === 'password' ? password :
      fieldName === 'studentId' ? studentId :
      fieldName === 'name' ? name : ''
    );
    setValidations(prev => ({
      ...prev,
      [fieldName]: validation
    }));
  };

  // Check if form is valid
  const isFormValid = () => {
    return (
      validations.username?.valid &&
      // Only require username availability if check is working (not null means it was checked)
      (usernameAvailable === true || usernameAvailable === null) &&
      validations.email?.valid &&
      // Only require email availability if check is working (not null means it was checked)
      (emailAvailable === true || emailAvailable === null) &&
      validations.password?.valid &&
      validations.studentId?.valid &&
      validations.name?.valid &&
      gender &&
      acceptedTerms
    );
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate all fields
    const newValidations = {
      username: validateField('username', username),
      email: validateField('email', email),
      password: validateField('password', password),
      studentId: validateField('studentId', studentId),
      name: validateField('name', name),
    };

    setValidations(newValidations);
    setTouched({
      username: true,
      email: true,
      password: true,
      studentId: true,
      name: true,
    });

    // Check for invalid fields
    const invalidFields = Object.entries(newValidations)
      .filter(([_, validation]) => !validation.valid)
      .map(([fieldName, _]) => fieldName);

    if (invalidFields.length > 0) {
      setError(`Please fix the errors in: ${invalidFields.join(', ')}`);
      // Focus on first invalid field
      if (firstInvalidFieldRef.current) {
        firstInvalidFieldRef.current.focus();
      }
      return;
    }

    // Check username availability (if it was checked)
    if (usernameAvailable === false) {
      setError('Username is not available. Please choose a different username.');
      return;
    }

    // Check email availability (if it was checked)
    if (emailAvailable === false) {
      setError('Email is not available. Please use a different email address.');
      return;
    }

    if (!gender) {
      setError("Please select your gender");
      return;
    }

    if (!acceptedTerms) {
      setError("You must accept the Terms and Conditions to register.");
      return;
    }
  
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username, 
          studentId,
          email, 
          password, 
          name,
          gender
        }),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        setSuccess(true);
        const user = {
          ...data.user,
          interestsSelected: false,
          token: data.token
        };
  
        localStorage.setItem("token", data.token);
        localStorage.setItem("currentUser", JSON.stringify(user));
        localStorage.setItem("theme", "light");
        localStorage.setItem("darkMode", "false");
        if (setDarkMode) setDarkMode(false);
        setCurrentUser(user);
  
        // Redirect after success animation
        setTimeout(() => {
          navigate(`/interests/${user.id}`, { 
            state: { 
              userId: user.id,
              token: data.token 
            }
          });
        }, 1500);
  
      } else {
        throw new Error(data.message || "Registration failed");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="register">
      <div className="card">
        <div className="left">
          <h1>Heron Fusion</h1>
          <p>Showcase your talent and connect with others!</p>
          <div className="benefits-section">
            <h3>Why Join?</h3>
            <ul className="benefits-list">
              <li>✨ Connect with talented peers</li>
              <li>🎨 Showcase your Artistic Talent</li>
              <li>🎯 Join exclusive events</li>
              <li>🌟 Show your support with other artists</li>
            </ul>
          </div>
        </div>
        <div className="right">
          <img src={umakLogo} alt="UMak Logo" className="school-logo panel-logo" />

          <div className="panel-quick">
            <span>Already have an account?</span>
            <button type="button" className="quick-login" onClick={() => navigate("/login")}>Login</button>
          </div>

          <h1>Register</h1>
          
          {success ? (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <h2>Welcome to Heron Fusion!</h2>
              <p>Your account has been created successfully.</p>
              <p className="redirect-text">Redirecting to interests selection...</p>
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <form onSubmit={handleRegister}>
              {/* Username Field */}
              <div className="form-group">
                <label htmlFor="usernameInput" className="sr-only">Username</label>
                <div className="input-wrapper">
                  <input
                    ref={!validations.username?.valid && touched.username ? firstInvalidFieldRef : null}
                    id="usernameInput"
                    name="username"
                    aria-label="Username"
                    aria-describedby="usernameHelp usernameError usernameStatus"
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => handleFieldChange('username', e.target.value, setUsername)}
                    onBlur={() => handleFieldBlur('username')}
                    required
                    className={touched.username ? (validations.username?.valid ? 'valid' : 'invalid') : ''}
                  />
                  {touched.username && (
                    <span className={`validation-icon ${validations.username?.valid ? 'valid' : 'invalid'}`}>
                      {validations.username?.valid ? '✓' : '✕'}
                    </span>
                  )}
                </div>
                {touched.username && (
                  <p id="usernameError" className={`field-message ${validations.username?.valid ? 'success' : 'error'}`}>
                    {validations.username?.message}
                  </p>
                )}
                {touched.username && validations.username?.valid && usernameAvailable !== null && (
                  <p id="usernameStatus" className={`field-message ${checkingUsername ? 'info' : usernameAvailable === true ? 'success' : usernameAvailable === false ? 'error' : 'info'}`}>
                    {checkingUsername ? '⟳ Checking availability...' : usernameAvailable === true ? '✓ Username is available' : usernameAvailable === false ? '✕ Username is already taken' : ''}
                  </p>
                )}
                <p id="usernameHelp" className="helper-text">3-20 characters, letters, numbers, and underscores only</p>
              </div>

              {/* Student ID Field */}
              <div className="form-group">
                <label htmlFor="studentIdInput" className="sr-only">Student ID Number</label>
                <div className="input-wrapper">
                  <input
                    ref={!validations.studentId?.valid && touched.studentId ? firstInvalidFieldRef : null}
                    id="studentIdInput"
                    name="studentId"
                    aria-label="Student ID Number"
                    aria-describedby="studentIdHelp studentIdError"
                    type="text"
                    placeholder="Student ID Number"
                    value={studentId}
                    onChange={(e) => handleFieldChange('studentId', e.target.value, setStudentId)}
                    onBlur={() => handleFieldBlur('studentId')}
                    required
                    className={touched.studentId ? (validations.studentId?.valid ? 'valid' : 'invalid') : ''}
                  />
                  {touched.studentId && (
                    <span className={`validation-icon ${validations.studentId?.valid ? 'valid' : 'invalid'}`}>
                      {validations.studentId?.valid ? '✓' : '✕'}
                    </span>
                  )}
                </div>
                {touched.studentId && (
                  <p id="studentIdError" className={`field-message ${validations.studentId?.valid ? 'success' : 'error'}`}>
                    {validations.studentId?.message}
                  </p>
                )}
                <p id="studentIdHelp" className="helper-text">Format: K11 or A12 followed by 6 digits (e.g., k11936832 or a12123456)</p>
              </div>

              {/* Email Field */}
              <div className="form-group">
                <label htmlFor="emailInput" className="sr-only">Email</label>
                <div className="input-wrapper">
                  <input
                    ref={!validations.email?.valid && touched.email ? firstInvalidFieldRef : null}
                    id="emailInput"
                    name="email"
                    aria-label="Email"
                    aria-describedby="emailHelp emailError emailStatus"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => handleFieldChange('email', e.target.value, setEmail)}
                    onBlur={() => handleFieldBlur('email')}
                    required
                    className={touched.email ? (validations.email?.valid ? 'valid' : 'invalid') : ''}
                  />
                  {touched.email && validations.email?.valid && (
                    <span className="validation-icon">
                      {checkingEmail ? (
                        <span className="checking-spinner" title="Checking availability...">⟳</span>
                      ) : emailAvailable === true ? (
                        <span className="valid" title="Email available">✓</span>
                      ) : emailAvailable === false ? (
                        <span className="invalid" title="Email taken">✕</span>
                      ) : null}
                    </span>
                  )}
                </div>
                {touched.email && (
                  <p id="emailError" className={`field-message ${validations.email?.valid ? 'success' : 'error'}`}>
                    {validations.email?.message}
                  </p>
                )}
                {touched.email && validations.email?.valid && (
                  <p id="emailStatus" className={`field-message ${emailAvailable === true ? 'success' : emailAvailable === false ? 'error' : 'info'}`}>
                    {checkingEmail ? '⟳ Checking availability...' : emailAvailable === true ? '✓ Email is available' : emailAvailable === false ? '✕ Email is already registered' : ''}
                  </p>
                )}
                <p id="emailHelp" className="helper-text">University of Makati email: firstinitial+lastname.studentid@umak.edu.ph (e.g., jcarlo.k11936832@umak.edu.ph)</p>
              </div>

              {/* Password Field */}
              <div className="form-group">
                <label htmlFor="passwordInput" className="sr-only">Password</label>
                <div className="input-wrapper">
                  <input
                    ref={!validations.password?.valid && touched.password ? firstInvalidFieldRef : null}
                    id="passwordInput"
                    name="password"
                    aria-label="Password"
                    aria-describedby="passwordHelp passwordError passwordStrength"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => handleFieldChange('password', e.target.value, setPassword)}
                    onBlur={() => handleFieldBlur('password')}
                    required
                    className={touched.password ? (validations.password?.valid ? 'valid' : 'invalid') : ''}
                  />
                  {touched.password && (
                    <span className={`validation-icon ${validations.password?.valid ? 'valid' : 'invalid'}`}>
                      {validations.password?.valid ? '✓' : '✕'}
                    </span>
                  )}
                </div>
                {password && (
                  <div className="password-strength">
                    <div className="strength-bar">
                      <div 
                        className="strength-fill" 
                        style={{ 
                          width: `${(passwordStrength.score / 5) * 100}%`,
                          backgroundColor: passwordStrength.color
                        }}
                      ></div>
                    </div>
                    <p id="passwordStrength" className="strength-label" style={{ color: passwordStrength.color }}>
                      Strength: <strong>{passwordStrength.label}</strong>
                    </p>
                  </div>
                )}
                {touched.password && (
                  <p id="passwordError" className={`field-message ${validations.password?.valid ? 'success' : 'error'}`}>
                    {validations.password?.message}
                  </p>
                )}
                <p id="passwordHelp" className="helper-text">At least 8 characters. Mix uppercase, lowercase, numbers, and symbols for stronger security</p>
              </div>

              {/* Name Field */}
              <div className="form-group">
                <label htmlFor="nameInput" className="sr-only">Full Name</label>
                <div className="input-wrapper">
                  <input
                    ref={!validations.name?.valid && touched.name ? firstInvalidFieldRef : null}
                    id="nameInput"
                    name="name"
                    aria-label="Full Name"
                    aria-describedby="nameHelp nameError"
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => handleFieldChange('name', e.target.value, setName)}
                    onBlur={() => handleFieldBlur('name')}
                    required
                    className={touched.name ? (validations.name?.valid ? 'valid' : 'invalid') : ''}
                  />
                  {touched.name && (
                    <span className={`validation-icon ${validations.name?.valid ? 'valid' : 'invalid'}`}>
                      {validations.name?.valid ? '✓' : '✕'}
                    </span>
                  )}
                </div>
                {touched.name && (
                  <p id="nameError" className={`field-message ${validations.name?.valid ? 'success' : 'error'}`}>
                    {validations.name?.message}
                  </p>
                )}
                <p id="nameHelp" className="helper-text">Your display name on the platform</p>
              </div>

              {/* Gender Select */}
              <div className="form-group">
                <label htmlFor="genderSelect" className="sr-only">Gender</label>
                <select
                  id="genderSelect"
                  name="gender"
                  aria-label="Gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="gender-select"
                >
                  {GENDER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Terms Checkbox */}
              <div className="terms-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    aria-describedby="termsDescription"
                    required
                  />
                  <span id="termsDescription">
                    I pledge to use Heron Fusion responsibly and understand that my posts and actions are visible to others. I agree to the 
                    <a href="/terms" target="_blank" rel="noopener noreferrer">
                      Terms and Conditions
                    </a>.
                  </span>
                </label>
              </div>

              {/* Quick Links */}
              <div className="quick-links">
                <a href="/faq" target="_blank" rel="noopener noreferrer">FAQ</a>
                <span className="divider">•</span>
                <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                <span className="divider">•</span>
                <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
              </div>

              {/* Error Message */}
              {error && <div className="error">{error}</div>}

              {/* Submit Button */}
              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? (
                  <>
                    <span className="button-spinner"></span>
                    Registering...
                  </>
                ) : (
                  'Register'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;