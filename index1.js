require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const multer = require('multer'); 
const cron = require('node-cron'); 

const app = express();
app.use(cors());
app.use(express.json());

// Set up multer to hold the file in memory temporarily
const upload = multer({ storage: multer.memoryStorage() }); 

// --- Connect to Supabase ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Routes ---
app.get('/', (req, res) => {
    res.send("Basta Backend is running securely!");
});

// --- Register a Student ---
app.post('/register', async (req, res) => {
    const { username, roll_number } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedRollNumber = await bcrypt.hash(roll_number, salt);

    const { data, error } = await supabase
        .from('users')
        .insert([{ username: username, roll_hash: hashedRollNumber }]);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Student registered securely!" });
});

// --- Login a Student ---
app.post('/login', async (req, res) => {
    const { username, roll_number } = req.body;
    const { data: users, error } = await supabase.from('users').select('*').eq('username', username);

    if (error) return res.status(400).json({ error: error.message });
    if (users.length === 0) return res.status(404).json({ error: "User not found!" });

    const user = users[0];
    const isMatch = await bcrypt.compare(roll_number, user.roll_hash);
    if (!isMatch) return res.status(401).json({ error: "Incorrect roll number!" });

    res.json({ message: "Login successful!", userId: user.id });
});

// --- Upload a File ---
app.post('/upload', upload.single('file'), async (req, res) => {
    const { uploader_id, receiver_username } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Please upload a file!" });

    const uniqueFileName = `${Date.now()}-${file.originalname}`;

    const { data: storageData, error: storageError } = await supabase.storage
        .from('basta_files') 
        .upload(uniqueFileName, file.buffer, {
            contentType: file.mimetype,
        });

    if (storageError) return res.status(400).json({ error: storageError.message });

    const { data: publicUrlData } = supabase.storage
        .from('basta_files')
        .getPublicUrl(uniqueFileName);
    
    const fileUrl = publicUrlData.publicUrl;

    const { data: dbData, error: dbError } = await supabase
        .from('files')
        .insert([{
            filename: file.originalname,
            file_url: fileUrl,
            uploader_id: uploader_id,
            receiver_username: receiver_username || null
        }]);

    if (dbError) return res.status(400).json({ error: dbError.message });

    res.json({ message: "File uploaded successfully!", url: fileUrl });
});

// --- Get a User's Uploaded Files ---
app.get('/my-files/:userId', async (req, res) => {
    const userId = req.params.userId;
    const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('uploader_id', userId)
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(files);
});

// --- Get Received Files ---
app.get('/received-files/:username', async (req, res) => {
    const username = req.params.username;
    const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('receiver_username', username)
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(files);
});

// --- Add a Friend (NEW) ---
app.post('/add-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;

    const { data: userExists } = await supabase
        .from('users')
        .select('username')
        .eq('username', friendUsername)
        .single();

    if (!userExists) return res.status(404).json({ error: "User not found!" });

    const { error } = await supabase
        .from('friends')
        .insert([{ user_id: userId, friend_username: friendUsername }]);

    if (error) return res.status(400).json({ error: "Friend already added or error occurred." });
    res.json({ message: "Friend added successfully!" });
});

// --- Get Friends List (NEW) ---
app.get('/friends/:userId', async (req, res) => {
    const { data, error } = await supabase
        .from('friends')
        .select('friend_username')
        .eq('user_id', req.params.userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// --- Update Username ---
app.put('/update-username', async (req, res) => {
    const { userId, newUsername } = req.body;
    const { error } = await supabase.from('users').update({ username: newUsername }).eq('id', userId);
    
    if (error) return res.status(400).json({ error: "Username might already be taken!" });
    res.json({ message: "Username updated successfully!" });
});

// --- Update Password ---
app.put('/update-password', async (req, res) => {
    const { userId, newPassword } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedRollNumber = await bcrypt.hash(newPassword, salt);
    
    const { error } = await supabase.from('users').update({ roll_hash: hashedRollNumber }).eq('id', userId);
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Password updated successfully!" });
});

// --- Add a Friend (NEW) ---
app.post('/add-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;

    // Check if the friend actually exists in our users table first
    const { data: userExists } = await supabase
        .from('users')
        .select('username')
        .eq('username', friendUsername)
        .single();

    if (!userExists) return res.status(404).json({ error: "User not found!" });

    const { error } = await supabase
        .from('friends')
        .insert([{ user_id: userId, friend_username: friendUsername }]);

    if (error) return res.status(400).json({ error: "Friend already added or error occurred." });
    res.json({ message: "Friend added successfully!" });
});

// --- Get Friends List (NEW) ---
app.get('/friends/:userId', async (req, res) => {
    const { data, error } = await supabase
        .from('friends')
        .select('friend_username')
        .eq('user_id', req.params.userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// --- Auto-Delete Timer ---
cron.schedule('0 0 * * *', async () => {
    console.log("⏰ Midnight alarm! Checking for files older than 7 days...");
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString();

    const { data: oldFiles, error: fetchError } = await supabase
        .from('files')
        .select('*')
        .lt('created_at', cutoffDate);

    if (fetchError) {
        console.log("Error checking for old files:", fetchError.message);
        return; 
    }

    if (!oldFiles || oldFiles.length === 0) {
        console.log("The database is clean! No files to delete today.");
        return; 
    }

    for (const file of oldFiles) {
        const urlParts = file.file_url.split('/');
        const exactFileName = urlParts[urlParts.length - 1];
        await supabase.storage.from('basta_files').remove([exactFileName]);
        await supabase.from('files').delete().eq('id', file.id);
        console.log(`🗑️ Deleted 7-day-old file: ${exactFileName}`);
    }
}); 

// --- Start the Engine ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is awake and listening on http://localhost:${PORT}`);
});