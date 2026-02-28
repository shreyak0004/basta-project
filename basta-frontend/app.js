const API_URL = "https://basta-project.onrender.com";
let lastReceivedCount = 0; 

// --- 1. LOGIN & REGISTRATION ---
async function registerUser() {
    const username = document.getElementById('usernameInput').value;
    const roll_number = document.getElementById('rollNumberInput').value;
    const messageBox = document.getElementById('authMessage');

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, roll_number })
        });
        const data = await response.json();
        messageBox.innerText = data.message || data.error;
        messageBox.style.color = response.ok ? "#00ff88" : "#ff4d4d";
    } catch (e) { messageBox.innerText = "Server Error"; }
}

async function loginUser() {
    const username = document.getElementById('usernameInput').value;
    const roll_number = document.getElementById('rollNumberInput').value;
    const messageBox = document.getElementById('authMessage');

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, roll_number })
        });
        
        const data = await response.json(); 

        if (response.ok) {
            alert("Login Successful!"); 
            localStorage.setItem('basta_user_id', data.userId);
            localStorage.setItem('basta_username', username);
            
            // Save avatar from backend
            if (data.avatarUrl) {
                localStorage.setItem('basta_avatar_url', data.avatarUrl);
            }
            
            showDashboard(username);
        } else {
            messageBox.innerText = data.error || "Login failed";
            messageBox.style.color = "#ff4d4d";
        }
    } catch (e) { messageBox.innerText = "Login failed. Check server."; }
}

function showDashboard(username) {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('userGreeting').innerText = username;

    // Load Sidebar Avatar
    const avatar = localStorage.getItem('basta_avatar_url'); 
    if (avatar && avatar !== "null" && avatar !== "undefined") {
        document.getElementById('userAvatar').src = avatar;
    }
    
    fetchMyFiles();
    fetchReceivedFiles();
    fetchFriends();
    loadFavorites();
    startPolling();
}

function logoutUser() {
    localStorage.clear();
    location.reload(); 
}

// --- 2. TAB & THEME SWITCHING ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-window').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');
    if (event) event.currentTarget.classList.add('active');
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
}

// --- 3. FILE OPERATIONS ---
async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    const receiver = document.getElementById('receiverInput').value;
    const uploaderId = localStorage.getItem('basta_user_id');
    const messageBox = document.getElementById('uploadMessage');

    if (!file) return alert("Please select a file!");

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploader_id', uploaderId);
    if (receiver) formData.append('receiver_username', receiver);

    messageBox.innerText = "Uploading...";
    
    try {
        const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
        const data = await response.json();

        if (response.ok) {
            messageBox.innerText = "Upload Successful!"; 
            fileInput.value = ""; 
            fetchMyFiles();
        } else {
            messageBox.innerText = data.error || "Upload failed.";
        }
    } catch (e) {
        messageBox.innerText = "Server Error during upload.";
    }
}

async function fetchMyFiles() {
    const id = localStorage.getItem('basta_user_id');
    const res = await fetch(`${API_URL}/my-files/${id}`);
    const files = await res.json();
    renderGallery('fileGallery', files);
}

async function fetchReceivedFiles() {
    const user = localStorage.getItem('basta_username');
    const res = await fetch(`${API_URL}/received-files/${user}`);
    const files = await res.json();
    
    if (files.length > lastReceivedCount && lastReceivedCount !== 0) {
        showNotification(`You received a new file!`); 
    }
    
    lastReceivedCount = files.length; 
    renderGallery('receivedGallery', files);
}

function renderGallery(elementId, files) {
    const gallery = document.getElementById(elementId);
    if (!gallery) return;
    gallery.innerHTML = files.length ? "" : "No files found.";
    files.forEach(f => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span>📄 ${f.filename}</span>
            <div style="display: flex; gap: 10px; align-items: center;">
                <a href="${f.file_url}" target="_blank" style="color: #00ff88; text-decoration: none; font-weight: bold;">Download</a>
                <span onclick="toggleFavorite('${f.filename}', '${f.file_url}')" style="cursor:pointer;">⭐</span>
                <button onclick="deleteFile('${f.id}', '${f.file_url}')" 
                        style="background: none; border: 1px solid #ff4d4d; color: #ff4d4d; border-radius: 20px; padding: 2px 8px; cursor: pointer; font-size: 10px;">
                    Delete
                </button>
            </div>`;
        gallery.appendChild(item);
    });
}

async function deleteFile(fileId, fileUrl) {
    if (!confirm("Are you sure?")) return;
    try {
        const res = await fetch(`${API_URL}/delete-file`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, fileUrl })
        });
        if (res.ok) {
            showNotification("File deleted!");
            fetchMyFiles();
            fetchReceivedFiles();
        }
    } catch (e) { console.error("Delete error:", e); }
}

// --- 4. FRIENDS LOGIC ---
async function addFriend() {
    const friendUsername = document.getElementById('friendSearchInput').value;
    const userId = localStorage.getItem('basta_user_id');
    const messageBox = document.getElementById('friendMessage');

    const res = await fetch(`${API_URL}/add-friend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, friendUsername })
    });
    
    const data = await res.json();
    messageBox.innerText = data.message || data.error;
    if (res.ok) {
        document.getElementById('friendSearchInput').value = ""; 
        fetchFriends(); 
    }
}

async function fetchFriends() {
    const userId = localStorage.getItem('basta_user_id');
    const list = document.getElementById('friendsList');
    if (!list) return;

    try {
        const response = await fetch(`${API_URL}/friends/${userId}`);
        const friends = await response.json();
        
        // Clear list to prevent duplicates
        list.innerHTML = ""; 

        if (friends.length === 0) {
            list.innerHTML = "No friends yet.";
            return;
        }
        
        friends.forEach(f => {
            const avatar = f.users?.avatar_url || "https://via.placeholder.com/30"; 
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${avatar}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid #00d2ff;">
                    <span>👤 ${f.friend_username}</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="select-btn" onclick="autoFillReceiver('${f.friend_username}')">Select</button>
                    <button onclick="removeFriend('${f.friend_username}')" 
                            style="background: none; border: 1px solid #ff4d4d; color: #ff4d4d; border-radius: 20px; padding: 5px 10px; cursor: pointer; font-size: 11px;">
                        Remove
                    </button>
                </div>`;
            list.appendChild(item);
        });
    } catch (e) { list.innerHTML = "Error loading friends."; }
}

async function removeFriend(friendUsername) {
    const userId = localStorage.getItem('basta_user_id');
    if (!confirm(`Remove ${friendUsername}?`)) return;

    try {
        const res = await fetch(`${API_URL}/remove-friend`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, friendUsername })
        });

        if (res.ok) {
            showNotification("Friend removed.");
            fetchFriends(); 
        }
    } catch (e) { console.error(e); }
}

function autoFillReceiver(username) {
    switchTab('home');
    document.getElementById('receiverInput').value = username;
}

// --- 5. PROFILE PICTURE LOGIC ---
async function uploadAvatar() {
    const file = document.getElementById('avatarInput').files[0];
    const userId = localStorage.getItem('basta_user_id');
    if (!file) return alert("Select an image first!");
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', userId);

    try {
        const res = await fetch(`${API_URL}/upload-avatar`, { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('basta_avatar_url', data.avatarUrl); 
            alert("Profile picture updated!");
            location.reload(); 
        }
    } catch (e) { alert("Server error."); }
}

// --- 6. SETTINGS UPDATES ---
async function updateUsername() {
    const newUsername = document.getElementById('newUsername').value;
    const userId = localStorage.getItem('basta_user_id');
    const res = await fetch(`${API_URL}/update-username`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newUsername })
    });
    if (res.ok) {
        document.getElementById('userGreeting').innerText = newUsername;
        localStorage.setItem('basta_username', newUsername);
        alert("Username updated!");
    }
}

async function updatePassword() {
    const newPassword = document.getElementById('newPassword').value;
    const userId = localStorage.getItem('basta_user_id');
    const res = await fetch(`${API_URL}/update-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword })
    });
    if (res.ok) alert("Password updated!");
}

// --- 7. FAVORITES & UTILS ---
function toggleFavorite(name, url) {
    let favs = JSON.parse(localStorage.getItem('favs')) || [];
    const index = favs.findIndex(x => x.url === url);
    if (index > -1) { favs.splice(index, 1); } 
    else { favs.push({ name, url }); }
    localStorage.setItem('favs', JSON.stringify(favs));
    loadFavorites();
}

function loadFavorites() {
    const favs = JSON.parse(localStorage.getItem('favs')) || [];
    const gallery = document.getElementById('favoritesGallery');
    if (!gallery) return;
    gallery.innerHTML = favs.length ? "" : "No starred files.";
    favs.forEach(x => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span>⭐ ${x.name}</span>
            <div>
                <a href="${x.url}" target="_blank" style="color: #00ff88; text-decoration: none; margin-right: 15px;">Download</a>
                <span onclick="toggleFavorite('${x.name}', '${x.url}')" style="cursor:pointer; color: #ff4d4d;">✕</span>
            </div>`;
        gallery.appendChild(item);
    });
}

function showNotification(message) {
    const note = document.createElement('div');
    note.innerText = message;
    note.style.cssText = `position: fixed; top: 20px; right: 20px; background: #00ff88; color: #111; padding: 15px; border-radius: 10px; z-index: 1000;`;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 4000);
}

function startPolling() {
    setInterval(() => {
        if (localStorage.getItem('basta_user_id')) { fetchReceivedFiles(); }
    }, 30000); 
}

window.onload = () => {
    const savedUser = localStorage.getItem('basta_username');
    if (savedUser) { showDashboard(savedUser); }
};

// toggle dashboard
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}