// ============================================================
// ✨ BASTA COMMUNITY (COMMUNITIES & GROUP CHATS) LOGIC
// ============================================================

// Basta Community State
let activeCommunityId = null;
let activeCommunityName = "";
let communityPolling = null;
let cachedCommunities = [];
let cachedMyCommunities = [];
let lastCommunityStatusHash = null;

// Show discover panel and fetch all communities
async function showCommunityDiscovery() {
    if (communityPolling) {
        clearInterval(communityPolling);
        communityPolling = null;
    }
    activeCommunityId = null;
    activeCommunityName = "";
    lastCommunityStatusHash = null;

    document.getElementById('stationChatPanel').classList.add('hidden');
    document.getElementById('stationDiscoverPanel').classList.remove('hidden');
    
    document.querySelectorAll('#myStationsList .chat-friend-item').forEach(item => {
        item.classList.remove('active');
    });

    await fetchAllCommunities();
}

async function fetchAllCommunities() {
    const grid = document.getElementById('stationsDiscoverGrid');
    if (!grid) return;

    try {
        const response = await fetch(`${API_URL}/stations`);
        if (!response.ok) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ff4d4d; font-size: 13px;">Failed to load communities.</div>`;
            return;
        }
        const stations = await response.json();
        cachedCommunities = stations;
        renderCommunitiesGrid(stations);
    } catch (e) {
        console.error("Error fetching communities:", e);
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ff4d4d; font-size: 13px;">Error connecting to network.</div>`;
    }
}

function renderCommunitiesGrid(stations) {
    const grid = document.getElementById('stationsDiscoverGrid');
    if (!grid) return;

    grid.innerHTML = "";
    if (stations.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--space-text-mute); font-size: 13px; padding-top: 30px;">No active communities established. Be the first to establish one!</div>`;
        return;
    }

    stations.forEach(station => {
        const isMember = cachedMyCommunities.some(s => s.id === station.id);

        const card = document.createElement('div');
        card.className = 'station-card';
        
        card.innerHTML = `
            <div>
                <div class="station-card-header">
                    <h4 class="station-card-title">${escapeHTML(station.name)}</h4>
                    <span class="station-card-members">${station.member_count} Members</span>
                </div>
                <p class="station-card-desc">${escapeHTML(station.description || 'No community details reported.')}</p>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 10px; width: 100%;">
                ${isMember 
                    ? `<button onclick="selectCommunity('${station.id}', '${escapeHTML(station.name).replace(/'/g, "\\'")}')" class="crew-action-btn primary" style="width: 100%;">Enter Community 🚀</button>`
                    : `<button onclick="joinCommunity('${station.id}')" class="crew-action-btn secondary" style="width: 100%;">Join Community 🛰️</button>`
                }
            </div>
        `;
        grid.appendChild(card);
    });
}

async function fetchMyCommunities() {
    const userId = localStorage.getItem('basta_user_id');
    const container = document.getElementById('myStationsList');
    if (!container) return;

    try {
        const response = await fetch(`${API_URL}/stations/my/${userId}`);
        if (!response.ok) return;
        const stations = await response.json();
        cachedMyCommunities = stations;

        container.innerHTML = "";
        if (stations.length === 0) {
            container.innerHTML = `<div style="padding: 15px; font-size: 11px; color: var(--space-text-mute); text-align: center;">No communities linked.</div>`;
            return;
        }

        stations.forEach(s => {
            const item = document.createElement('div');
            item.className = `chat-friend-item ${activeCommunityId === s.id ? 'active' : ''}`;
            item.onclick = () => selectCommunity(s.id, s.name);
            item.innerHTML = `
                <div style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--space-cyan); background: rgba(0, 180, 216, 0.05); display: flex; align-items: center; justify-content: center; font-size: 16px;">🛰️</div>
                <span>${escapeHTML(s.name)}</span>
            `;
            container.appendChild(item);
        });
    } catch (e) {
        console.error("Error loading my communities:", e);
    }
}

function filterCommunities() {
    const query = document.getElementById('stationSearchInput').value.trim().toLowerCase();
    if (!query) {
        renderCommunitiesGrid(cachedCommunities);
        return;
    }
    const filtered = cachedCommunities.filter(s => 
        s.name.toLowerCase().includes(query) || 
        (s.description && s.description.toLowerCase().includes(query))
    );
    renderCommunitiesGrid(filtered);
}

function showCreateCommunityModal() {
    document.getElementById('createStationPanel').classList.remove('hidden');
    document.getElementById('newStationName').focus();
}

function hideCreateCommunityModal() {
    document.getElementById('createStationPanel').classList.add('hidden');
    document.getElementById('newStationName').value = "";
    document.getElementById('newStationDesc').value = "";
    document.getElementById('createStationMessage').innerText = "";
}

async function createCommunity() {
    const nameInput = document.getElementById('newStationName');
    const descInput = document.getElementById('newStationDesc');
    const msgBox = document.getElementById('createStationMessage');
    
    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const creatorId = localStorage.getItem('basta_user_id');

    if (!name) {
        msgBox.style.color = "#ff4d4d";
        msgBox.innerText = "Community name is required!";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/create-station`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, creatorId })
        });
        const data = await response.json();

        if (response.ok) {
            msgBox.style.color = "#00ff88";
            msgBox.innerText = "Community created successfully!";
            
            await fetchMyCommunities();
            await fetchAllCommunities();
            
            setTimeout(() => {
                hideCreateCommunityModal();
                selectCommunity(data.station.id, data.station.name);
            }, 1000);
        } else {
            msgBox.style.color = "#ff4d4d";
            msgBox.innerText = data.error || "Failed to create community.";
        }
    } catch (e) {
        msgBox.style.color = "#ff4d4d";
        msgBox.innerText = "Connection error establishing community.";
    }
}

async function joinCommunity(stationId) {
    const userId = localStorage.getItem('basta_user_id');
    try {
        const response = await fetch(`${API_URL}/join-station`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationId, userId })
        });

        if (response.ok) {
            await fetchMyCommunities();
            await fetchAllCommunities();
            
            const station = cachedCommunities.find(s => s.id === stationId);
            if (station) {
                selectCommunity(stationId, station.name);
            }
        } else {
            const data = await response.json();
            alert(data.error || "Failed to join community.");
        }
    } catch (e) {
        alert("Network error joining community.");
    }
}

async function leaveActiveCommunity() {
    if (!activeCommunityId) return;
    if (!confirm(`Are you sure you want to leave "${activeCommunityName}"?`)) return;

    const userId = localStorage.getItem('basta_user_id');
    try {
        const response = await fetch(`${API_URL}/leave-station`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stationId: activeCommunityId, userId })
        });

        if (response.ok) {
            activeCommunityId = null;
            activeCommunityName = "";
            lastCommunityStatusHash = null;
            if (communityPolling) clearInterval(communityPolling);
            
            await fetchMyCommunities();
            await showCommunityDiscovery();
        } else {
            const data = await response.json();
            alert(data.error || "Failed to leave community.");
        }
    } catch (e) {
        alert("Network error leaving community.");
    }
}

function selectCommunity(stationId, stationName) {
    activeCommunityId = stationId;
    activeCommunityName = stationName;

    document.querySelectorAll('#myStationsList .chat-friend-item').forEach(item => {
        const spanText = item.querySelector('span').innerText;
        if (spanText === stationName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    document.getElementById('stationDiscoverPanel').classList.add('hidden');
    const chatPanel = document.getElementById('stationChatPanel');
    chatPanel.classList.remove('hidden');

    document.getElementById('activeStationName').innerText = stationName;
    
    const station = cachedCommunities.find(s => s.id === stationId) || cachedMyCommunities.find(s => s.id === stationId);
    const desc = station ? station.description : "Multi-user discussion room";
    const members = station ? `${station.member_count || 1} Members` : "Connected";
    document.getElementById('activeStationMeta').innerText = `${members} | ${desc}`;

    document.getElementById('stationMessageInput').value = "";
    document.getElementById('stationMessages').innerHTML = `<div style="text-align: center; color: var(--space-text-mute); font-size: 12px; margin-top: 20px;">Synchronizing logs...</div>`;
    lastCommunityStatusHash = null;

    fetchCommunityMessages();
    
    if (communityPolling) clearInterval(communityPolling);
    communityPolling = setInterval(fetchCommunityMessages, 3000);
}

async function deleteCommunityMessage(messageId) {
    if (!confirm("Are you sure you want to delete this community message?")) return;
    try {
        const response = await fetch(`${API_URL}/stations/messages/${messageId}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            lastCommunityStatusHash = null;
            await fetchCommunityMessages();
        } else {
            const data = await response.json();
            alert(data.error || "Failed to delete message.");
        }
    } catch (e) {
        console.error("Error deleting community message:", e);
    }
}

async function fetchCommunityMessages() {
    if (!activeCommunityId) return;

    try {
        const response = await fetch(`${API_URL}/stations/${activeCommunityId}/messages`);
        if (!response.ok) return;
        const messages = await response.json();

        const container = document.getElementById('stationMessages');
        const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 60;
        
        const oldMessagesCount = container.querySelectorAll('.chat-message').length;

        if (messages.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--space-text-mute); font-size: 12px; margin-top: 20px;">Timeline empty. Send a message to start the discussion!</div>`;
            return;
        }

        const currentStatusHash = messages.map(m => `${m.id}-${m.sender_username}`).join(',');
        if (container.innerHTML.includes("Synchronizing logs...") || lastCommunityStatusHash !== currentStatusHash) {
            lastCommunityStatusHash = currentStatusHash;
            container.innerHTML = "";
            
            let lastDateStr = "";
            const currentUser = localStorage.getItem('basta_username');

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
                
                const senderNameHtml = !isSent 
                    ? `<div style="font-size: 10px; color: var(--space-cyan); margin-bottom: 4px; font-weight: bold; font-family: 'Orbitron', sans-serif;">@${msg.sender_username}</div>`
                    : '';

                const deleteBtn = isSent 
                    ? `<button class="delete-msg-btn" onclick="deleteCommunityMessage('${msg.id}')" title="Delete Message">🗑️</button>` 
                    : '';

                msgDiv.innerHTML = `
                    ${senderNameHtml}
                    ${escapeHTML(msg.message_text)}
                    <span class="msg-time">${time}${deleteBtn}</span>
                `;
                container.appendChild(msgDiv);
            });

            if (isAtBottom || oldMessagesCount === 0) {
                container.scrollTo({ top: container.scrollHeight, behavior: oldMessagesCount === 0 ? 'auto' : 'smooth' });
            }
        }
    } catch (e) {
        console.error("Error loading community messages:", e);
    }
}

async function sendCommunityMessage() {
    const input = document.getElementById('stationMessageInput');
    const text = input.value.trim();
    if (!text || !activeCommunityId) return;

    const currentUser = localStorage.getItem('basta_username');
    if (!currentUser) return;

    input.value = "";

    const container = document.getElementById('stationMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message sent';
    msgDiv.style.opacity = '0.7';
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    msgDiv.innerHTML = `
        ${escapeHTML(text)}
        <span class="msg-time">${time}</span>
    `;
    
    if (container.innerHTML.includes("Timeline empty")) {
        container.innerHTML = "";
    }
    
    container.appendChild(msgDiv);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

    try {
        const response = await fetch(`${API_URL}/stations/${activeCommunityId}/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_username: currentUser,
                message_text: text
            })
        });

        if (response.ok) {
            lastCommunityStatusHash = null;
            await fetchCommunityMessages();
        } else {
            msgDiv.style.border = '1px solid #ff4d4d';
            msgDiv.style.background = 'rgba(255, 77, 77, 0.05)';
            console.error("Failed to transmit message");
        }
    } catch (e) {
        msgDiv.style.border = '1px solid #ff4d4d';
        msgDiv.style.background = 'rgba(255, 77, 77, 0.05)';
        console.error("Error sending message:", e);
    }
}
