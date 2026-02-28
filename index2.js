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

// --- 1. Basic Server Check ---
app.get('/', (req, res) => {
    res.send("Basta Backend is running securely!");
});

// --- 2. Registration & Login ---
app.post('/register', async (req, res) => {
    const { username, roll_number } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedRollNumber = await bcrypt.hash(roll_number, salt);

    const { data, error } = await supabase
        .from('users')
        .insert([{ username: username, roll_hash: hashedRollNumber }]);

    if (error) return res.status(400).json({ error: "Username already exists!" });
    res.json({ message: "Student registered securely!" });
});

app.post('/login', async (req, res) => {
    const { username, roll_number } = req.body;
    const { data: users, error } = await supabase.from('users').select('*').eq('username', username);

    if (error || users.length === 0) return res.status(404).json({ error: "User not found!" });

    const user = users[0];
    const isMatch = await bcrypt.compare(roll_number, user.roll_hash);
    if (!isMatch) return res.status(401).json({ error: "Incorrect roll number!" });

    // SUCCESS: Returning consistent 'avatarUrl'
    res.json({ 
        message: "Login successful!", 
        userId: user.id,
        avatarUrl: user.avatar_url 
    });
});

// --- 3. File Management ---
app.post('/upload', upload.single('file'), async (req, res) => {
    const { uploader_id, receiver_username } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Please upload a file!" });

    const uniqueFileName = `${Date.now()}-${file.originalname}`;

    const { data: storageData, error: storageError } = await supabase.storage
        .from('basta_files') 
        .upload(uniqueFileName, file.buffer, { contentType: file.mimetype });

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

app.get('/my-files/:userId', async (req, res) => {
    const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('uploader_id', req.params.userId)
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(files);
});

app.get('/received-files/:username', async (req, res) => {
    const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('receiver_username', req.params.username)
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(files);
});

app.delete('/delete-file', async (req, res) => {
    const { fileId, fileUrl } = req.body;
    const fileName = fileUrl.split('/').pop();

    const { error: storageError } = await supabase.storage
        .from('basta_files')
        .remove([fileName]);

    if (storageError) return res.status(400).json({ error: storageError.message });

    const { error: dbError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId);

    if (dbError) return res.status(400).json({ error: dbError.message });

    res.json({ message: "File deleted successfully!" });
});

// --- Profile Picture Upload ---
app.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
    const { userId } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No image provided" });

    const fileName = `avatar-${userId}-${Date.now()}`;
    
    const { data, error: storageError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

    if (storageError) return res.status(400).json({ error: storageError.message });

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

    const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', userId);

    if (dbError) return res.status(400).json({ error: dbError.message });

    // SUCCESS: Returning 'avatarUrl' to match login format
    res.json({ message: "Profile picture updated!", avatarUrl: urlData.publicUrl });
});

// --- 4. Settings & Friends ---
app.put('/update-username', async (req, res) => {
    const { userId, newUsername } = req.body;
    const { error } = await supabase.from('users').update({ username: newUsername }).eq('id', userId);
    if (error) return res.status(400).json({ error: "Username taken!" });
    res.json({ message: "Username updated!" });
});

app.put('/update-password', async (req, res) => {
    const { userId, newPassword } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    const { error } = await supabase.from('users').update({ roll_hash: hashed }).eq('id', userId);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Password updated!" });
});

app.post('/add-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;
    const { data: userExists } = await supabase.from('users').select('username').eq('username', friendUsername).single();
    if (!userExists) return res.status(404).json({ error: "User not found!" });

    const { data: alreadyAdded } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', userId)
        .eq('friend_username', friendUsername);

    if (alreadyAdded && alreadyAdded.length > 0) {
        return res.status(400).json({ error: "Already in friend list!" });
    }

    const { error } = await supabase.from('friends').insert([{ user_id: userId, friend_username: friendUsername }]);
    if (error) return res.status(400).json({ error: "Error adding friend." });
    
    res.json({ message: "Friend added!" });
});

app.get('/friends/:userId', async (req, res) => {
    const { data, error } = await supabase
        .from('friends')
        .select(`
            friend_username,
            users:friend_username (avatar_url) 
        `) 
        .eq('user_id', req.params.userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

app.delete('/remove-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;
    const { error } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_username', friendUsername);

    if (error) return res.status(400).json({ error: "Could not remove friend." });
    res.json({ message: "Friend removed successfully!" });
});

// --- 5. Auto-Delete Timer ---
cron.schedule('0 0 * * *', async () => {
    console.log("⏰ Cleaning files older than 7 days...");
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: oldFiles } = await supabase.from('files').select('*').lt('created_at', sevenDaysAgo.toISOString());

    if (oldFiles) {
        for (const file of oldFiles) {
            const fileName = file.file_url.split('/').pop();
            await supabase.storage.from('basta_files').remove([fileName]);
            await supabase.from('files').delete().eq('id', file.id);
        }
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));