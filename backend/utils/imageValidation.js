const validateImageFile = (req, file, cb) => {
    // Allowed file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    // Check file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (req.headers['content-length'] > maxSize) {
      cb(new Error('File size too large. Maximum size is 5MB'), false);
      return;
    }
  
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Only .jpg, .jpeg, .png, and .webp formats are allowed'), false);
      return;
    }
    
    cb(null, true);
  };
  
  const getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
  };
  
  module.exports = {
    validateImageFile,
    getFileExtension
  };