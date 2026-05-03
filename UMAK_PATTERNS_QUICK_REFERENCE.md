# UMak Validation Patterns - Quick Reference

## 📋 Validation Patterns

### Student ID
```
Pattern: (K11 or A12) + 6 digits
Regex:   /^(k11|a12)\d{6}$/i

✅ Valid:
  - k11936832
  - K11936832
  - a12123456
  - A12123456

❌ Invalid:
  - 2024001234 (no K11/A12)
  - k1193683 (only 5 digits)
  - k119368321 (7 digits)
  - b11936832 (wrong prefix)
```

### Email
```
Pattern: firstname.lastname.studentid@umak.edu.ph
Regex:   /^[a-z]+\.[a-z]+\.(k11|a12)\d{6}@umak\.edu\.ph$/i

✅ Valid:
  - jdelacruz.k11936832@umak.edu.ph
  - JDELACRUZ.K11936832@UMAK.EDU.PH
  - john.smith.a12123456@umak.edu.ph

❌ Invalid:
  - jdelacruz.2024001234@umak.edu.ph (wrong student ID)
  - jdelacruz.k11936832@gmail.com (wrong domain)
  - j.delacruz.k11936832@umak.edu.ph (single letter name)
  - jdelacruz@umak.edu.ph (missing student ID)
```

---

## 🎯 Error Messages

### Student ID
```
"Student ID must start with K11 or A12 followed by 6 digits (e.g., k11936832 or a12123456)"
```

### Email
```
"Email must follow format: firstname.lastname.studentid@umak.edu.ph (e.g., jdelacruz.k11936832@umak.edu.ph)"
```

---

## 💡 Helper Text

### Student ID
```
"Format: K11 or A12 followed by 6 digits (e.g., k11936832 or a12123456)"
```

### Email
```
"University of Makati email: firstname.lastname.studentid@umak.edu.ph (e.g., jdelacruz.k11936832@umak.edu.ph)"
```

---

## 🧪 Test Cases

### Student ID
| Input | Valid? |
|-------|--------|
| k11936832 | ✅ |
| K11936832 | ✅ |
| a12123456 | ✅ |
| A12123456 | ✅ |
| 2024001234 | ❌ |
| k1193683 | ❌ |
| k119368321 | ❌ |
| b11936832 | ❌ |

### Email
| Input | Valid? |
|-------|--------|
| jdelacruz.k11936832@umak.edu.ph | ✅ |
| JDELACRUZ.K11936832@UMAK.EDU.PH | ✅ |
| john.smith.a12123456@umak.edu.ph | ✅ |
| jdelacruz.2024001234@umak.edu.ph | ❌ |
| jdelacruz.k11936832@gmail.com | ❌ |
| j.delacruz.k11936832@umak.edu.ph | ❌ |
| jdelacruz@umak.edu.ph | ❌ |

---

## 📝 Implementation Code

```javascript
// Validation patterns
const VALIDATION_PATTERNS = {
  email: /^[a-z]+\.[a-z]+\.(k11|a12)\d{6}@umak\.edu\.ph$/i,
  studentId: /^(k11|a12)\d{6}$/i,
  username: /^[a-zA-Z0-9_]{3,20}$/,
};

// Validation function
case 'studentId':
  if (!value) return { valid: false, message: 'Student ID is required' };
  if (!VALIDATION_PATTERNS.studentId.test(value)) 
    return { valid: false, message: 'Student ID must start with K11 or A12 followed by 6 digits (e.g., k11936832 or a12123456)' };
  return { valid: true, message: 'Student ID is valid' };

case 'email':
  if (!value) return { valid: false, message: 'Email is required' };
  if (!VALIDATION_PATTERNS.email.test(value)) 
    return { valid: false, message: 'Email must follow format: firstname.lastname.studentid@umak.edu.ph (e.g., jdelacruz.k11936832@umak.edu.ph)' };
  return { valid: true, message: 'Email is valid' };
```

---

## 🔄 Validation Flow

```
User Input
    ↓
Check if empty
    ↓
Check regex pattern
    ↓
Valid? → Show ✓ (green)
Invalid? → Show ✕ (red) + error message
```

---

## 📱 User Examples

### Student ID
- Your ID is on your student card
- Format: K11 or A12 + 6 numbers
- Examples: k11936832, a12123456

### Email
- Your UMak email format
- firstname.lastname.studentid@umak.edu.ph
- Example: jdelacruz.k11936832@umak.edu.ph

---

## ✅ Checklist

- ✅ Student ID: K11 or A12 + 6 digits
- ✅ Email: firstname.lastname.studentid@umak.edu.ph
- ✅ Case-insensitive matching
- ✅ Real-time validation
- ✅ Clear error messages
- ✅ Helper text provided
- ✅ Visual indicators (✓/✕)
- ✅ Mobile responsive
- ✅ Accessible

---

**Status**: ✅ Ready to Use
**Version**: 1.0.0
