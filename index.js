require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cron = require('node-cron');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the static frontend files
app.use(express.static(path.join(__dirname, 'basta-frontend')));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 1. Registration & Login ---
app.post('/register', async (req, res) => {
    const { username, roll_number, security_question, security_answer } = req.body;

    if (!username || !roll_number) {
        return res.status(400).json({ error: "Username and password are required!" });
    }
    if (!security_question || !security_answer) {
        return res.status(400).json({ error: "Security question and answer are required!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedRollNumber = await bcrypt.hash(roll_number, salt);
    const hashedAnswer = await bcrypt.hash(security_answer.toLowerCase().trim(), salt);

    const { data, error } = await supabase
        .from('users')
        .insert([{
            username,
            roll_hash: hashedRollNumber,
            security_question,
            security_answer_hash: hashedAnswer
        }]);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Student registered securely!" });
});

// --- 1.1. Password Recovery Flow ---
app.post('/forgot-password/reset', async (req, res) => {
    const { username, security_question, security_answer, new_password } = req.body;
    if (!username || !security_question || !security_answer || !new_password) {
        return res.status(400).json({ error: "All fields are required!" });
    }

    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username);

    if (error) return res.status(400).json({ error: error.message });
    if (users.length === 0) return res.status(404).json({ error: "User not found!" });

    const user = users[0];

    if (!user.security_question || !user.security_answer_hash) {
        return res.status(400).json({ error: "No security question set for this account! Please contact the admin." });
    }

    if (user.security_question !== security_question) {
        return res.status(401).json({ error: "Incorrect security question chosen for this user!" });
    }

    const isMatch = await bcrypt.compare(security_answer.toLowerCase().trim(), user.security_answer_hash);
    if (!isMatch) return res.status(401).json({ error: "Incorrect security answer!" });

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(new_password, salt);

    const { error: updateError } = await supabase
        .from('users')
        .update({ roll_hash: hashedNewPassword })
        .eq('id', user.id);

    if (updateError) return res.status(400).json({ error: updateError.message });

    res.json({ message: "Password updated successfully!" });
});

app.post('/login', async (req, res) => {
    const { username, roll_number } = req.body;
    const { data: users, error } = await supabase.from('users').select('*').eq('username', username);

    if (error) return res.status(400).json({ error: error.message });
    if (users.length === 0) return res.status(404).json({ error: "User not found!" });

    const user = users[0];
    const isMatch = await bcrypt.compare(roll_number, user.roll_hash);
    if (!isMatch) return res.status(401).json({ error: "Incorrect roll number!" });

    res.json({ message: "Login successful!", userId: user.id, avatarUrl: user.avatar_url });
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

// --- 3. File Management ---
app.post('/upload', upload.array('files'), async (req, res) => {
    const { uploader_id, receiver_username } = req.body;
    const files = req.files;
    if (!files || files.length === 0) return res.status(400).json({ error: "Please upload at least one file!" });

    const uploadedUrls = [];
    const errors = [];

    for (const file of files) {
        const uniqueFileName = `${Date.now()}-${file.originalname}`;
        const { error: storageError } = await supabase.storage
            .from('basta_files')
            .upload(uniqueFileName, file.buffer, { contentType: file.mimetype });

        if (storageError) {
            errors.push({ filename: file.originalname, error: storageError.message });
            continue;
        }

        const { data: publicUrlData } = supabase.storage.from('basta_files').getPublicUrl(uniqueFileName);

        const { error: dbError } = await supabase.from('files').insert([{
            filename: file.originalname,
            file_url: publicUrlData.publicUrl,
            uploader_id,
            receiver_username: receiver_username || null
        }]);

        if (dbError) {
            errors.push({ filename: file.originalname, error: dbError.message });
        } else {
            uploadedUrls.push(publicUrlData.publicUrl);
        }
    }

    if (errors.length > 0 && uploadedUrls.length === 0) {
        return res.status(400).json({ error: "All uploads failed.", details: errors });
    }

    res.json({
        message: `Successfully uploaded ${uploadedUrls.length} file(s)!`,
        urls: uploadedUrls,
        errors: errors.length > 0 ? errors : undefined
    });
});

app.delete('/delete-file', async (req, res) => {
    const { fileId, fileUrl, deleteGlobal } = req.body;
    const fileName = fileUrl.split('/').pop();

    try {
        if (deleteGlobal) {
            await supabase.storage.from('basta_files').remove([fileName]);
            const { error } = await supabase.from('files').delete().eq('file_url', fileUrl);
            if (error) throw error;
        } else {
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

// --- 4. Friends ---
app.post('/add-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;

    const { data: userExists } = await supabase.from('users').select('username').eq('username', friendUsername).single();
    if (!userExists) return res.status(404).json({ error: "User not found!" });

    const { data: alreadyFriends } = await supabase
        .from('friends').select('*')
        .eq('user_id', userId).eq('friend_username', friendUsername).single();

    if (alreadyFriends) return res.status(400).json({ error: "This person is already your friend!" });

    const { error } = await supabase.from('friends').insert([{ user_id: userId, friend_username: friendUsername }]);
    if (error) return res.status(400).json({ error: "Error adding friend." });
    res.json({ message: "Friend added successfully!" });
});

app.get('/friends/:userId', async (req, res) => {
    const { data, error } = await supabase
        .from('friends')
        .select('friend_username, users:friend_username(avatar_url)')
        .eq('user_id', req.params.userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

app.delete('/remove-friend', async (req, res) => {
    const { userId, friendUsername } = req.body;
    const { error } = await supabase.from('friends')
        .delete().eq('user_id', userId).eq('friend_username', friendUsername);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Friend removed!" });
});

// --- 5. Auto-Delete Cron ---
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

// --- 6. Settings Updates ---
app.put('/update-username', async (req, res) => {
    const { userId, newUsername } = req.body;

    if (!userId || !newUsername) {
        return res.status(400).json({ error: "User ID and new username are required!" });
    }

    try {
        // 1. Check if the username is already taken by another user
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('username', newUsername);

        if (checkError) return res.status(400).json({ error: checkError.message });
        if (existingUser && existingUser.length > 0 && existingUser[0].id !== userId) {
            return res.status(400).json({ error: "Username is already taken!" });
        }

        // 2. Fetch the old username of the current user
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('username')
            .eq('id', userId)
            .single();

        if (fetchError) return res.status(400).json({ error: fetchError.message });
        const oldUsername = user?.username;

        // 3. Update the user's username
        const { error: updateError } = await supabase
            .from('users')
            .update({ username: newUsername })
            .eq('id', userId);

        if (updateError) return res.status(400).json({ error: updateError.message });

        if (oldUsername) {
            // 4. Update the username everywhere in other tables
            // Update friends table where they are added as a friend
            await supabase
                .from('friends')
                .update({ friend_username: newUsername })
                .eq('friend_username', oldUsername);

            // Update received files
            await supabase
                .from('files')
                .update({ receiver_username: newUsername })
                .eq('receiver_username', oldUsername);

            // Update notes ownership
            await supabase
                .from('notes')
                .update({ owner: newUsername })
                .eq('owner', oldUsername);

            // Update notes shared with
            await supabase
                .from('notes')
                .update({ shared_with: newUsername })
                .eq('shared_with', oldUsername);

            // Update messages sender
            await supabase
                .from('messages')
                .update({ sender_username: newUsername })
                .eq('sender_username', oldUsername);

            // Update messages receiver
            await supabase
                .from('messages')
                .update({ receiver_username: newUsername })
                .eq('receiver_username', oldUsername);
        }

        res.json({ message: "Username updated successfully!" });
    } catch (e) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put('/update-password', async (req, res) => {
    const { userId, newPassword } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedRollNumber = await bcrypt.hash(newPassword, salt);

    const { error } = await supabase
        .from('users').update({ roll_hash: hashedRollNumber }).eq('id', userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Password updated successfully!" });
});

// --- 7. Cosmic Notes ---
app.post('/save-note', async (req, res) => {
    const { title, content, owner, shared_with } = req.body;

    const { error } = await supabase.from('notes').insert([{
        title, content, owner, shared_with: shared_with || null
    }]);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Note synced to the star-chart! 🚀" });
});

app.get('/fetch-notes/:username', async (req, res) => {
    const username = req.params.username;

    const { data, error } = await supabase
        .from('notes').select('*')
        .or(`owner.eq.${username},shared_with.eq.${username}`)
        .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// ✅ BUG FIX: was using undefined `noteId` variable instead of req.params.id
app.delete('/delete-note/:id', async (req, res) => {
    const noteId = req.params.id;
    const username = req.query.owner; // this is the current user's username passed as 'owner'

    if (!username) return res.status(400).json({ error: "Username required" });

    try {
        // 1. Fetch the note first to check ownership
        const { data: note, error: fetchError } = await supabase
            .from('notes')
            .select('*')
            .eq('id', noteId)
            .maybeSingle();

        if (fetchError) {
            console.error("Supabase Fetch Error:", fetchError);
            return res.status(500).json({ error: fetchError.message });
        }

        if (!note) {
            return res.status(404).json({ error: "Note not found" });
        }

        if (note.owner === username) {
            // Current user is the owner -> delete the note globally
            const { error: deleteError } = await supabase
                .from('notes')
                .delete()
                .eq('id', noteId);

            if (deleteError) {
                console.error("Supabase Delete Error:", deleteError);
                return res.status(400).json({ error: deleteError.message });
            }
            return res.json({ message: "Note removed from orbit." });
        } else if (note.shared_with === username) {
            // Current user is the recipient -> just clear the sharing (set shared_with to null)
            const { error: updateError } = await supabase
                .from('notes')
                .update({ shared_with: null })
                .eq('id', noteId);

            if (updateError) {
                console.error("Supabase Update Error:", updateError);
                return res.status(400).json({ error: updateError.message });
            }
            return res.json({ message: "Note removed from your view." });
        } else {
            return res.status(403).json({ error: "Access denied" });
        }
    } catch (e) {
        console.error("Catch Error:", e);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});
// --- 7.5. Orbit Chat Messages ---
app.post('/send-message', async (req, res) => {
    const { sender_username, receiver_username, message_text } = req.body;

    if (!sender_username || !receiver_username || !message_text) {
        return res.status(400).json({ error: "All message fields are required!" });
    }

    const { error } = await supabase.from('messages').insert([{
        sender_username,
        receiver_username,
        message_text
    }]);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Message transmitted!" });
});

app.get('/messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_username.eq.${user1},sender_username.eq.${user2}`)
        .order('created_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    const filtered = data.filter(msg =>
        (msg.sender_username === user1 && msg.receiver_username === user2) ||
        (msg.sender_username === user2 && msg.receiver_username === user1)
    );

    // Mark received messages as read
    const unreadReceivedIds = filtered
        .filter(msg => msg.sender_username === user2 && msg.receiver_username === user1 && !msg.is_read)
        .map(msg => msg.id);

    if (unreadReceivedIds.length > 0) {
        await supabase
            .from('messages')
            .update({ is_read: true })
            .in('id', unreadReceivedIds);

        filtered.forEach(msg => {
            if (unreadReceivedIds.includes(msg.id)) {
                msg.is_read = true;
            }
        });
    }

    res.json(filtered);
});

// Delete a single direct message by ID
app.delete('/messages/single/:messageId', async (req, res) => {
    const { messageId } = req.params;
    const idVal = isNaN(messageId) ? messageId : parseInt(messageId, 10);
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', idVal);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Message deleted!" });
});

// Delete chat history between two users
app.delete('/messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    const [res1, res2] = await Promise.all([
        supabase.from('messages').delete().eq('sender_username', user1).eq('receiver_username', user2),
        supabase.from('messages').delete().eq('sender_username', user2).eq('receiver_username', user1)
    ]);

    if (res1.error) return res.status(400).json({ error: res1.error.message });
    if (res2.error) return res.status(400).json({ error: res2.error.message });

    res.json({ message: "Chat history cleared successfully!" });
});

// --- 8. Feedback ---
app.post('/submit-feedback', async (req, res) => {
    const { username, message } = req.body;
    const { error } = await supabase.from('feedbacks').insert([{ username, message }]);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "Feedback received!" });
});

const communitiesRouter = require('./routes/communities')(supabase);
app.use('/', communitiesRouter);

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(413).json({ error: "File too large! Max 50MB." });
    }
    res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));