# Email Availability Check - Quick Summary

## ✅ What Changed

### Before
- Username availability checking
- Backend endpoint: `/api/auth/check-username`

### After
- Email availability checking
- Backend endpoint: `/api/auth/check-email`

---

## 📧 Email Availability Feature

### How It Works
1. User enters email: `jcarlo.k11936832@umak.edu.ph`
2. Format validation: ✓ Valid
3. Availability check: ⟳ Checking...
4. Result: ✓ Available or ✕ Already registered

### Visual States

**Checking:**
```
[jcarlo.k11936832@umak.edu.ph] ⟳
⟳ Checking availability...
```

**Available:**
```
[jcarlo.k11936832@umak.edu.ph] ✓
✓ Email is available
```

**Taken:**
```
[jcarlo.k11936832@umak.edu.ph] ✕
✕ Email is already registered
```

---

## 🔌 Backend Endpoint

**POST /api/auth/check-email**

Request:
```json
{ "email": "jcarlo.k11936832@umak.edu.ph" }
```

Response (Available):
```json
{ "available": true }
```

Response (Taken):
```json
{ "available": false }
```

---

## 💻 Backend Implementation

### Node.js
```javascript
app.post('/api/auth/check-email', async (req, res) => {
  const { email } = req.body;
  
  // Validate format
  if (!/^[a-z]+\.(k11|a12)\d{6}@umak\.edu\.ph$/i.test(email)) {
    return res.status(400).json({ available: false });
  }
  
  // Check database
  const exists = await User.findOne({ email: email.toLowerCase() });
  
  return res.json({ available: !exists });
});
```

### Python
```python
@app.route('/api/auth/check-email', methods=['POST'])
def check_email():
    email = request.json.get('email', '').strip()
    
    # Validate format
    if not re.match(r'^[a-z]+\.(k11|a12)\d{6}@umak\.edu\.ph$', email, re.IGNORECASE):
        return jsonify({'available': False}), 400
    
    # Check database
    exists = User.query.filter_by(email=email.lower()).first()
    
    return jsonify({'available': not exists})
```

### Java
```java
@PostMapping("/check-email")
public ResponseEntity<?> checkEmail(@RequestBody EmailCheckRequest request) {
    String email = request.getEmail();
    
    // Validate format
    if (!email.matches("^[a-z]+\\.(k11|a12)\\d{6}@umak\\.edu\\.ph$")) {
        return ResponseEntity.badRequest().body(new EmailCheckResponse(false, "Invalid format"));
    }
    
    // Check database
    Optional<User> exists = userRepository.findByEmailIgnoreCase(email);
    
    return ResponseEntity.ok(new EmailCheckResponse(!exists.isPresent(), ""));
}
```

---

## 🧪 Test Cases

| Email | Format Valid? | Available? | Can Register? |
|-------|---------------|-----------|---------------|
| jcarlo.k11936832@umak.edu.ph | ✅ | ✅ | ✅ |
| jcarlo.k11936832@umak.edu.ph | ✅ | ❌ | ❌ |
| jdelacruz.k11936832@umak.edu.ph | ❌ | N/A | ❌ |
| jcarlo.2024001234@umak.edu.ph | ❌ | N/A | ❌ |
| jcarlo.k11936832@gmail.com | ❌ | N/A | ❌ |

---

## 📝 Error Messages

**Format Error:**
```
"Email must follow format: firstinitial+lastname.studentid@umak.edu.ph (e.g., jcarlo.k11936832@umak.edu.ph)"
```

**Already Registered:**
```
"Email is not available. Please use a different email address."
```

---

## 🔐 Security

- ✅ Input validation
- ✅ Format enforcement
- ✅ Rate limiting (recommended)
- ✅ Case-insensitive checking
- ✅ Database indexing (recommended)

---

## 📊 Files Modified

1. `src/pages/register/Register.jsx`
   - Changed from username to email availability checking
   - Updated state management
   - Updated API endpoint
   - Updated UI components

---

## ✅ Deployment Checklist

- ✅ Frontend code updated
- ✅ Code compiles without errors
- ✅ No console warnings
- ⏳ Backend endpoint required: `/api/auth/check-email`
- ⏳ Database index recommended
- ⏳ Rate limiting recommended
- ⏳ Testing required

---

**Status**: ✅ Ready for Backend Implementation
**Version**: 1.0.0
**Backend Endpoint**: POST /api/auth/check-email
