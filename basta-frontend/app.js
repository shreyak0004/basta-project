//const supabase = supabase.createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');
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
// function switchTab(tabName) {
//     document.querySelectorAll('.tab-window').forEach(t => t.classList.add('hidden'));
//     document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    
//     const targetTab = document.getElementById(`tab-${tabName}`);
//     if (targetTab) targetTab.classList.remove('hidden');
//     if (event) event.currentTarget.classList.add('active');
//     if (tabName === 'notes') {
//         fetchNotes();
//     }
// }

function switchTab(tabName) {
    document.querySelectorAll('.tab-window').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }

    // Trigger data loading based on tab
    if (tabName === 'notes') fetchNotes();
    if (tabName === 'friends') fetchFriends();
    
    // Handle active button state
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
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

// async function fetchMyFiles() {
//     const id = localStorage.getItem('basta_user_id');
//     const res = await fetch(`${API_URL}/my-files/${id}`);
//     const files = await res.json();
//     renderGallery('fileGallery', files);
// }

async function fetchMyFiles() {
    const id = localStorage.getItem('basta_user_id');
    const res = await fetch(`${API_URL}/my-files/${id}`);
    const files = await res.json();
    renderGallery('fileGallery', files, true); // True: I am the owner
}

async function fetchReceivedFiles() {
    const user = localStorage.getItem('basta_username');
    const res = await fetch(`${API_URL}/received-files/${user}`);
    const files = await res.json();
    
    if (files.length > 0) {
        // Check if the ID of the newest file is different from what we last saw
        const newestFileId = files[0].id; 
        
        if (window.lastFileId && newestFileId !== window.lastFileId) {
            showNotification(`You received a new file: ${files[0].filename}`); 
        }
        
        // Update the reference point
        window.lastFileId = newestFileId;
    }
    
    lastReceivedCount = files.length; 
    // IMPORTANT: Pass 'false' because these are RECEIVED files (user is not owner)
    renderGallery('receivedGallery', files, false);
}

// async function fetchReceivedFiles() {
//     const user = localStorage.getItem('basta_username');
//     const res = await fetch(`${API_URL}/received-files/${user}`);
//     const files = await res.json();
    
//     if (files.length > lastReceivedCount && lastReceivedCount !== 0) {
//         showNotification(`You received a new file!`); 
//     }
    
//     lastReceivedCount = files.length; 
//     renderGallery('receivedGallery', files);
// }

// function renderGallery(elementId, files) {
//     const gallery = document.getElementById(elementId);
//     if (!gallery) return;
//     gallery.innerHTML = files.length ? "" : "No files found.";
//     files.forEach(f => {
//         const item = document.createElement('div');
//         item.className = 'file-item';
//         item.innerHTML = `
//             <span>📄 ${f.filename}</span>
//             <div style="display: flex; gap: 10px; align-items: center;">
//                 <a href="${f.file_url}" target="_blank" style="color: #00ff88; text-decoration: none; font-weight: bold;">Download</a>
//                 <span onclick="toggleFavorite('${f.filename}', '${f.file_url}')" style="cursor:pointer;">⭐</span>
//                 <button onclick="deleteFile('${f.id}', '${f.file_url}')" 
//                         style="background: none; border: 1px solid #ff4d4d; color: #ff4d4d; border-radius: 20px; padding: 2px 8px; cursor: pointer; font-size: 10px;">
//                     Delete
//                 </button>
//             </div>`;
//         gallery.appendChild(item);
//     });
// }
function renderGallery(elementId, files, isOwnerView) { // Added isOwnerView
    const gallery = document.getElementById(elementId);
    if (!gallery) return;
    gallery.innerHTML = files.length ? "" : "No files found.";

    const limit = 3; 

    files.forEach((f, index) => {
        const item = document.createElement('div');
        item.className = `file-item ${index >= limit ? 'extra-file hidden' : ''}`;
        
        item.innerHTML = `
            <span>📄 ${f.filename}</span>
            <div style="display: flex; gap: 10px; align-items: center;">
                <a href="${f.file_url}" target="_blank" class="download-btn">Download</a>
                <span onclick="toggleFavorite('${f.filename}', '${f.file_url}')" style="cursor:pointer;">⭐</span>
                <button onclick="deleteFile('${f.id}', '${f.file_url}', ${isOwnerView})" class="delete-btn">Delete</button>
            </div>`;
        gallery.appendChild(item);
    });

    // If there are more files than the limit, add the "See More" button
    if (files.length > limit) {
        const seeMoreBtn = document.createElement('button');
        seeMoreBtn.innerText = "See More ▼";
        seeMoreBtn.className = "see-more-toggle";
        seeMoreBtn.onclick = () => toggleSeeMore(elementId, seeMoreBtn);
        gallery.appendChild(seeMoreBtn);
    }
}
// async function deleteFile(fileId, fileUrl) {
//     if (!confirm("Are you sure?")) return;
//     try {
//         const res = await fetch(`${API_URL}/delete-file`, {
//             method: 'DELETE',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ fileId, fileUrl })
//         });
//         if (res.ok) {
//             showNotification("File deleted!");
//             fetchMyFiles();
//             fetchReceivedFiles();
//         }
//     } catch (e) { console.error("Delete error:", e); }
// }

// async function deleteFile(fileId, fileUrl, isOwner) {
//     let deleteGlobal = false;

//     // Only the owner (sender) can choose to delete for everyone
//     if (isOwner) {
//         deleteGlobal = confirm("Delete for EVERYONE? (Cancel to delete for only yourself)");
//     }

//     if (deleteGlobal) {
//         // 1. Remove from Storage
//         const fileName = fileUrl.split('/').pop();
//         // await supabase.storage.from('uploads').remove([fileName]);

//         // // 2. Remove all entries with this URL (Global Delete)
//         // await supabase.from('files').delete().eq('file_url', fileUrl);
//         const response = await fetch(`${API_URL}/delete-file`, {
//     method: 'DELETE',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ fileId, fileUrl })
// });
//         alert("File deleted for all users.");
//     } else {
//         // Just delete the specific row for the current user (Self Delete)
//         await supabase.from('files').delete().eq('id', fileId); 
//         alert("File removed from your view.");
//     }
//     fetchFiles(); // Refresh the gallery
// }

async function deleteFile(fileId, fileUrl, isOwner) {
    // STEP 1: The "Oops" Protector
    // If they click Cancel here, the whole function STOPS.
    const proceed = confirm("Are you sure you want to delete this file?");
    if (!proceed) return; 

    let deleteGlobal = false;

    // STEP 2: The "Scope" Choice
    if (isOwner) {
        // OK = Everyone (True), Cancel = Only Me (False)
        deleteGlobal = confirm("Delete for EVERYONE? \n\n(Click 'OK' to delete for all users, or 'Cancel' to remove it only from your view)");
    }

    try {
        const response = await fetch(`${API_URL}/delete-file`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, fileUrl, deleteGlobal })
        });

        if (response.ok) {
            showNotification(deleteGlobal ? "File deleted globally! 🚀" : "Removed from your view.");
            fetchMyFiles();
            fetchReceivedFiles();
        }
    } catch (e) {
        console.error("Delete error:", e);
    }
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
            // const avatar = f.users?.avatar_url || "https://via.placeholder.com/30"; 
            const avatar = f.users?.avatar_url || `https://ui-avatars.com/api/?name=${f.friend_username || 'User'}&background=00d2ff&color=fff`;
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
    // Clear any existing intervals to prevent "Double Polling" if the function is called twice
    if (window.bastaPolling) clearInterval(window.bastaPolling);

    window.bastaPolling = setInterval(() => {
        const userId = localStorage.getItem('basta_user_id');
        if (userId) { 
            fetchReceivedFiles(); 
            // Optional: fetchNotes() as well if you want real-time note updates
        } else {
            clearInterval(window.bastaPolling); // Stop if user logged out
        }
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
// filter friends feature
function filterFriends() {
    // 1. Get the text from the search box and make it lowercase
    const input = document.getElementById('filterFriendsInput');
    const filter = input.value.toLowerCase();
    
    // 2. Get the container where your friends are listed
    const friendsList = document.getElementById('friendsList');
    
    // 3. Get all the individual friend cards
    const cards = friendsList.getElementsByClassName('file-item'); // Or 'friend-card' depending on your HTML

    // 4. Loop through each card
    for (let i = 0; i < cards.length; i++) {
        const friendName = cards[i].innerText || cards[i].textContent;
        
        // 5. If the name matches the search, show it. Otherwise, hide it.
        if (friendName.toLowerCase().indexOf(filter) > -1) {
            cards[i].style.display = ""; // Show
        } else {
            cards[i].style.display = "none"; // Hide
        }
    }
}
// --- Cosmic Notes Logic ---
function execCmd(command, value = null) {
    const editor = document.getElementById('noteContent');
    if (!editor) return;

    editor.focus();

    if (command === 'fontName') {
        // Force the command specifically for fonts
        document.execCommand('fontName', false, value);
    } else {
        document.execCommand(command, false, value);
    }
}

async function saveNote() {
    // ... your existing save logic
}
//notes section
// --- Cosmic Notes Logic ---

// 1. Save and Share a Note
// --- Cosmic Notes Frontend Logic ---

async function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').innerHTML; 
    const shared_with = document.getElementById('shareWithUser').value.trim();
    const owner = localStorage.getItem('basta_username');

    // Use innerText to check if there is actual text, not just hidden HTML tags
    const plainText = document.getElementById('noteContent').innerText.trim();

    if (!title || !plainText) {
        return alert("Note needs a title and content!");
    }

    try {
        const response = await fetch(`${API_URL}/save-note`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, owner, shared_with })
        });

        if (response.ok) {
            alert("Note Saved! ✨");
            document.getElementById('noteTitle').value = "";
            document.getElementById('noteContent').innerHTML = ""; // Correct way to clear a div
            document.getElementById('shareWithUser').value = "";
            fetchNotes(); 
        }
    } catch (e) { console.error("Error saving note:", e); }
}
async function fetchNotes() {
    const username = localStorage.getItem('basta_username');
    if (!username) return;

    try {
        const response = await fetch(`${API_URL}/fetch-notes/${username}`);
        if (!response.ok) throw new Error("Failed to fetch");
        
        const allNotes = await response.json();

        const myNotes = allNotes.filter(n => n.owner === username);
        const sharedWithMe = allNotes.filter(n => n.shared_with === username);

        renderNotes(myNotes, 'notesList', true);
        renderNotes(sharedWithMe, 'sharedNotesList', false);
    } catch (e) { console.error("Error fetching notes:", e); }
}

function renderNotes(notes, containerId, isOwner) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = notes.length ? "" : "No notes found in this sector.";

    const listLimit = 3; 
    const textLimit = 150; 

    notes.forEach((note, index) => {
        const div = document.createElement('div');
        // Handle Global List Visibility
        div.className = `file-item ${index >= listLimit ? 'extra-note hidden' : ''}`;
        
        // Handle Individual Text Truncation
        const isTextLong = note.content.length > textLimit;
        const displayContent = isTextLong ? note.content.substring(0, textLimit) + "..." : note.content;

        // NOTE: Changed ID to 'note-content-' to match your copyNoteText function
        div.innerHTML = `
            <div style="flex-grow: 1;">
                <h4 style="color: #00d2ff;">${note.title}</h4>
                <div id="note-content-${note.id}" style="font-size: 14px; opacity: 0.8; white-space: pre-wrap;">${displayContent}</div>
                
                
${isTextLong ? `<button class="see-more-text" onclick="toggleNoteContent(this, '${note.id}', '${encodeURIComponent(note.content)}')">Read More</button>` : ''}
                
                <small style="color: #64748b; display: block; margin-top: 5px;">
                    ${isOwner ? (note.shared_with ? `Shared with ${note.shared_with}` : 'Private') : `From ${note.owner}`}
                </small>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button onclick="copyNoteText('${note.id}')" title="Copy" class="copy-btn">📋</button>
                <button onclick="deleteNote('${note.id}')" title="Delete" class="delete-btn">🗑️</button>
            </div>`;
            
        container.appendChild(div);
    });

    // Global See More (For the whole list)
    if (notes.length > listLimit) {
        const globalBtn = document.createElement('button');
        globalBtn.innerText = "Show More Notes ▼";
        globalBtn.className = "see-more-toggle"; 
        globalBtn.onclick = () => toggleGlobalNotes(containerId, globalBtn);
        container.appendChild(globalBtn);
    }
}
// async function deleteNote(id) {
//     if (!confirm("Delete note?")) return;
//     const res = await fetch(`${API_URL}/delete-note/${id}`, { method: 'DELETE' });
//     if (res.ok) fetchNotes();
// }
async function deleteNote(id) {
    if (!confirm("Delete note?")) return;
    
    // Get the current user to verify ownership on the backend
    const owner = localStorage.getItem('basta_username');

    try {
        const res = await fetch(`${API_URL}/delete-note/${id}`, { 
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner }) // Pass the owner in the body
        });
        if (res.ok) fetchNotes();
    } catch (e) { console.error("Delete Error", e); }
}
//Feedback
async function submitFeedback() {
    const content = document.getElementById('feedbackText').value;
    const username = localStorage.getItem('basta_username');
    // Add logic here to fetch your API_URL/feedback or use supabase
    alert("Feedback sent to base! 🚀");
}
//copy link
function shareSite() {
    const siteUrl = window.location.href;
    navigator.clipboard.writeText(siteUrl).then(() => {
        alert("Link copied to clipboard! 🔗");
        // Optional: show a small toast notification instead of alert
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}
async function copyNoteText(noteId) {
    const noteElement = document.getElementById(`note-content-${noteId}`);
    if (!noteElement) return console.error("Note element not found");
    
    const textToCopy = noteElement.innerText;
    try {
        await navigator.clipboard.writeText(textToCopy);
        showNotification("Note copied to clipboard! 🔗");
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
}

function toggleSeeMore(galleryId, btn) {
    const gallery = document.getElementById(galleryId);
    const extraFiles = gallery.querySelectorAll('.extra-file');
    
    const isExpanded = btn.innerText.includes("Less");

    extraFiles.forEach(file => {
        if (isExpanded) {
            file.classList.add('hidden');
        } else {
            file.classList.remove('hidden');
        }
    });

    btn.innerText = isExpanded ? "See More ▼" : "See Less ▲";
}
// Function 1: Expands the text INSIDE a single note
// function toggleNoteContent(btn, noteId, fullContentEncoded) {
//     const noteBody = document.getElementById(`note-text-${noteId}`);
//     const fullContent = decodeURIComponent(fullContentEncoded);
    
//     if (btn.innerText === "Read More") {
//         noteBody.innerHTML = fullContent;
//         btn.innerText = "Read Less";
//     } else {
//         noteBody.innerHTML = fullContent.substring(0, 150) + "...";
//         btn.innerText = "Read More";
//     }
// }

function toggleNoteContent(btn, noteId, fullContentEncoded) {
    // 1. Force the ID to a string and trim it to be 100% sure
    const cleanId = String(noteId).trim();
    const targetId = `note-content-${cleanId}`;
    
    const noteBody = document.getElementById(targetId);
    
    if (!noteBody) {
        console.error("DOM Error: Could not find element with ID:", targetId);
        return;
    }

    const fullContent = decodeURIComponent(fullContentEncoded);
    const isExpanded = btn.innerText === "Read Less";

    if (!isExpanded) {
        noteBody.innerHTML = fullContent;
        btn.innerText = "Read Less";
    } else {
        noteBody.innerHTML = fullContent.substring(0, 150) + "...";
        btn.innerText = "Read More";
    }
}

// Function 2: Expands the WHOLE LIST of notes
function toggleGlobalNotes(containerId, btn) {
    const container = document.getElementById(containerId);
    const extraNotes = container.querySelectorAll('.extra-note');
    const isExpanded = btn.innerText.includes("Less");

    extraNotes.forEach(note => {
        isExpanded ? note.classList.add('hidden') : note.classList.remove('hidden');
    });

    btn.innerText = isExpanded ? "Show More Notes ▼" : "Show Less Notes ▲";
}