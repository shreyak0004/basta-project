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

///multer function
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit to keep Render happy
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/', (req, res) => {
    res.send("Basta Backend is running securely!");
});

// --- 1. Registration & Login ---
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

app.post('/login', async (req, res) => {
    const { username, roll_number } = req.body;
    const { data: users, error } = await supabase.from('users').select('*').eq('username', username);

    if (error) return res.status(400).json({ error: error.message });
    if (users.length === 0) return res.status(404).json({ error: "User not found!" });

    const user = users[0];
    const isMatch = await bcrypt.compare(roll_number, user.roll_hash);
    if (!isMatch) return res.status(401).json({ error: "Incorrect roll number!" });

    // FIX: Include avatar_url so the frontend can display it immediately
    res.json({ 
        message: "Login successful!", 
        userId: user.id, 
        avatarUrl: user.avatar_url 
    });
});

// --- 2. Profile Picture Upload ---
app.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
    const { userId } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No image provided" });

    const fileName = `avatar-${userId}-${Date.now()}`;
    const { error: storageError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

    if (storageError) return res.status(400).json({ error: storageError.message });

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

    const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', userId);

    if (dbError) return res.status(400).json({ error: dbError.message });
    res.json({ message: "Profile picture updated!", avatarUrl: urlData.publicUrl });
});

// --- 3. File Management (Upload & Delete) ---
app.post('/upload', upload.single('file'), async (req, res) => {
    const { uploader_id, receiver_username } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Please upload a file!" });

    const uniqueFileName = `${Date.now()}-${file.originalname}`;
    const { error: storageError } = await supabase.storage
        .from('basta_files') 
        .upload(uniqueFileName, file.buffer, { contentType: file.mimetype });

    if (storageError) return res.status(400).json({ error: storageError.message });

    const { data: publicUrlData } = supabase.storage.from('basta_files').getPublicUrl(uniqueFileName);
    
    const { error: dbError } = await supabase.from('files').insert([{
        filename: file.originalname,
        file_url: publicUrlData.publicUrl,
        uploader_id: uploader_id,
        receiver_username: receiver_username || null
    }]);

    if (dbError) return res.status(400).json({ error: dbError.message });
    res.json({ message: "File uploaded successfully!", url: publicUrlData.publicUrl });
});

// MISSING ROUTE ADDED: Delete File
// app.delete('/delete-file', async (req, res) => {
//     const { fileId, fileUrl } = req.body;
//     const fileName = fileUrl.split('/').pop();

//     // Remove from Storage
//     await supabase.storage.from('basta_files').remove([fileName]);

//     // Remove from Database
//     const { error } = await supabase.from('files').delete().eq('id', fileId);

//     if (error) return res.status(400).json({ error: error.message });
//     res.json({ message: "File deleted successfully!" });
// });
app.delete('/delete-file', async (req, res) => {
    const { fileId, fileUrl, deleteGlobal } = req.body;
    const fileName = fileUrl.split('/').pop();

    try {
        if (deleteGlobal) {
            // 1. GLOBAL DELETE: Remove from Storage Bucket
            await supabase.storage.from('basta_files').remove([fileName]);
            
            // 2. GLOBAL DELETE: Remove all database entries for this specific file URL
            const { error } = await supabase.from('files').delete().eq('file_url', fileUrl);
            if (error) throw error;
        } else {
            // 3. LOCAL DELETE: Just remove this specific entry for this user
            const { error } = await supabase.from('files').delete().eq('id', fileId);
            if (error) throw error;
        }

        res.json({ message: "Orbit cleared! 🚀" });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/my-files/:userId', async (req, res) => {
    const { data, error } = await supabase.from('files').select('*').eq('uploader_id', req.params.userId).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

app.get('/received-files/:username', async (req, res) => {
    const { data, error } = await supabase.from('files').select('*').eq('receiver_username', req.params.username).order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// --- 4. Friends Management ---
app.post('/add-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;

    // 1. Check if the user you are trying to add even exists
    const { data: userExists } = await supabase.from('users').select('username').eq('username', friendUsername).single();
    if (!userExists) return res.status(404).json({ error: "User not found!" });

    // 2. NEW: Check if they are already your friend
    const { data: alreadyFriends } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', userId)
        .eq('friend_username', friendUsername)
        .single();

    if (alreadyFriends) {
        return res.status(400).json({ error: "This person is already your friend!" });
    }

    // 3. If not already friends, add them
    const { error } = await supabase.from('friends').insert([{ user_id: userId, friend_username: friendUsername }]);
    
    if (error) return res.status(400).json({ error: "Error adding friend." });
    res.json({ message: "Friend added successfully!" });
});

app.get('/friends/:userId', async (req, res) => {
    // Join with users table to get friend's profile picture
    const { data, error } = await supabase
        .from('friends')
        .select('friend_username, users:friend_username(avatar_url)')
        .eq('user_id', req.params.userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// MISSING ROUTE ADDED: Remove Friend
app.delete('/remove-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;
    const { error } = await supabase.from('friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_username', friendUsername);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Friend removed!" });
});

// --- 5. Auto-Delete Timer ---
cron.schedule('0 0 * * *', async () => {
    console.log("⏰ Cleaning old files...");
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

// Routes for username and pasword update

// --- 6. SETTINGS UPDATES ---

// Update Username
app.put('/update-username', async (req, res) => {
    const { userId, newUsername } = req.body;

    // 1. Update the username in the 'users' table
    const { error: userError } = await supabase
        .from('users')
        .update({ username: newUsername })
        .eq('id', userId);

    if (userError) return res.status(400).json({ error: userError.message });

    // 2. Also update their username in the 'friends' table so others still see them
    await supabase
        .from('friends')
        .update({ friend_username: newUsername })
        .eq('friend_username', newUsername); // This keeps friend lists synced

    res.json({ message: "Username updated successfully!" });
});

// Update Password (Roll Number)
app.put('/update-password', async (req, res) => {
    const { userId, newPassword } = req.body;

    // Hash the new "password" (roll number) just like during registration
    const salt = await bcrypt.genSalt(10);
    const hashedRollNumber = await bcrypt.hash(newPassword, salt);

    const { error } = await supabase
        .from('users')
        .update({ roll_hash: hashedRollNumber })
        .eq('id', userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Password updated successfully!" });
});

// --- 7. Cosmic Notes Routes ---

// Route to Save or Share a Note
app.post('/save-note', async (req, res) => {
    const { title, content, owner, shared_with } = req.body;
    
    const { data, error } = await supabase
        .from('notes')
        .insert([{ 
            title, 
            content, 
            owner, 
            shared_with: shared_with || null 
        }]);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Note synced to the star-chart! 🚀" });
});

// Route to Fetch Notes (Personal + Shared with Me)
app.get('/fetch-notes/:username', async (req, res) => {
    const username = req.params.username;
    
    const { data, error } = await supabase
        .from('notes')
        .select('*')
        // Uses Postgres "OR" filter to get notes you own OR notes shared with you
        .or(`owner.eq.${username},shared_with.eq.${username}`)
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// Route to Delete a Note
app.delete('/delete-note/:id', async (req, res) => {
    const { error } = await supabase
        .from('notes')
        .delete()
        //.eq('id', req.params.id);
        .eq('id', noteId)
        .eq('owner', owner);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Note removed from orbit." });
});

//feedback
app.post('/submit-feedback', async (req, res) => {
    const { username, message } = req.body;
    const { error } = await supabase.from('feedbacks').insert([{ username, message }]);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Feedback received!" });
});
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(413).json({ error: "File too large! Max 50MB." });
  }
  res.status(500).json({ error: "Internal Server Error" });
});
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));