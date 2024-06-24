const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const axios = require('axios');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'manojgautam',
    password: 'm@n0jg@ut@mM', // Replace with your MySQL password
    database: 'mapAppDB'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to database');
});

// Session setup
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

const upload = multer({ dest: 'public/uploads/' });

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// API endpoint to fetch locations
app.get('/locations', (req, res) => {
    const sql = 'SELECT * FROM locations';
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Serve the admin.html file for adding locations
app.get('/admin', (req, res) => {
    if (req.session.admin) {
        res.sendFile(path.join(__dirname, 'views', 'admin.html'));
    } else {
        res.redirect('/login');
    }
});

// Serve the login.html file for logging in
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Handle login form submission
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin') {
        req.session.admin = true;
        res.redirect('/admin');
    } else {
        res.redirect('/login');
    }
});

// Handle logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Helper function to parse numbers and handle NaN
function parseNumber(value, defaultValue = 0) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Handle form submission to add a location
app.post('/add-location', upload.single('image'), (req, res) => {
    if (req.session.admin) {
        const location = {
            Title: req.body.Title,
            Lake_code: req.body.Lake_code,
            Latitude: req.body.Latitude,
            Longitude: req.body.Longitude,
            image: req.file ? `/uploads/${req.file.filename}` : req.body.existing_image,
            Elevation_m: req.body.Elevation_m,
            Basin_Name: req.body.Basin_Name,
            Area_km2: req.body.Area_km2,
            Area_ha: req.body.Area_ha,
            Perimeter: req.body.Perimeter,
            Error_km2: req.body.Error_km2,
            Error_ha: req.body.Error_ha,
            District: req.body.District,
            GaPa_NaPa: req.body.GaPa_NaPa,
            Ward_No: req.body.Ward_No,
            further_comments: req.body.further_comments,
            reference: req.body.reference
        };

        const sql = 'INSERT INTO locations SET ?';
        db.query(sql, location, (err, result) => {
            if (err) throw err;
            res.redirect('/admin');
        });
    } else {
        res.redirect('/login');
    }
});

// Download image and save it locally
const downloadImage = async (url, filepath) => {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    return new Promise((resolve, reject) => {
        response.data.pipe(fs.createWriteStream(filepath))
            .on('finish', () => resolve())
            .on('error', e => reject(e));
    });
};

// Handle Excel file upload
app.post('/upload-excel', upload.single('excelFile'), async (req, res) => {
    if (req.session.admin) {
        const filePath = req.file.path;

        // Read the Excel file
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Parse the sheet into JSON
        const data = xlsx.utils.sheet_to_json(sheet);

        // Process and insert data into the database
        for (const row of data) {
            const location = {
                Title: row.Title,
                Lake_code: row.Lake_code,
                Latitude: row.Latitude,
                Longitude: row.Longitude,
                Elevation_m: row.Elevation_m,
                Basin_Name: row.Basin_Name,
                Area_km2: row.Area_km2,
                Area_ha: row.Area_ha,
                Perimeter: row.Perimeter,
                Error_km2: row.Error_km2,
                Error_ha: row.Error_ha,
                District: row.District,
                GaPa_NaPa: row.GaPa_NaPa,
                Ward_No: row.Ward_No,
                further_comments: row.further_comments,
                reference: row.reference
            };

            // If Image_URL is provided, download the image
            if (row.Image_URL) {
                const imageFilename = path.basename(row.Image_URL);
                const imageFilePath = path.join(__dirname, 'public', 'uploads', imageFilename);
                try {
                    await downloadImage(row.Image_URL, imageFilePath);
                    location.image = `/uploads/${imageFilename}`;
                } catch (error) {
                    console.error(`Failed to download image from ${row.Image_URL}:`, error);
                    location.image = null; // Set to null if the image download fails
                }
            }

            const sql = 'INSERT INTO locations SET ?';
            db.query(sql, location, (err, result) => {
                if (err) throw err;
            });
        }

        // Delete the uploaded file after processing
        fs.unlink(filePath, (err) => {
            if (err) throw err;
            console.log('Temporary Excel file deleted');
        });

        res.redirect('/admin');
    } else {
        res.redirect('/login');
    }
});
// API endpoint to fetch a single location by ID
app.get('/location/:id', (req, res) => {
    const sql = 'SELECT * FROM locations WHERE id = ?';
    db.query(sql, [req.params.id], (err, results) => {
        if (err) throw err;
        res.json(results[0]);
    });
});

// Handle form submission to update a location
app.post('/update-location/:id', upload.single('image'), (req, res) => {
    if (req.session.admin) {
        const updatedLocation = {
            Title: req.body.Title,
            Lake_code: req.body.Lake_code,
            Latitude: req.body.Latitude,
            Longitude: req.body.Longitude,
            image: req.file ? `/uploads/${req.file.filename}` : req.body.existing_image,
            Elevation_m: req.body.Elevation_m,
            Basin_Name: req.body.Basin_Name,
            Area_km2: req.body.Area_km2,
            Area_ha: req.body.Area_ha,
            Perimeter: req.body.Perimeter,
            Error_km2: req.body.Error_km2,
            Error_ha: req.body.Error_ha,
            District: req.body.District,
            GaPa_NaPa: req.body.GaPa_NaPa,
            Ward_No: req.body.Ward_No,
            further_comments: req.body.further_comments,
            reference: req.body.reference
        };

        const sql = 'UPDATE locations SET ? WHERE id = ?';
        db.query(sql, [updatedLocation, req.params.id], (err, result) => {
            if (err) throw err;
            res.redirect('/admin');
        });
    } else {
        res.redirect('/login');
    }
});

// Handle delete location request
// Handle delete location request
app.post('/delete-location/:id', (req, res) => {
    if (req.session.admin) {
        const locationId = req.params.id;
        const sql = 'DELETE FROM locations WHERE id = ?';
        db.query(sql, [locationId], (err, result) => {
            if (err) throw err;
            res.redirect('/admin');
        });
    } else {
        res.redirect('/login');
    }
});

// Handle delete all locations request
app.post('/delete-all-locations', (req, res) => {
    if (req.session.admin) {
        const sql = 'DELETE FROM locations';
        db.query(sql, (err, result) => {
            if (err) throw err;
            res.redirect('/admin');
        });
    } else {
        res.redirect('/login');
    }
});



// Start server
// app.listen(3000, () => {
//     console.log('Server started on http://localhost:3000');
// });

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
