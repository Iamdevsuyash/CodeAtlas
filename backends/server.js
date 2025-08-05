const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DATA_FILE = './discussions.json';

// Helper to read discussions
function readDiscussions() {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Helper to write discussions
function writeDiscussions(discussions) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(discussions, null, 2));
}

// Get all discussions
app.get('/api/discussions', (req, res) => {
    try {
        const discussions = readDiscussions();
        res.json(discussions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch discussions' });
    }
});

// Get a specific discussion
app.get('/api/discussions/:id', (req, res) => {
    try {
        const discussions = readDiscussions();
        const discussion = discussions.find(d => d.id == req.params.id);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        res.json(discussion);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch discussion' });
    }
});

// Post a new discussion
app.post('/api/discussions', (req, res) => {
    try {
        const { author, title, content, timestamp } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required.' });
        }
        const discussions = readDiscussions();
        const newDiscussion = {
            id: Date.now(),
            author: author || 'Anonymous',
            title,
            content,
            timestamp: timestamp || new Date().toISOString(),
            likes: 0,
            replies: []
        };
        discussions.unshift(newDiscussion);
        writeDiscussions(discussions);
        res.status(201).json(newDiscussion);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create discussion' });
    }
});

// Like a discussion
app.post('/api/discussions/:id/like', (req, res) => {
    try {
        const discussions = readDiscussions();
        const discussion = discussions.find(d => d.id == req.params.id);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        discussion.likes += 1;
        writeDiscussions(discussions);
        res.json({ likes: discussion.likes });
    } catch (error) {
        res.status(500).json({ error: 'Failed to like discussion' });
    }
});

// Add a reply to a discussion
app.post('/api/discussions/:id/replies', (req, res) => {
    try {
        const { author, content } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Reply content is required.' });
        }
        const discussions = readDiscussions();
        const discussion = discussions.find(d => d.id == req.params.id);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        const newReply = {
            id: Date.now(),
            author: author || 'Anonymous',
            content,
            timestamp: new Date().toISOString()
        };
        discussion.replies.push(newReply);
        writeDiscussions(discussions);
        res.status(201).json(newReply);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add reply' });
    }
});

// Get replies for a discussion
app.get('/api/discussions/:id/replies', (req, res) => {
    try {
        const discussions = readDiscussions();
        const discussion = discussions.find(d => d.id == req.params.id);
        if (!discussion) {
            return res.status(404).json({ error: 'Discussion not found' });
        }
        res.json(discussion.replies || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch replies' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Discussions server running on http://localhost:${PORT}`);
});
