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

// Multer setup to handle file memory buffer
const upload = multer({ storage: multer.memoryStorage() }); 

// --- Database Connection ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 1. Basic Server Check ---
app.get('/', (req, res) => {
    res.send("Basta Backend is running securely!");
});

// --- 2. Authentication Routes ---

// Register Student
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

// Login Student
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

// --- 3. File Management Routes ---

// Upload File
app.post('/upload', upload.single('file'), async (req, res) => {
    const { uploader_id, receiver_username } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Please upload a file!" });

    const uniqueFileName = `${Date.now()}-${file.originalname}`;

    // Upload to Storage Bucket
    const { data: storageData, error: storageError } = await supabase.storage
        .from('basta_files') 
        .upload(uniqueFileName, file.buffer, {
            contentType: file.mimetype,
        });

    if (storageError) return res.status(400).json({ error: storageError.message });

    // Get Public URL
    const { data: publicUrlData } = supabase.storage
        .from('basta_files')
        .getPublicUrl(uniqueFileName);
    
    const fileUrl = publicUrlData.publicUrl;

    // Save Record to DB
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

// Get My Uploads
app.get('/my-files/:userId', async (req, res) => {
    const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('uploader_id', req.params.userId)
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(files);
});

// Get Received Files
app.get('/received-files/:username', async (req, res) => {
    const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('receiver_username', req.params.username)
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(files);
});

// --- 4. User Settings Routes ---

app.put('/update-username', async (req, res) => {
    const { userId, newUsername } = req.body;
    const { error } = await supabase.from('users').update({ username: newUsername }).eq('id', userId);
    
    if (error) return res.status(400).json({ error: "Username might already be taken!" });
    res.json({ message: "Username updated successfully!" });
});

app.put('/update-password', async (req, res) => {
    const { userId, newPassword } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    
    const { error } = await supabase.from('users').update({ roll_hash: hashed }).eq('id', userId);
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Password updated successfully!" });
});

// --- 5. Social/Friends Routes ---

app.post('/add-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;

    // Verify friend exists
    const { data: userExists } = await supabase
        .from('users')
        .select('username')
        .eq('username', friendUsername)
        .single();

    if (!userExists) return res.status(404).json({ error: "User not found!" });

    const { error } = await supabase
        .from('friends')
        .insert([{ user_id: userId, friend_username: friendUsername }]);

    if (error) return res.status(400).json({ error: "Friend already added." });
    res.json({ message: "Friend added successfully!" });
});

app.get('/friends/:userId', async (req, res) => {
    const { data, error } = await supabase
        .from('friends')
        .select('friend_username')
        .eq('user_id', req.params.userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// --- 6. Automated Maintenance (Midnight Cron Job) ---
cron.schedule('0 0 * * *', async () => {
    console.log("⏰ Cleaning up files older than 7 days...");
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString();

    const { data: oldFiles, error: fetchError } = await supabase
        .from('files')
        .select('*')
        .lt('created_at', cutoffDate);

    if (fetchError || !oldFiles || oldFiles.length === 0) return;

    for (const file of oldFiles) {
        const fileName = file.file_url.split('/').pop();
        await supabase.storage.from('basta_files').remove([fileName]);
        await supabase.from('files').delete().eq('id', file.id);
        console.log(`🗑️ Deleted: ${fileName}`);
    }
}); 

// --- Start Server ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is awake at http://localhost:${PORT}`);
});