import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/authContext";
import "./register.scss";
import umakLogo from "../../assets/umak-logo-black-r.png"; // <-- new import

// Gender options constant
const GENDER_OPTIONS = [
  { value: '', label: 'Select Gender' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' }
];

const Register = () => {
  const [username, setUsername] = useState("");
  const [studentId, setStudentId] = useState(""); // New state for student ID
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { setCurrentUser } = useContext(AuthContext);
  const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!gender) {
      setError("Please select your gender");
      setLoading(false);
      return;
    }

    if (!studentId) {
      setError("Please enter your Student ID Number");
      setLoading(false);
      return;
    }

    if (!acceptedTerms) {
      setError("You must accept the Terms and Conditions to register.");
      setLoading(false);
      return;
    }
  
    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username, 
          studentId, // Include studentId in request body
          email, 
          password, 
          name,
          gender
        }),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        const user = {
          ...data.user,
          interestsSelected: false,
          token: data.token
        };
  
        localStorage.setItem("token", data.token);
        localStorage.setItem("currentUser", JSON.stringify(user));
        setCurrentUser(user);
  
        navigate(`/interests/${user.id}`, { 
          state: { 
            userId: user.id,
            token: data.token 
          }
        });
  
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
          {/* left-panel shortcuts removed — shortcuts now shown in right panel for consistent UX */}
        </div>
        <div className="right">
          {/* panel logo centered above the heading */}
          <img src={umakLogo} alt="UMak Logo" className="school-logo panel-logo" />

          {/* panel-quick: visible on desktop and mobile (styles already present in register.scss) */}
          <div className="panel-quick">
            <span>Already have an account?</span>
            <button type="button" className="quick-login" onClick={() => navigate("/login")}>Login</button>
          </div>

          <h1>Register</h1>
          <form onSubmit={handleRegister}>
            <label htmlFor="usernameInput" className="sr-only">Username</label>
            <input
              id="usernameInput"
              name="username"
              aria-label="Username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <label htmlFor="studentIdInput" className="sr-only">Student ID Number</label>
            <input
              id="studentIdInput"
              name="studentId"
              aria-label="Student ID Number"
              type="text"
              placeholder="Student ID Number"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            />

            <label htmlFor="emailInput" className="sr-only">Email</label>
            <input
              id="emailInput"
              name="email"
              aria-label="Email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="passwordInput" className="sr-only">Password</label>
            <input
              id="passwordInput"
              name="password"
              aria-label="Password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <label htmlFor="nameInput" className="sr-only">Name</label>
            <input
              id="nameInput"
              name="name"
              aria-label="Name"
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

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
             <div className="terms-checkbox" style={{ margin: "10px 0" }}>
               <label>
                 <input
                   type="checkbox"
                   checked={acceptedTerms}
                   onChange={e => setAcceptedTerms(e.target.checked)}
                   required
                 />
                 <span style={{ marginLeft: 8 }}>
                   I pledge to use Heron Fusion responsibly and understand that my posts and actions are visible to others. I agree to the 
                   <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4, textDecoration: "underline" }}>
                     Terms and Conditions
                   </a>.
                 </span>
               </label>
             </div>
             {error && <div className="error">{error}</div>}
             <button type="submit" disabled={loading}>
               {loading ? "Registering..." : "Register"}
             </button>
           </form>
        </div>
      </div>
    </div>
  );
};

export default Register;