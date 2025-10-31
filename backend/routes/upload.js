const express = require('express');
const multer = require('multer');
const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'backend/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

router.post('/media', upload.array('files'), (req, res) => {
  const files = req.files.map(file => ({
    name: file.originalname,
    url: `/uploads/${file.filename}`,
    type: file.mimetype
  }));
  res.json({ success: true, files });
});

module.exports = router;