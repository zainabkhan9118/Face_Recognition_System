const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Use the original filename without adding timestamp
    const name = path.parse(file.originalname).name;
    cb(null, `${name}.jpg`);
  }
});

const upload = multer({ storage });

// GET route to fetch saved faces
app.get('/saved-faces', (req, res) => {
  const uploadDir = path.join(__dirname, 'uploads');
  
  try {
    const files = fs.readdirSync(uploadDir);
    const faces = files.map(file => {
      // Extract the name (everything before the underscore)
      const name = file.split('_')[0];
      return {
        name: name,
        url: `/uploads/${file}`
      };
    });
    res.json(faces);
  } catch (error) {
    console.error('Error reading uploads directory:', error);
    res.status(500).json({ error: 'Failed to get saved faces' });
  }
});

// POST route to handle image uploads
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  console.log('Received file:', req.file);
  res.status(200).json({ 
    fileName: req.file.filename, 
    filePath: `/uploads/${req.file.filename}`,
    name: req.file.originalname.split('.')[0]
  });
});

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});