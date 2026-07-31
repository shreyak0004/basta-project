# ☄️ BASTA — Cosmic File & Communication Hub

BASTA is a sleek, modern, space-themed file sharing, private messaging, and community discussion platform built on a secure Express node and Supabase database telemetry.

![JS](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Node](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

---

## 🌌 Key Operations

### 📁 Quick Share (File Station)
* **Drag-and-Drop Triggers**: Modern dash-border trigger boxes.
* **Telemetry Pre-upload Queue**: Preview, analyze, and remove files from the upload list before transmitting to orbit.
* **Direct Sharing**: Specify recipient usernames for direct encrypted-like file routing.

### 💬 Orbit Transmissions (Direct Messaging)
* **Double checkmarks**: Real-time read receipts (double blue checkmarks when seen).
* **WhatsApp-like Deletion**:
  * **Clear Chat**: Clears the entire chat history with a click.
  * **Single Deletion**:Muted red trash bins `🗑️` next to sent messages to delete specific timeline notes.

### 👥 Basta Communities
* **Community Sectors**: Make or join specialized crew discussion stations.
* **Multi-User Downlink**: Real-time group chats displaying sender handles above text bubbles.

### 📝 Cosmic Notebook
* **Split Layout**: Composer editor on the left, personal notebook list on the right.
* **Rich formatting**: Toolbar supporting Bold, Italic, Underline, Font-face selectors, and color picker wheels.
* **Notes Sharing**: Keep notes private or route them to specific crew members.

---

## 🛠️ Launch & Setup Telemetry

### 1. Configure Local Environmental Keys
Create a `.env` file in the root directory:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-supabase-anon-key
PORT=3000
```

### 2. Configure Database Tables (Supabase)
Run the following DDL script in your **Supabase SQL Editor**:

```sql
-- 1. Users Profile Metadata
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. File Uplinks
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    uploader_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_username TEXT REFERENCES users(username) ON DELETE SET NULL,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Notes Database
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    owner TEXT NOT NULL,
    shared_with TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Direct Messages
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_username TEXT NOT NULL,
    receiver_username TEXT NOT NULL,
    message_text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Basta Communities Table
CREATE TABLE IF NOT EXISTS stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Community Members Table
CREATE TABLE IF NOT EXISTS station_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (station_id, user_id)
);

-- 7. Community Messages
CREATE TABLE IF NOT EXISTS station_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
    sender_username TEXT NOT NULL,
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Install & Start Server
Execute these terminal inputs at the root of the project:
```bash
# Install dependencies
npm install

# Start Express server
npm start
```
Now, open your browser and navigate to: **`http://localhost:3000`**

---

## 📁 System Architecture
```
├── index.js                  # Main server entry & Direct Chat/File APIs
├── routes/
│   └── communities.js        # Community discussion endpoints
└── basta-frontend/
    ├── index.html            # Core HTML Dashboard
    ├── style.css             # Space theme layout definitions
    ├── app.js                # Core controller & Direct message handler
    ├── communities.js        # Community dashboard controllers
    └── landing.js            # Landing page authentication logic
```
# Basta – Secure File Sharing Web Application

🌐 **Live Demo:** https://basta-project.vercel.app

📂 **Source Code:** https://github.com/shreyak0004/Basta
