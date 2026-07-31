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

    // Create a new community
    router.post('/create-station', async (req, res) => {
        const { name, description, creatorId } = req.body;
        if (!name) return res.status(400).json({ error: "Community name is required!" });

        const { data: newStation, error: insertError } = await supabase
            .from('stations')
            .insert([{ name, description, creator_id: creatorId }])
            .select()
            .single();

        if (insertError) return res.status(400).json({ error: insertError.message });

        const { error: joinError } = await supabase
            .from('station_members')
            .insert([{ station_id: newStation.id, user_id: creatorId }]);

        if (joinError) return res.status(400).json({ error: joinError.message });

        res.json({ message: "Basta Community established!", station: newStation });
    });

    // Join a community
    router.post('/join-station', async (req, res) => {
        const { stationId, userId } = req.body;
        const { error } = await supabase
            .from('station_members')
            .insert([{ station_id: stationId, user_id: userId }]);

        if (error) return res.status(400).json({ error: error.message });
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

    // Delete a single community message by ID
    router.delete('/stations/messages/:messageId', async (req, res) => {
        const { messageId } = req.params;
        const idVal = isNaN(messageId) ? messageId : parseInt(messageId, 10);
        const { error } = await supabase
            .from('station_messages')
            .delete()
            .eq('id', idVal);

        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: "Community message deleted successfully!" });
    });

    return router;
};
