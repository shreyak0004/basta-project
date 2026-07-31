//const supabase = supabase.createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');
const API_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'))
    ? "http://localhost:3000"
    : "https://basta-project.onrender.com";
// Global Configuration for Link Detection
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z]{2,}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/g;
let lastReceivedCount = 0;
let selectedFilesList = [];

// --- 1. LOGIN & REGISTRATION ---
function startRegistrationFlow() {
    const username = document.getElementById('usernameInput').value.trim();
    const roll_number = document.getElementById('rollNumberInput').value.trim();
    if (!username || !roll_number) {
        alert("Please enter Username and Password first!");
        return;
    }
    document.getElementById('securityRegisterSection').classList.remove('hidden');
    document.querySelector('.forgot-pwd-wrapper').classList.add('hidden');
    document.getElementById('authButtons').classList.add('hidden');
    document.getElementById('completeRegButtons').classList.remove('hidden');
}

function cancelSecurityRegistration() {
    document.getElementById('securityRegisterSection').classList.add('hidden');
    document.querySelector('.forgot-pwd-wrapper').classList.remove('hidden');
    document.getElementById('authButtons').classList.remove('hidden');
    document.getElementById('completeRegButtons').classList.add('hidden');
    document.getElementById('registerSecurityQuestion').value = "";
    document.getElementById('registerSecurityAnswer').value = "";
}

async function completeRegistration() {
    const username = document.getElementById('usernameInput').value.trim();
    const roll_number = document.getElementById('rollNumberInput').value.trim();
    const security_question = document.getElementById('registerSecurityQuestion').value;
    const security_answer = document.getElementById('registerSecurityAnswer').value.trim();
    const messageBox = document.getElementById('authMessage');

    if (!username || !roll_number || !security_question || !security_answer) {
        alert("Please fill in all registration fields!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, roll_number, security_question, security_answer })
        });
        const data = await response.json();
        if (response.ok) {
            messageBox.innerText = "Registration Successful! Please login.";
            messageBox.style.color = "#00ff88";
            document.getElementById('usernameInput').value = "";
            document.getElementById('rollNumberInput').value = "";
            cancelSecurityRegistration();
        } else {
            messageBox.innerText = data.error || "Registration failed.";
            messageBox.style.color = "#ff4d4d";
        }
    } catch (e) {
        messageBox.innerText = "Server Error";
        messageBox.style.color = "#ff4d4d";
    }
}

function startForgotPasswordFlow(event) {
    if (event) event.preventDefault();
    document.getElementById('authFields').classList.add('hidden');
    document.getElementById('authButtons').classList.add('hidden');
    document.getElementById('forgotPasswordSection').classList.remove('hidden');
    document.getElementById('forgotUsernameInput').value = document.getElementById('usernameInput').value;
}

function cancelForgotPassword() {
    document.getElementById('forgotPasswordSection').classList.add('hidden');
    document.getElementById('authFields').classList.remove('hidden');
    document.getElementById('authButtons').classList.remove('hidden');
    document.getElementById('forgotUsernameInput').value = "";
    document.getElementById('forgotSecurityQuestion').value = "";
    document.getElementById('forgotAnswerInput').value = "";
    document.getElementById('forgotNewPasswordInput').value = "";
}

async function submitPasswordReset() {
    const username = document.getElementById('forgotUsernameInput').value.trim();
    const security_question = document.getElementById('forgotSecurityQuestion').value;
    const security_answer = document.getElementById('forgotAnswerInput').value.trim();
    const new_password = document.getElementById('forgotNewPasswordInput').value.trim();
    const messageBox = document.getElementById('authMessage');

    if (!username || !security_question || !security_answer || !new_password) {
        alert("Please fill in all recovery fields!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/forgot-password/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, security_question, security_answer, new_password })
        });
        const data = await response.json();
        if (response.ok) {
            messageBox.innerText = "Password reset successful! Please login.";
            messageBox.style.color = "#00ff88";
            cancelForgotPassword();
        } else {
            messageBox.innerText = data.error || "Reset failed.";
            messageBox.style.color = "#ff4d4d";
        }
    } catch (e) {
        messageBox.innerText = "Server error during reset.";
        messageBox.style.color = "#ff4d4d";
    }
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
    const landingSection = document.getElementById('landingSection');
    if (landingSection) landingSection.classList.add('hidden');
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('userGreeting').innerText = username;

    const avatar = localStorage.getItem('basta_avatar_url');
    if (avatar && avatar !== "null" && avatar !== "undefined") {
        document.getElementById('userAvatar').src = avatar;
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
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

    if (tabName === 'notes') fetchNotes();
    if (tabName === 'friends') fetchFriends();
    if (tabName === 'chat') {
        fetchChatFriends();
    } else {
        if (chatPolling) {
            clearInterval(chatPolling);
            chatPolling = null;
        }
        activeChatFriend = null;
    }

    if (tabName === 'communities') {
        fetchMyCommunities();
        showCommunityDiscovery();
    } else {
        if (communityPolling) {
            clearInterval(communityPolling);
            communityPolling = null;
        }
        activeCommunityId = null;
        activeCommunityName = "";
        lastCommunityStatusHash = null;
    }

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
}

// --- 3. FILE OPERATIONS ---
function handleFileSelection(event) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        selectedFilesList.push(files[i]);
    }
    renderSelectedFilesQueue();
    event.target.value = "";
}

function renderSelectedFilesQueue() {
    const queueContainer = document.getElementById('selectedFilesQueue');
    if (!queueContainer) return;

    queueContainer.innerHTML = "";
    if (selectedFilesList.length === 0) {
        return;
    }

    selectedFilesList.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'queue-item';

        const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

        item.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px;">
                <strong style="color: var(--space-text);">📄 ${file.name}</strong>
                <span style="font-size: 11px; color: var(--space-text-mute);">${sizeInMB} MB</span>
            </div>
            <button type="button" class="queue-remove-btn" onclick="removeFileFromQueue(${index})" title="Remove">✕</button>
        `;
        queueContainer.appendChild(item);
    });
}

function removeFileFromQueue(index) {
    selectedFilesList.splice(index, 1);
    renderSelectedFilesQueue();
}

async function uploadFile() {
    const receiver = document.getElementById('receiverInput').value;
    const uploaderId = localStorage.getItem('basta_user_id');
    const messageBox = document.getElementById('uploadMessage');

    if (selectedFilesList.length === 0) return alert("Please select at least one file!");

    const formData = new FormData();
    for (let i = 0; i < selectedFilesList.length; i++) {
        formData.append('files', selectedFilesList[i]);
    }
    formData.append('uploader_id', uploaderId);
    if (receiver) formData.append('receiver_username', receiver);

    messageBox.innerText = "Uploading...";

    try {
        const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
        const data = await response.json();

        if (response.ok) {
            messageBox.innerText = data.message || "Upload Successful!";
            selectedFilesList = [];
            renderSelectedFilesQueue();
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
    try {
        const res = await fetch(`${API_URL}/my-files/${id}`);
        if (!res.ok) {
            const errData = await res.json();
            console.error("Error fetching my files:", errData.error);
            renderGallery('fileGallery', [], true);
            return;
        }
        const files = await res.json();
        renderGallery('fileGallery', files, true);
    } catch (e) {
        console.error("Network error fetching my files:", e);
        renderGallery('fileGallery', [], true);
    }
}

async function fetchReceivedFiles() {
    const user = localStorage.getItem('basta_username');
    try {
        const res = await fetch(`${API_URL}/received-files/${user}`);
        if (!res.ok) {
            const errData = await res.json();
            console.error("Error fetching received files:", errData.error);
            renderGallery('receivedGallery', [], false);
            return;
        }
        const files = await res.json();

        if (files.length > 0) {
            const newestFileId = files[0].id;
            if (window.lastFileId && newestFileId !== window.lastFileId) {
                showNotification(`You received a new file: ${files[0].filename}`);
            }
            window.lastFileId = newestFileId;
        }

        lastReceivedCount = files.length;
        renderGallery('receivedGallery', files, false);
    } catch (e) {
        console.error("Network error fetching received files:", e);
        renderGallery('receivedGallery', [], false);
    }
}

function renderGallery(elementId, files, isOwnerView) {
    const gallery = document.getElementById(elementId);
    if (!gallery) return;
    gallery.innerHTML = files.length ? "" : "No files found.";

    const limit = 3;
    const favs = JSON.parse(localStorage.getItem('favs')) || [];

    files.forEach((f, index) => {
        const item = document.createElement('div');
        item.className = `file-item ${index >= limit ? 'extra-file hidden' : ''}`;

        const isFav = favs.some(x => x.url === f.file_url);
        const starSymbol = isFav ? "⭐" : "☆";

        const safeName = f.filename.replace(/"/g, '&quot;');
        item.innerHTML = `
            <span>📄 ${f.filename}</span>
            <div style="display: flex; gap: 10px; align-items: center;">
                <a href="${f.file_url}" target="_blank" class="download-btn">Download</a>
                <span onclick="toggleFavorite(this)" data-name="${safeName}" data-url="${f.file_url}" style="cursor:pointer; font-size: 18px;">${starSymbol}</span>
                <button onclick="deleteFile('${f.id}', '${f.file_url}', ${isOwnerView})" class="delete-btn" title="Delete">🗑️</button>
            </div>`;
        gallery.appendChild(item);
    });

    if (files.length > limit) {
        const seeMoreBtn = document.createElement('button');
        seeMoreBtn.innerText = "See More ▼";
        seeMoreBtn.className = "see-more-toggle";
        seeMoreBtn.onclick = () => toggleSeeMore(elementId, seeMoreBtn);
        gallery.appendChild(seeMoreBtn);
    }
}

async function deleteFile(fileId, fileUrl, isOwner) {
    const proceed = confirm("Are you sure you want to delete this file?");
    if (!proceed) return;

    let deleteGlobal = false;

    if (isOwner) {
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
        if (!response.ok) {
            const errData = await response.json();
            console.error("Error fetching friends:", errData.error);
            list.innerHTML = "Error loading friends.";
            return;
        }
        const friends = await response.json();

        list.innerHTML = "";

        if (friends.length === 0) {
            list.innerHTML = "No friends yet.";
            return;
        }

        friends.forEach(f => {
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
    const newUsername = document.getElementById('newUsername').value.trim();
    const userId = localStorage.getItem('basta_user_id');

    if (!newUsername) {
        alert("Please enter a new username!");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/update-username`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, newUsername })
        });
        const data = await res.json();
        if (res.ok) {
            document.getElementById('userGreeting').innerText = newUsername;
            localStorage.setItem('basta_username', newUsername);
            document.getElementById('newUsername').value = "";
            alert("Username updated successfully! ✨");
        } else {
            alert(data.error || "Username update failed.");
        }
    } catch (e) {
        alert("Server error updating username.");
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
function toggleFavorite(elOrName, url) {
    let name;
    if (elOrName instanceof HTMLElement) {
        name = elOrName.getAttribute('data-name');
        url = elOrName.getAttribute('data-url');
    } else {
        name = elOrName;
    }
    let favs = JSON.parse(localStorage.getItem('favs')) || [];
    const index = favs.findIndex(x => x.url === url);
    if (index > -1) {
        favs.splice(index, 1);
        if (elOrName instanceof HTMLElement) elOrName.innerText = "☆";
    }
    else {
        favs.push({ name, url });
        if (elOrName instanceof HTMLElement) elOrName.innerText = "⭐";
    }
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
        const safeName = x.name.replace(/"/g, '&quot;');
        item.innerHTML = `
            <span>⭐ ${x.name}</span>
            <div>
                <a href="${x.url}" target="_blank" style="color: #00ff88; text-decoration: none; margin-right: 15px;">Download</a>
                <span onclick="toggleFavorite(this)" data-name="${safeName}" data-url="${x.url}" style="cursor:pointer; color: #ff4d4d;">✕</span>
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
    if (window.bastaPolling) clearInterval(window.bastaPolling);

    window.bastaPolling = setInterval(() => {
        const userId = localStorage.getItem('basta_user_id');
        if (userId) {
            fetchReceivedFiles();
        } else {
            clearInterval(window.bastaPolling);
        }
    }, 30000);
}

window.onload = () => {
    const savedUser = localStorage.getItem('basta_username');
    if (savedUser) {
        // Hide landing page, skip directly to dashboard
        const landingSection = document.getElementById('landingSection');
        if (landingSection) landingSection.classList.add('hidden');
        showDashboard(savedUser);
    }
};

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

function filterFriends() {
    const input = document.getElementById('filterFriendsInput');
    const filter = input.value.toLowerCase();
    const friendsList = document.getElementById('friendsList');
    const cards = friendsList.getElementsByClassName('file-item');

    for (let i = 0; i < cards.length; i++) {
        const friendName = cards[i].innerText || cards[i].textContent;
        cards[i].style.display = friendName.toLowerCase().indexOf(filter) > -1 ? "" : "none";
    }
}

// --- 8. COSMIC NOTES LOGIC ---
function execCmd(command, value = null) {
    const editor = document.getElementById('noteContent');
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value);
}

async function saveNote() {
    const editor = document.getElementById('noteContent'); // Get the element reference

    // ✨ FORCE AUTO-DETECT: This ensures the last word is linkified before saving
    linkifyEditor(editor);

    const title = document.getElementById('noteTitle').value.trim();
    const content = editor.innerHTML; // Grab the HTML which now contains <a> tags
    const shared_with = document.getElementById('shareWithUser').value.trim();
    const owner = localStorage.getItem('basta_username');
    const plainText = editor.innerText.trim();
    if (!title || !plainText) return alert("Note needs a title and content!");

    try {
        const response = await fetch(`${API_URL}/save-note`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, owner, shared_with })
        });

        if (response.ok) {
            alert("Note Saved! ✨");
            document.getElementById('noteTitle').value = "";
            document.getElementById('noteContent').innerHTML = "";
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

    window.notesCache = window.notesCache || {};
    notes.forEach((note, index) => {
        window.notesCache[note.id] = note.content;
        const div = document.createElement('div');
        div.className = `file-item ${index >= listLimit ? 'extra-note hidden' : ''}`;

        const isTextLong = note.content.length > textLimit;
        let displayContent = isTextLong ? note.content.substring(0, textLimit) + "..." : note.content;

        // Add this line to ensure any saved links open in a new tab
        displayContent = displayContent.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
        div.innerHTML = `
            <div style="flex-grow: 1;">
                <h4 style="color: #00d2ff;">${note.title}</h4>
                <div id="note-content-${note.id}" style="font-size: 14px; opacity: 0.8; white-space: pre-wrap;">${displayContent}</div>
                ${isTextLong ? `<button class="see-more-text" onclick="toggleNoteContent(this, '${note.id}')">Read More</button>` : ''}
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

    if (notes.length > listLimit) {
        const globalBtn = document.createElement('button');
        globalBtn.innerText = "Show More Notes ▼";
        globalBtn.className = "see-more-toggle";
        globalBtn.onclick = () => toggleGlobalNotes(containerId, globalBtn);
        container.appendChild(globalBtn);
    }
}

async function deleteNote(id) {
    if (!confirm("Delete note?")) return;

    const owner = localStorage.getItem('basta_username');

    try {
        // We pass owner in the URL string: ?owner=username
        const res = await fetch(`${API_URL}/delete-note/${id}?owner=${owner}`, {
            method: 'DELETE'
            // No headers or body needed anymore!
        });

        if (res.ok) {
            showNotification("Note deleted!");
            fetchNotes();
        } else {
            const errData = await res.json();
            console.error("Server refused delete:", errData.error);
        }
    } catch (e) {
        console.error("Network Error:", e);
    }
}
async function submitFeedback() {
    const content = document.getElementById('feedbackText').value;
    const username = localStorage.getItem('basta_username');
    alert("Feedback sent to base! 🚀");
}

function shareSite() {
    const siteUrl = window.location.href;
    navigator.clipboard.writeText(siteUrl).then(() => {
        alert("Link copied to clipboard! 🔗");
    }).catch(err => { console.error('Failed to copy: ', err); });
}

async function copyNoteText(noteId) {
    const noteElement = document.getElementById(`note-content-${noteId}`);
    if (!noteElement) return console.error("Note element not found");

    try {
        await navigator.clipboard.writeText(noteElement.innerText);
        showNotification("Note copied to clipboard! 🔗");
    } catch (err) { console.error('Failed to copy: ', err); }
}

function toggleSeeMore(galleryId, btn) {
    const gallery = document.getElementById(galleryId);
    const extraFiles = gallery.querySelectorAll('.extra-file');
    const isExpanded = btn.innerText.includes("Less");

    extraFiles.forEach(file => {
        isExpanded ? file.classList.add('hidden') : file.classList.remove('hidden');
    });

    btn.innerText = isExpanded ? "See More ▼" : "See Less ▲";
}

function toggleNoteContent(btn, noteId, fullContentEncoded = null) {
    const cleanId = String(noteId).trim();
    const noteBody = document.getElementById(`note-content-${cleanId}`);

    if (!noteBody) {
        console.error("DOM Error: Could not find element with ID:", `note-content-${cleanId}`);
        return;
    }

    const fullContent = fullContentEncoded
        ? decodeURIComponent(fullContentEncoded)
        : (window.notesCache && window.notesCache[cleanId]);

    const isExpanded = btn.innerText === "Read Less";

    if (!isExpanded) {
        let content = fullContent || '';
        content = content.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
        noteBody.innerHTML = content;
        btn.innerText = "Read Less";
    } else {
        let content = fullContent || '';
        let displayContent = content.substring(0, 150) + "...";
        displayContent = displayContent.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
        noteBody.innerHTML = displayContent;
        btn.innerText = "Read More";
    }
}

function toggleGlobalNotes(containerId, btn) {
    const container = document.getElementById(containerId);
    const extraNotes = container.querySelectorAll('.extra-note');
    const isExpanded = btn.innerText.includes("Less");

    extraNotes.forEach(note => {
        isExpanded ? note.classList.add('hidden') : note.classList.remove('hidden');
    });

    btn.innerText = isExpanded ? "Show More Notes ▼" : "Show Less Notes ▲";
}

// // ============================================================
// // ✨ NEW: AUTO-DETECT LINKS IN SPACE NOTES (WYSIWYG Editor)
// // ============================================================

// const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z]{2,}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/g;

// function saveCursor(el) {
//     const sel = window.getSelection();
//     if (!sel.rangeCount) return null;
//     const range = sel.getRangeAt(0);
//     const preRange = document.createRange();
//     preRange.selectNodeContents(el);
//     preRange.setEnd(range.startContainer, range.startOffset);
//     return preRange.toString().length;
// }

// function restoreCursor(el, offset) {
//     const sel = window.getSelection();
//     const range = document.createRange();
//     let charCount = 0, found = false;

//     function traverse(node) {
//         if (found) return;
//         if (node.nodeType === Node.TEXT_NODE) {
//             const next = charCount + node.length;
//             if (next >= offset) {
//                 range.setStart(node, offset - charCount);
//                 range.collapse(true);
//                 found = true;
//             }
//             charCount = next;
//         } else {
//             for (const child of node.childNodes) traverse(child);
//         }
//     }

//     traverse(el);
//     if (!found) range.selectNodeContents(el);
//     sel.removeAllRanges();
//     sel.addRange(range);
// }

// function linkifyEditor(el) {
//     const cursorPos = saveCursor(el);

//     const walker = document.createTreeWalker(
//         el,
//         NodeFilter.SHOW_TEXT,
//         {
//             acceptNode(node) {
//                 return node.parentElement.closest('a')
//                     ? NodeFilter.FILTER_REJECT
//                     : NodeFilter.FILTER_ACCEPT;
//             }
//         }
//     );

//     const textNodes = [];
//     while (walker.nextNode()) textNodes.push(walker.currentNode);

//     textNodes.forEach(node => {
//         const text = node.nodeValue;
//         if (!URL_REGEX.test(text)) return;
//         URL_REGEX.lastIndex = 0;

//         const frag = document.createDocumentFragment();
//         let lastIdx = 0, match;

//         while ((match = URL_REGEX.exec(text)) !== null) {
//             if (match.index > lastIdx) {
//                 frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
//             }
//             const a = document.createElement('a');
//             a.href = match[0];
//             a.textContent = match[0];
//             a.target = '_blank';
//             a.rel = 'noopener noreferrer';
//             a.style.cssText = 'color:#00d2ff;text-decoration:underline;';
//             frag.appendChild(a);
//             lastIdx = match.index + match[0].length;
//         }

//         if (lastIdx < text.length) {
//             frag.appendChild(document.createTextNode(text.slice(lastIdx)));
//         }

//         node.parentNode.replaceChild(frag, node);
//     });

//     if (document.activeElement === el && cursorPos !== null) {
//         restoreCursor(el, cursorPos);
//     }
// }

// // Attach listeners after DOM is ready
// document.addEventListener('DOMContentLoaded', () => {
//     const noteEditor = document.getElementById('noteContent');
//     if (!noteEditor) return;

//     noteEditor.addEventListener('keyup', (e) => {
//         if (e.key === ' ' || e.key === 'Enter') linkifyEditor(noteEditor);
//     });

//     noteEditor.addEventListener('paste', () => {
//         setTimeout(() => linkifyEditor(noteEditor), 50);
//     });
// });

// 1. Add a space at the end of the regex to ensure it doesn't grab trailing punctuation
// ============================================================
// ✨ AUTO-DETECT LINKS LOGIC
// ============================================================

//const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z]{2,}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/g;

// 1. Save cursor position before we modify the HTML
function saveCursor(el) {
    if (document.activeElement !== el) return null;
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const range = sel.getRangeAt(0);

    // Ensure the selection range is physically inside the target editor
    if (!el.contains(range.startContainer)) return null;

    const preRange = document.createRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length;
}

// 2. Teleport the cursor back to where it was after links are added
function restoreCursor(el, offset) {
    if (offset === null || document.activeElement !== el) return;
    const sel = window.getSelection();
    const range = document.createRange();
    let charCount = 0, found = false;

    function traverse(node) {
        if (found) return;
        if (node.nodeType === Node.TEXT_NODE) {
            const next = charCount + node.length;
            if (next >= offset) {
                range.setStart(node, offset - charCount);
                range.collapse(true);
                found = true;
            }
            charCount = next;
        } else {
            for (const child of node.childNodes) traverse(child);
        }
    }
    traverse(el);
    if (!found) range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
}

// 3. The main engine that finds text and converts to <a> tags
function linkifyEditor(el) {
    const cursorPos = saveCursor(el);
    URL_REGEX.lastIndex = 0;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let currentNode;
    while (currentNode = walker.nextNode()) {
        if (!currentNode.parentElement.closest('a')) {
            textNodes.push(currentNode);
        }
    }

    textNodes.forEach(node => {
        const text = node.nodeValue;
        URL_REGEX.lastIndex = 0;
        if (!URL_REGEX.test(text)) return;

        URL_REGEX.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let lastIdx = 0, match;

        while ((match = URL_REGEX.exec(text)) !== null) {
            frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
            const a = document.createElement('a');
            a.href = match[0];
            a.textContent = match[0];
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = "editor-link"; // Matches CSS below
            frag.appendChild(a);
            lastIdx = URL_REGEX.lastIndex;
        }
        frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        node.parentNode.replaceChild(frag, node);
    });

    if (cursorPos !== null) restoreCursor(el, cursorPos);
}

// 4. Listeners to trigger the detection
// document.addEventListener('DOMContentLoaded', () => {
//     const noteEditor = document.getElementById('noteContent');
//     if (!noteEditor) return;

//     noteEditor.addEventListener('keyup', (e) => {
//         // Trigger only on Space or Enter so it doesn't lag while typing words
//         if (e.key === ' ' || e.key === 'Enter') {
//             setTimeout(() => linkifyEditor(noteEditor), 10);
//         }
//     });

//     noteEditor.addEventListener('paste', () => {
//         setTimeout(() => linkifyEditor(noteEditor), 50);
//     });
// });
document.addEventListener('DOMContentLoaded', () => {
    const noteEditor = document.getElementById('noteContent');

    if (!noteEditor) {
        console.error("❌ CRITICAL: Could not find the element with ID 'noteContent'. Check your HTML!");
        return;
    }

    console.log("✅ Basta Link System is active and watching the editor.");

    noteEditor.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            console.log("🚀 Space/Enter detected! Attempting to linkify...");
            setTimeout(() => linkifyEditor(noteEditor), 10);
        }
    });

    // Auto-detect link on paste
    noteEditor.addEventListener('paste', () => {
        console.log("📋 Paste detected! Attempting to linkify...");
        setTimeout(() => linkifyEditor(noteEditor), 50);
    });

    // Auto-detect link on blur/loss of focus
    noteEditor.addEventListener('blur', () => {
        console.log("💤 Blur detected! Attempting to linkify...");
        linkifyEditor(noteEditor);
    });

    noteEditor.addEventListener('click', (e) => {
        // Check if the clicked element is an <a> tag or inside one
        const link = e.target.closest('a');
        if (link) {
            // Prevent the editor from focusing and open the link
            window.open(link.href, '_blank');
        }
    });
});

// ============================================================
// ✨ ORBIT LIVE CHAT LOGIC
// ============================================================

let activeChatFriend = null;
let chatPolling = null;

async function fetchChatFriends() {
    const userId = localStorage.getItem('basta_user_id');
    const container = document.getElementById('chatFriendsList');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/friends/${userId}`);
        if (!response.ok) {
            const errData = await response.json();
            console.error("Error fetching chat friends:", errData.error);
            container.innerHTML = `<div style="padding: 15px; font-size: 12px; color: #ff4d4d; text-align: center;">Error loading contacts.</div>`;
            return;
        }
        const friends = await response.json();

        container.innerHTML = "";
        if (!friends || friends.length === 0) {
            container.innerHTML = `<div style="padding: 15px; font-size: 12px; color: var(--space-text-mute); text-align: center;">No crewmates in orbit yet.</div>`;
            return;
        }

        friends.forEach(f => {
            const avatar = f.users?.avatar_url || `https://ui-avatars.com/api/?name=${f.friend_username || 'User'}&background=00d2ff&color=fff`;
            const item = document.createElement('div');
            item.className = `chat-friend-item ${activeChatFriend === f.friend_username ? 'active' : ''}`;
            item.onclick = () => selectChatFriend(f.friend_username, avatar);
            item.innerHTML = `
                <img src="${avatar}">
                <span>${f.friend_username}</span>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = `<div style="padding: 15px; font-size: 12px; color: #ff4d4d; text-align: center;">Error establishing link.</div>`;
    }
}

function selectChatFriend(username, avatarUrl) {
    activeChatFriend = username;

    // Update active state in sidebar
    document.querySelectorAll('.chat-friend-item').forEach(item => {
        if (item.querySelector('span').innerText === username) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Show Chat main area
    document.getElementById('chatMainPlaceholder').classList.add('hidden');
    const chatMainArea = document.getElementById('chatMainArea');
    chatMainArea.classList.remove('hidden');

    // Set header & personalized placeholder
    document.getElementById('chatHeaderAvatar').src = avatarUrl;
    document.getElementById('chatHeaderName').innerText = username;

    const statusLabel = document.getElementById('chatHeaderStatus');
    if (statusLabel) {
        statusLabel.innerText = "Secure Uplink Active";
        statusLabel.style.color = "#00ff88"; // neon green
    }

    const messageInput = document.getElementById('chatMessageInput');
    if (messageInput) {
        messageInput.placeholder = `Transmit secure message to @${username}...`;
    }

    // Clear input & messages
    document.getElementById('chatMessageInput').value = "";
    document.getElementById('chatMessages').innerHTML = `<div style="text-align: center; color: var(--space-text-mute); font-size: 12px; margin-top: 20px;">Establishing secure uplink...</div>`;
    window.lastStatusHash = null;

    // Fetch messages & Start polling
    fetchChatMessages();

    if (chatPolling) clearInterval(chatPolling);
    chatPolling = setInterval(fetchChatMessages, 3000);
}

async function deleteSingleMessage(messageId) {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
        const response = await fetch(`${API_URL}/messages/single/${messageId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            window.lastStatusHash = null;
            await fetchChatMessages();
        } else {
            const data = await response.json();
            alert(data.error || "Failed to delete message.");
        }
    } catch (e) {
        console.error("Error deleting message:", e);
    }
}

async function clearDirectChat() {
    if (!activeChatFriend) return;
    const currentUser = localStorage.getItem('basta_username');
    if (!currentUser) return;

    if (!confirm(`Are you sure you want to clear your chat history with @${activeChatFriend}?`)) return;

    try {
        const response = await fetch(`${API_URL}/messages/${currentUser}/${activeChatFriend}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            window.lastStatusHash = null;
            await fetchChatMessages();
        } else {
            const data = await response.json();
            alert(data.error || "Failed to clear chat history.");
        }
    } catch (e) {
        console.error("Error clearing chat:", e);
        alert("Network error clearing chat history.");
    }
}

async function fetchChatMessages() {
    if (!activeChatFriend) return;
    const currentUser = localStorage.getItem('basta_username');
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_URL}/messages/${currentUser}/${activeChatFriend}`);
        if (!response.ok) return;
        const messages = await response.json();

        const container = document.getElementById('chatMessages');
        const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 60;

        const oldMessagesCount = container.querySelectorAll('.chat-message').length;

        if (messages.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--space-text-mute); font-size: 12px; margin-top: 20px;">No messages in this orbit. Start chatting!</div>`;
            return;
        }

        const currentStatusHash = messages.map(m => `${m.id}-${m.is_read}`).join(',');
        if (container.innerHTML.includes("Establishing secure uplink...") || window.lastStatusHash !== currentStatusHash) {
            window.lastStatusHash = currentStatusHash;
            container.innerHTML = "";
            let lastDateStr = "";
            messages.forEach(msg => {
                const msgDate = new Date(msg.created_at);
                const dateStr = msgDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

                if (dateStr !== lastDateStr) {
                    const dateHeader = document.createElement('div');
                    dateHeader.style.cssText = 'align-self: center; background: rgba(255,255,255,0.03); color: var(--space-text-mute); padding: 4px 14px; border-radius: 12px; font-size: 10px; margin: 12px 0 6px 0; font-family: Orbitron, sans-serif; letter-spacing: 0.5px; border: 1px solid var(--space-border);';
                    dateHeader.innerText = dateStr;
                    container.appendChild(dateHeader);
                    lastDateStr = dateStr;
                }

                const isSent = msg.sender_username === currentUser;
                const msgDiv = document.createElement('div');
                msgDiv.className = `chat-message ${isSent ? 'sent' : 'received'}`;

                const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let statusHtml = '';
                if (isSent) {
                    const checkmarkColor = msg.is_read ? '#00d2ff' : '#64748b';
                    const checkmarks = msg.is_read ? '✓✓' : '✓';
                    const checkmarkClass = msg.is_read ? 'chat-seen-checkmark' : '';
                    statusHtml = `<span class="${checkmarkClass}" style="color: ${checkmarkColor}; margin-left: 5px; font-weight: bold;" title="${msg.is_read ? 'Seen' : 'Sent'}">${checkmarks}</span>`;
                }

                const deleteBtn = isSent 
                    ? `<button class="delete-msg-btn" onclick="deleteSingleMessage('${msg.id}')" title="Delete Message">🗑️</button>` 
                    : '';

                msgDiv.innerHTML = `
                    ${escapeHTML(msg.message_text)}
                    <span class="msg-time">${time}${statusHtml}${deleteBtn}</span>
                `;
                container.appendChild(msgDiv);
            });

            // Scroll to bottom
            if (isAtBottom || oldMessagesCount === 0) {
                container.scrollTo({ top: container.scrollHeight, behavior: oldMessagesCount === 0 ? 'auto' : 'smooth' });
            }
        }
    } catch (e) {
        console.error("Error loading chat messages:", e);
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const text = input.value.trim();
    if (!text || !activeChatFriend) return;

    const currentUser = localStorage.getItem('basta_username');
    if (!currentUser) return;

    input.value = ""; // Clear input immediately for UX

    // --- OPTIMISTIC UI UPDATE ---
    const container = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message sent';
    msgDiv.style.opacity = '0.7'; // Indicate sending status

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const statusHtml = `<span style="color: #64748b; margin-left: 5px; font-weight: bold;">✓</span>`;

    msgDiv.innerHTML = `
        ${escapeHTML(text)}
        <span class="msg-time">${time}${statusHtml}</span>
    `;

    // Clear placeholder text if it's the first message
    if (container.innerHTML.includes("No messages in this orbit")) {
        container.innerHTML = "";
    }

    container.appendChild(msgDiv);

    // Smooth scroll to bottom instantly
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

    try {
        const response = await fetch(`${API_URL}/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_username: currentUser,
                receiver_username: activeChatFriend,
                message_text: text
            })
        });

        if (response.ok) {
            window.lastStatusHash = null;
            await fetchChatMessages();
        } else {
            msgDiv.style.border = '1px solid #ff4d4d'; // red border on failure
            msgDiv.style.background = 'rgba(255, 77, 77, 0.05)';
            console.error("Failed to send message");
        }
    } catch (e) {
        msgDiv.style.border = '1px solid #ff4d4d';
        msgDiv.style.background = 'rgba(255, 77, 77, 0.05)';
        console.error("Error sending message:", e);
    }
}

// Simple HTML escaping helper for chat messages
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}