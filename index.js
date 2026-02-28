// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const { createClient } = require('@supabase/supabase-js');
// const bcrypt = require('bcryptjs');
// const multer = require('multer'); 
// const cron = require('node-cron'); 

// const app = express();
// app.use(cors());
// app.use(express.json());

// const upload = multer({ storage: multer.memoryStorage() }); 

// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_KEY;
// const supabase = createClient(supabaseUrl, supabaseKey);

// app.get('/', (req, res) => {
//     res.send("Basta Backend is running securely!");
// });

// // --- Register a Student ---
// app.post('/register', async (req, res) => {
//     const { username, roll_number } = req.body;
//     const salt = await bcrypt.genSalt(10);
//     const hashedRollNumber = await bcrypt.hash(roll_number, salt);

//     const { data, error } = await supabase
//         .from('users')
//         .insert([{ username: username, roll_hash: hashedRollNumber }]);

//     if (error) return res.status(400).json({ error: error.message });
//     res.json({ message: "Student registered securely!" });
// });

// // --- Login a Student ---
// app.post('/login', async (req, res) => {
//     const { username, roll_number } = req.body;
//     const { data: users, error } = await supabase.from('users').select('*').eq('username', username);

//     if (error) return res.status(400).json({ error: error.message });
//     if (users.length === 0) return res.status(404).json({ error: "User not found!" });

//     const user = users[0];
//     const isMatch = await bcrypt.compare(roll_number, user.roll_hash);
//     if (!isMatch) return res.status(401).json({ error: "Incorrect roll number!" });

//     res.json({ message: "Login successful!", userId: user.id });
// });


// // --- 3. Profile Picture Upload ---
// app.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
//     const { userId } = req.body;
//     const file = req.file;

//     if (!file) return res.status(400).json({ error: "No image provided" });

//     const fileName = `avatar-${userId}-${Date.now()}`;
    
//     // Upload to 'avatars' bucket
//     const { data, error: storageError } = await supabase.storage
//         .from('avatars')
//         .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: true });

//     if (storageError) return res.status(400).json({ error: storageError.message });

//     const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

//     // Update the user's record with the new URL
//     const { error: dbError } = await supabase
//         .from('users')
//         .update({ avatar_url: urlData.publicUrl })
//         .eq('id', userId);

//     if (dbError) return res.status(400).json({ error: dbError.message });

//     res.json({ message: "Profile picture updated!", avatarUrl: urlData.publicUrl });
// });

// // --- 4. File Management ---
// app.post('/upload', upload.single('file'), async (req, res) => {
//     const { uploader_id, receiver_username } = req.body;
//     const file = req.file;

//     if (!file) return res.status(400).json({ error: "Please upload a file!" });

//     const uniqueFileName = `${Date.now()}-${file.originalname}`;

//     const { data: storageData, error: storageError } = await supabase.storage
//         .from('basta_files') 
//         .upload(uniqueFileName, file.buffer, {
//             contentType: file.mimetype,
//         });

//     if (storageError) return res.status(400).json({ error: storageError.message });

//     const { data: publicUrlData } = supabase.storage
//         .from('basta_files')
//         .getPublicUrl(uniqueFileName);
    
//     const fileUrl = publicUrlData.publicUrl;

//     const { data: dbData, error: dbError } = await supabase
//         .from('files')
//         .insert([{
//             filename: file.originalname,
//             file_url: fileUrl,
//             uploader_id: uploader_id,
//             receiver_username: receiver_username || null
//         }]);

//     if (dbError) return res.status(400).json({ error: dbError.message });

//     res.json({ message: "File uploaded successfully!", url: fileUrl });
// });

// // --- Get a User's Uploaded Files ---
// app.get('/my-files/:userId', async (req, res) => {
//     const userId = req.params.userId;
//     const { data: files, error } = await supabase
//         .from('files')
//         .select('*')
//         .eq('uploader_id', userId)
//         .order('created_at', { ascending: false });

//     if (error) return res.status(400).json({ error: error.message });
//     res.json(files);
// });

// // --- Get Received Files ---
// app.get('/received-files/:username', async (req, res) => {
//     const username = req.params.username;
//     const { data: files, error } = await supabase
//         .from('files')
//         .select('*')
//         .eq('receiver_username', username)
//         .order('created_at', { ascending: false });

//     if (error) return res.status(400).json({ error: error.message });
//     res.json(files);
// });
// // ... [Keep your existing file fetching routes here] ...

// app.post('/add-friend', async (req, res) => {
//     const { userId, friendUsername } = req.body;

//     const { data: userExists } = await supabase
//         .from('users')
//         .select('username')
//         .eq('username', friendUsername)
//         .single();

//     if (!userExists) return res.status(404).json({ error: "User not found!" });

//     const { error } = await supabase
//         .from('friends')
//         .insert([{ user_id: userId, friend_username: friendUsername }]);

//     if (error) return res.status(400).json({ error: "Friend already added or error occurred." });
//     res.json({ message: "Friend added successfully!" });
// });

// // --- Get Friends List (NEW) ---
// app.get('/friends/:userId', async (req, res) => {
//     const { data, error } = await supabase
//         .from('friends')
//         .select('friend_username')
//         .eq('user_id', req.params.userId);

//     if (error) return res.status(400).json({ error: error.message });
//     res.json(data);
// });
// // ... [Keep your existing remove-friend and cron routes here] ...
// // --- Auto-Delete Timer ---
// cron.schedule('0 0 * * *', async () => {
//     console.log("⏰ Midnight alarm! Checking for files older than 7 days...");
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
//     const cutoffDate = sevenDaysAgo.toISOString();

//     const { data: oldFiles, error: fetchError } = await supabase
//         .from('files')
//         .select('*')
//         .lt('created_at', cutoffDate);

//     if (fetchError) {
//         console.log("Error checking for old files:", fetchError.message);
//         return; 
//     }

//     if (!oldFiles || oldFiles.length === 0) {
//         console.log("The database is clean! No files to delete today.");
//         return; 
//     }

//     for (const file of oldFiles) {
//         const urlParts = file.file_url.split('/');
//         const exactFileName = urlParts[urlParts.length - 1];
//         await supabase.storage.from('basta_files').remove([exactFileName]);
//         await supabase.from('files').delete().eq('id', file.id);
//         console.log(`🗑️ Deleted 7-day-old file: ${exactFileName}`);
//     }
// }); 


// const PORT = 3000;
// app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

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

const upload = multer({ storage: multer.memoryStorage() }); 

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
app.delete('/delete-file', async (req, res) => {
    const { fileId, fileUrl } = req.body;
    const fileName = fileUrl.split('/').pop();

    // Remove from Storage
    await supabase.storage.from('basta_files').remove([fileName]);

    // Remove from Database
    const { error } = await supabase.from('files').delete().eq('id', fileId);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "File deleted successfully!" });
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
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));