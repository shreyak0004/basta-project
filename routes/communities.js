const express = require('express');
const router = express.Router();

module.exports = (supabase) => {
    // Get list of registered users
    router.get('/users', async (req, res) => {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, avatar_url, created_at')
            .order('username', { ascending: true });

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    });

    // Get list of all stations/communities (including member counts)
    router.get('/stations', async (req, res) => {
        const { data: stations, error: stationsError } = await supabase
            .from('stations')
            .select('*')
            .order('name', { ascending: true });

        if (stationsError) return res.status(400).json({ error: stationsError.message });

        const { data: members, error: membersError } = await supabase
            .from('station_members')
            .select('station_id');

        if (membersError) return res.status(400).json({ error: membersError.message });

        const counts = {};
        members.forEach(m => {
            counts[m.station_id] = (counts[m.station_id] || 0) + 1;
        });

        const enriched = stations.map(s => ({
            ...s,
            member_count: counts[s.id] || 0
        }));

        res.json(enriched);
    });

    // Get communities joined by a specific user
    router.get('/stations/my/:userId', async (req, res) => {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('station_members')
            .select('station_id, stations(*)')
            .eq('user_id', userId);

        if (error) return res.status(400).json({ error: error.message });
        
        const joined = data.map(item => item.stations).filter(Boolean);
        res.json(joined);
    });

    // Create a new community (Creator becomes Commander)
    router.post('/create-station', async (req, res) => {
        const { name, description, creatorId } = req.body;
        if (!name) return res.status(400).json({ error: "Community name is required!" });

        const { data: newStation, error: insertError } = await supabase
            .from('stations')
            .insert([{ name, description, creator_id: creatorId }])
            .select()
            .single();

        if (insertError) return res.status(400).json({ error: insertError.message });

        // Add creator as Commander
        const { error: joinError } = await supabase
            .from('station_members')
            .insert([{ station_id: newStation.id, user_id: creatorId, role: 'commander' }]);

        if (joinError && joinError.message.includes('role')) {
            const { error: fallbackError } = await supabase
                .from('station_members')
                .insert([{ station_id: newStation.id, user_id: creatorId }]);
            if (fallbackError) return res.status(400).json({ error: fallbackError.message });
        } else if (joinError) {
            return res.status(400).json({ error: joinError.message });
        }

        res.json({ message: "Basta Community established!", station: newStation });
    });

    // Join a community (User becomes Explorer)
    router.post('/join-station', async (req, res) => {
        const { stationId, userId } = req.body;
        const { error } = await supabase
            .from('station_members')
            .insert([{ station_id: stationId, user_id: userId, role: 'explorer' }]);

        if (error && error.message.includes('role')) {
            const { error: fallbackError } = await supabase
                .from('station_members')
                .insert([{ station_id: stationId, user_id: userId }]);
            if (fallbackError) return res.status(400).json({ error: fallbackError.message });
        } else if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.json({ message: "Successfully joined Basta Community!" });
    });

    // Leave a community
    router.post('/leave-station', async (req, res) => {
        const { stationId, userId } = req.body;
        const { error } = await supabase
            .from('station_members')
            .delete()
            .eq('station_id', stationId)
            .eq('user_id', userId);

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: "Left Basta Community." });
    });

    // Get members of a community
    router.get('/stations/:stationId/members', async (req, res) => {
        const { stationId } = req.params;
        
        let { data, error } = await supabase
            .from('station_members')
            .select('user_id, role, users:user_id(username, avatar_url)')
            .eq('station_id', stationId);

        if (error && error.message.includes('role')) {
            const fallback = await supabase
                .from('station_members')
                .select('user_id, users:user_id(username, avatar_url)')
                .eq('station_id', stationId);
            
            if (fallback.error) return res.status(400).json({ error: fallback.error.message });
            data = fallback.data;
        } else if (error) {
            return res.status(400).json({ error: error.message });
        }

        const members = (data || []).map(item => ({
            user_id: item.user_id,
            role: item.role || 'explorer',
            username: item.users ? item.users.username : 'Unknown',
            avatar_url: item.users ? item.users.avatar_url : null
        }));

        res.json(members);
    });

    // Promote a member to Sub-Commander
    router.post('/stations/promote', async (req, res) => {
        const { stationId, userId, commanderId } = req.body;
        if (!stationId || !userId || !commanderId) {
            return res.status(400).json({ error: "Missing parameters!" });
        }

        // Verify if the promoter is the commander of the station
        const { data: creatorCheck, error: creatorError } = await supabase
            .from('station_members')
            .select('role')
            .eq('station_id', stationId)
            .eq('user_id', commanderId)
            .single();

        if (creatorError || !creatorCheck || creatorCheck.role !== 'commander') {
            return res.status(403).json({ error: "Only the Commander can promote crew members!" });
        }

        // Update the member's role to 'sub-commander'
        const { error: updateError } = await supabase
            .from('station_members')
            .update({ role: 'sub-commander' })
            .eq('station_id', stationId)
            .eq('user_id', userId);

        if (updateError) return res.status(400).json({ error: updateError.message });
        res.json({ message: "Crew member promoted to Sub-Commander!" });
    });

    // Get discussion history for a community
    router.get('/stations/:stationId/messages', async (req, res) => {
        const { stationId } = req.params;
        const { data, error } = await supabase
            .from('station_messages')
            .select('*')
            .eq('station_id', stationId)
            .order('created_at', { ascending: true });

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    });

    // Send a message to a community discussion group
    router.post('/stations/:stationId/send-message', async (req, res) => {
        const { stationId } = req.params;
        const { sender_username, message_text } = req.body;

        if (!message_text) return res.status(400).json({ error: "Message text cannot be empty." });

        const { data, error } = await supabase
            .from('station_messages')
            .insert([{ station_id: stationId, sender_username, message_text }])
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: "Transmission posted!", data });
    });

    // Delete a single community message by ID with validation
    router.delete('/stations/messages/:messageId', async (req, res) => {
        const { messageId } = req.params;
        const { requester } = req.query; // username of the person requesting deletion
        
        if (!requester) {
            return res.status(400).json({ error: "Requester identity is required." });
        }

        const idVal = isNaN(messageId) ? messageId : parseInt(messageId, 10);

        // Fetch the message details
        const { data: message, error: getError } = await supabase
            .from('station_messages')
            .select('sender_username, station_id')
            .eq('id', idVal)
            .single();

        if (getError || !message) {
            return res.status(404).json({ error: "Message not found." });
        }

        // If requester is the message sender, delete immediately
        if (message.sender_username === requester) {
            const { error: delError } = await supabase
                .from('station_messages')
                .delete()
                .eq('id', idVal);
            if (delError) return res.status(400).json({ error: delError.message });
            return res.json({ message: "Message deleted!" });
        }

        // Otherwise, verify roles (requester must be commander or sub-commander of this station)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('username', requester)
            .single();

        if (userError || !user) {
            return res.status(403).json({ error: "Identity verification failed." });
        }

        const { data: member, error: memberError } = await supabase
            .from('station_members')
            .select('role')
            .eq('station_id', message.station_id)
            .eq('user_id', user.id)
            .single();

        if (memberError || !member || (member.role !== 'commander' && member.role !== 'sub-commander')) {
            return res.status(403).json({ error: "Unauthorized. Only Commanders and Sub-Commanders can delete other crew members' messages." });
        }

        // Delete authorized
        const { error: delError } = await supabase
            .from('station_messages')
            .delete()
            .eq('id', idVal);

        if (delError) return res.status(400).json({ error: delError.message });
        res.json({ message: "Message deleted by command authority!" });
    });

    return router;
};
