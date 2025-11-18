const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lebanon-quiz', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// Schemas
const QuestionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  correctAnswer: Number
}, { timestamps: true });

const TeamSchema = new mongoose.Schema({
  name: String,
  code: String,
  score: Number,
  totalQuestions: Number,
  completedAt: { type: Date, default: Date.now }
});

const AccessCodeSchema = new mongoose.Schema({
  teamName: String,
  code: String,
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const SettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});

const Question = mongoose.model('Question', QuestionSchema);
const Team = mongoose.model('Team', TeamSchema);
const AccessCode = mongoose.model('AccessCode', AccessCodeSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

// API Routes - Changed from /api/* to /v1/*

// Get all questions
app.get('/v1/questions', async (req, res) => {
  try {
    const questions = await Question.find();
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add question
app.post('/v1/questions', async (req, res) => {
  try {
    const question = new Question(req.body);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update question
app.put('/v1/questions/:id', async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete question
app.delete('/v1/questions/:id', async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all teams
app.get('/v1/teams', async (req, res) => {
  try {
    const teams = await Team.find().sort({ score: -1, completedAt: 1 });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add team result
app.post('/v1/teams', async (req, res) => {
  try {
    const team = new Team(req.body);
    await team.save();
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all access codes - Changed from /api/codes to /v1/access
app.get('/v1/access', async (req, res) => {
  try {
    const codes = await AccessCode.find().sort({ createdAt: -1 });
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate or retrieve access code for a team
app.post('/v1/access', async (req, res) => {
  try {
    const { teamName, forceNew } = req.body;
    
    if (!teamName || !teamName.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const normalizedTeamName = teamName.trim().toLowerCase();

    // Check if team already has a code (case-insensitive)
    const existingCode = await AccessCode.findOne({ 
      teamName: new RegExp(`^${normalizedTeamName}$`, 'i'),
      used: false 
    });

    if (existingCode && !forceNew) {
      return res.json({ 
        code: existingCode.code,
        teamName: existingCode.teamName,
        isExisting: true 
      });
    }

    // Generate new code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const accessCode = new AccessCode({ 
      teamName: teamName.trim(), // Keep original case for display
      code 
    });
    await accessCode.save();
    
    res.json({ 
      code: accessCode.code,
      teamName: accessCode.teamName,
      isExisting: false 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark code as used
app.put('/v1/access/:code', async (req, res) => {
  try {
    const accessCode = await AccessCode.findOneAndUpdate(
      { code: req.params.code },
      { used: true },
      { new: true }
    );
    res.json(accessCode);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get quiz duration - Changed from /api/settings/duration to /v1/config/duration
app.get('/v1/config/duration', async (req, res) => {
  try {
    let setting = await Settings.findOne({ key: 'duration' });
    if (!setting) {
      setting = new Settings({ key: 'duration', value: 180 });
      await setting.save();
    }
    res.json({ duration: setting.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update quiz duration
app.put('/v1/config/duration', async (req, res) => {
  try {
    const setting = await Settings.findOneAndUpdate(
      { key: 'duration' },
      { value: req.body.duration },
      { upsert: true, new: true }
    );
    res.json({ duration: setting.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset all data - Changed from /api/reset to /v1/data/reset
app.delete('/v1/data/reset', async (req, res) => {
  try {
    await Team.deleteMany({});
    await AccessCode.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});