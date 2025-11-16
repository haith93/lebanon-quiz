const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
    throw err;
  }
};

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

const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);
const Team = mongoose.models.Team || mongoose.model('Team', TeamSchema);
const AccessCode = mongoose.models.AccessCode || mongoose.model('AccessCode', AccessCodeSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

// API Routes

// Get all questions
app.get('/api/questions', async (req, res) => {
  await connectDB();
  try {
    const questions = await Question.find();
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add question
app.post('/api/questions', async (req, res) => {
  await connectDB();
  try {
    const question = new Question(req.body);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update question
app.put('/api/questions/:id', async (req, res) => {
  await connectDB();
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
app.delete('/api/questions/:id', async (req, res) => {
  await connectDB();
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all teams
app.get('/api/teams', async (req, res) => {
  await connectDB();
  try {
    const teams = await Team.find().sort({ score: -1, completedAt: 1 });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add team result
app.post('/api/teams', async (req, res) => {
  await connectDB();
  try {
    const team = new Team(req.body);
    await team.save();
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all access codes
app.get('/api/codes', async (req, res) => {
  await connectDB();
  try {
    const codes = await AccessCode.find().sort({ createdAt: -1 });
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate or retrieve access code for a team
app.post('/api/codes', async (req, res) => {
  await connectDB();
  try {
    const { teamName, forceNew } = req.body;
    
    if (!teamName || !teamName.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    // Check if team already has a code
    const existingCode = await AccessCode.findOne({ 
      teamName: teamName.trim(),
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
      teamName: teamName.trim(), 
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
app.put('/api/codes/:code', async (req, res) => {
  await connectDB();
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

// Get quiz duration
app.get('/api/settings/duration', async (req, res) => {
  await connectDB();
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
app.put('/api/settings/duration', async (req, res) => {
  await connectDB();
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

// Reset all data
app.delete('/api/reset', async (req, res) => {
  await connectDB();
  try {
    await Team.deleteMany({});
    await AccessCode.deleteMany({});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports.handler = serverless(app);