import { useState, useEffect } from 'react';
import axios from 'axios';
import * as lucide from 'lucide-react';

// const API_URL = 'http://localhost:5000/api' || import.meta.env.VITE_API_URL;
// // const API_URL = 'http://localhost:5000/api' || import.meta.env.VITE_API_URL || '/.netlify/functions/api';

// console.log('API_URL:', import.meta.env.VITE_API_URL || 'http://localhost:5000/v1');
// // const API_URL = 'http://localhost:5000/api';
// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/v1';

const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/v1' 
  : '/v1';

console.log('🔍 Final API_URL:', API_URL);

function App() {
  const [view, setView] = useState('login');
  const [accessCode, setAccessCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [currentTeam, setCurrentTeam] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(180);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [newQuestion, setNewQuestion] = useState({ question: '', options: ['', '', ''], correctAnswer: 0 });
  const [quizDuration, setQuizDuration] = useState(180);
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeTeamName, setCodeTeamName] = useState('');
  const [finalScore, setFinalScore] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [accessCodes, setAccessCodes] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [questionsRes, teamsRes, codesRes, durationRes] = await Promise.all([
        axios.get(`${API_URL}/questions`),
        axios.get(`${API_URL}/teams`),
        axios.get(`${API_URL}/access`),
        axios.get(`${API_URL}/config/duration`)
      ]);

      setQuestions(questionsRes.data);
      setTeams(teamsRes.data);
      setAccessCodes(codesRes.data);
      setQuizDuration(durationRes.data.duration);
      setTimeRemaining(durationRes.data.duration);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveQuestion = async (question) => {
    try {
      if (question._id) {
        await axios.put(`${API_URL}/questions/${question._id}`, question);
      } else {
        await axios.post(`${API_URL}/questions`, question);
      }
      loadData();
    } catch (error) {
      console.error('Error saving question:', error);
    }
  };

  const deleteQuestion = async (id) => {
    try {
      await axios.delete(`${API_URL}/questions/${id}`);
      loadData();
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  };

  const updateDuration = async (duration) => {
    try {
      await axios.put(`${API_URL}/config/duration`, { duration });
      setQuizDuration(duration);
      setTimeRemaining(duration);
    } catch (error) {
      console.error('Error updating duration:', error);
    }
  };

  const generateCode = async (forceNew = false) => {
    if (!codeTeamName.trim()) {
      alert('الرجاء إدخال اسم الفريق');
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/access`, { 
        teamName: codeTeamName,
        forceNew 
      });
      setGeneratedCode(res.data.code);
      if (res.data.isExisting) {
        alert(`الرمز الموجود للفريق "${res.data.teamName}" هو: ${res.data.code}`);
      }
      loadData();
    } catch (error) {
      console.error('Error generating code:', error);
      alert('حدث خطأ أثناء إنشاء الرمز');
    }
  };

  const resetAllData = async () => {
    if (window.confirm('هل أنت متأكد من حذف جميع النتائج والرموز؟ هذا الإجراء لا يمكن التراجع عنه!')) {
      try {
        await axios.delete(`${API_URL}/data/reset`);
        loadData();
        setGeneratedCode('');
        setCodeTeamName('');
        alert('تم حذف جميع البيانات بنجاح!');
      } catch (error) {
        console.error('Error resetting data:', error);
        alert('حدث خطأ أثناء حذف البيانات');
      }
    }
  };

  useEffect(() => {
    if (quizStarted && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            submitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [quizStarted, timeRemaining]);

  const handleLogin = () => {
    // if (adminPassword === import.meta.env.VITE_ADMIN_PASSWORD || 'rz.admin') {
    if (adminPassword === 'rz.admin') {
  
      setView('admin');
      return;
    }

    const codeObj = accessCodes.find(c => c.code === accessCode.toUpperCase() && !c.used);
    if (codeObj && teamName.trim()) {
      setCurrentTeam({ name: teamName, code: accessCode.toUpperCase() });
      setView('quiz');
    } else {
      alert('رمز غير صالح أو مستخدم بالفعل');
    }
  };

  const startQuiz = () => {
    if (questions.length === 0) {
      alert('لا توجد أسئلة متاحة. الرجاء الاتصال بالمسؤول.');
      return;
    }
    setQuizStarted(true);
    setTimeRemaining(quizDuration);
  };

  const handleAnswerSelect = (optionIndex) => {
    setSelectedAnswer(optionIndex);
  };

  const handleNext = () => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = selectedAnswer;
    setAnswers(newAnswers);
    setSelectedAnswer(null);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      submitQuiz();
    }
  };

  const submitQuiz = async () => {
    const finalAnswers = [...answers];
    if (selectedAnswer !== null) {
      finalAnswers[currentQuestionIndex] = selectedAnswer;
    }

    let score = 0;
    questions.forEach((q, idx) => {
      if (finalAnswers[idx] === q.correctAnswer) {
        score++;
      }
    });

    setFinalScore({ score, total: questions.length });

    try {
      await axios.post(`${API_URL}/teams`, {
        name: currentTeam.name,
        code: currentTeam.code,
        score,
        totalQuestions: questions.length
      });

      await axios.put(`${API_URL}/access/${currentTeam.code}`);
      
      loadData();
      setView('results');
      setQuizStarted(false);
    } catch (error) {
      console.error('Error submitting quiz:', error);
    }
  };

  const addQuestion = () => {
    if (newQuestion.question && newQuestion.options.every(o => o.trim())) {
      const question = {
        question: newQuestion.question,
        options: newQuestion.options,
        correctAnswer: newQuestion.correctAnswer
      };
      saveQuestion(question);
      setNewQuestion({ question: '', options: ['', '', ''], correctAnswer: 0 });
    } else {
      alert('الرجاء ملء جميع الحقول');
    }
  };

  const updateQuestion = () => {
    saveQuestion(editingQuestion);
    setEditingQuestion(null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-white to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-10 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-emerald-700 mb-3">🇱🇧 مسابقة لبنان</h1>
            <p className="text-gray-700 text-lg">اختبر معلوماتك عن لبنان</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="اسم الفريق"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-4 py-3 border-2 bg-white border-gray-300 rounded-xl focus:border-emerald-500 focus:outline-none text-right text-gray-900"
            />
            <input
              type="text"
              placeholder="رمز الدخول"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              className="w-full px-4 py-3 border-2 bg-white border-gray-300 rounded-xl focus:border-emerald-500 focus:outline-none text-center uppercase text-gray-900 tracking-wider"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition font-semibold text-lg shadow-lg"
            >
              دخول
            </button>

            <div className="text-center mt-6 pt-6 border-t border-gray-200">
              <input
                type="password"
                placeholder="كلمة مرور المسؤول"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-2 border bg-white border-gray-300 rounded-xl focus:border-red-500 focus:outline-none text-center text-sm text-gray-900"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">لوحة التحكم</h1>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={resetAllData}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm sm:text-base"
              >
                <lucide.Trash2 size={18} />
                <span className="hidden sm:inline">إعادة تعيين</span>
              </button>
              <button
                onClick={() => {
                  setView('login');
                  setAdminPassword('');
                }}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm sm:text-base"
              >
                <lucide.LogOut size={18} />
                خروج
              </button>
            </div>
          </div>

          {/* Duration Settings */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2 text-gray-900">
              <lucide.Clock size={24} />
              إعدادات المسابقة
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <label className="font-semibold text-gray-700">مدة المسابقة (بالثواني):</label>
              <input
                type="number"
                value={quizDuration}
                onChange={(e) => updateDuration(Number(e.target.value))}
                className="px-4 py-2 border-2 bg-white border-gray-300 rounded-lg w-full sm:w-32 text-gray-900"
              />
              <span className="text-gray-600 font-mono text-lg">{formatTime(quizDuration)}</span>
            </div>
          </div>

          {/* Code Generation */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2 text-gray-900">
              <lucide.QrCode size={24} />
              إنشاء رمز دخول
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="اسم الفريق"
                value={codeTeamName}
                onChange={(e) => setCodeTeamName(e.target.value)}
                className="w-full px-4 py-3 border-2 bg-white border-gray-300 rounded-lg text-right text-gray-900"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => generateCode(false)}
                  className="flex-1 px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  إنشاء أو عرض الرمز
                </button>
                <button
                  onClick={() => generateCode(true)}
                  className="flex-1 px-4 sm:px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
                >
                  إنشاء رمز جديد (قسري)
                </button>
              </div>
              {generatedCode && (
                <div className="mt-4 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                  <p className="text-2xl sm:text-3xl font-bold text-center text-blue-800 tracking-wider mb-2">{generatedCode}</p>
                  <p className="text-sm text-gray-700 text-center">الفريق: {codeTeamName}</p>
                  <p className="text-xs text-gray-600 text-center mt-2">شارك هذا الرمز مع الفريق</p>
                </div>
              )}
            </div>
          </div>

          {/* Teams Results */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2 text-gray-900">
              <lucide.Award size={24} />
              نتائج الفرق
            </h2>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 sm:px-4 py-3 text-right text-gray-900 font-semibold">الترتيب</th>
                      <th className="px-2 sm:px-4 py-3 text-right text-gray-900 font-semibold">الفريق</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-gray-900 font-semibold">النتيجة</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-gray-900 font-semibold hidden sm:table-cell">النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-3 font-bold text-gray-900">{idx + 1}</td>
                        <td className="px-2 sm:px-4 py-3 text-gray-900">{team.name}</td>
                        <td className="px-2 sm:px-4 py-3 text-center font-semibold text-gray-900">
                          {team.score} / {team.totalQuestions}
                        </td>
                        <td className="px-2 sm:px-4 py-3 text-center text-gray-700 hidden sm:table-cell">
                          {Math.round((team.score / team.totalQuestions) * 100)}%
                        </td>
                      </tr>
                    ))}
                    {teams.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                          لا توجد فرق بعد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Questions Management */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2 text-gray-900">
              <lucide.Users size={24} />
              إدارة الأسئلة
            </h2>

            <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <h3 className="font-semibold mb-3 text-gray-900">إضافة سؤال جديد</h3>
              <input
                type="text"
                placeholder="السؤال"
                value={newQuestion.question}
                onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                className="w-full px-4 py-2 border-2 bg-white border-gray-300 rounded-lg mb-2 text-right text-gray-900"
              />
              {newQuestion.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    checked={newQuestion.correctAnswer === idx}
                    onChange={() => setNewQuestion({ ...newQuestion, correctAnswer: idx })}
                    className="w-4 h-4"
                  />
                  <input
                    type="text"
                    placeholder={`خيار ${idx + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const newOptions = [...newQuestion.options];
                      newOptions[idx] = e.target.value;
                      setNewQuestion({ ...newQuestion, options: newOptions });
                    }}
                    className="flex-1 px-4 py-2 border-2 bg-white border-gray-300 rounded-lg text-right text-gray-900"
                  />
                </div>
              ))}
              <button
                onClick={addQuestion}
                className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <lucide.Plus size={18} />
                إضافة السؤال
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((q, qIndex) => (
                <div key={q._id || qIndex} className="p-4 border-2 border-gray-200 rounded-lg">
                  {editingQuestion?._id === q._id ? (
                    <div>
                      <input
                        type="text"
                        value={editingQuestion.question}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                        className="w-full px-4 py-2 border-2 bg-white border-gray-300 rounded-lg mb-2 text-right text-gray-900"
                      />
                      {editingQuestion.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          <input
                            type="radio"
                            checked={editingQuestion.correctAnswer === idx}
                            onChange={() => setEditingQuestion({ ...editingQuestion, correctAnswer: idx })}
                            className="w-4 h-4"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOptions = [...editingQuestion.options];
                              newOptions[idx] = e.target.value;
                              setEditingQuestion({ ...editingQuestion, options: newOptions });
                            }}
                            className="flex-1 px-4 py-2 border-2 bg-white border-gray-300 rounded-lg text-right text-gray-900"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={updateQuestion}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                          <lucide.Save size={18} />
                          حفظ
                        </button>
                        <button
                          onClick={() => setEditingQuestion(null)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                        >
                          <lucide.X size={18} />
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-lg mb-2 text-right text-gray-900">{q.question}</p>
                      <ul className="space-y-1 mb-3 text-right">
                        {q.options.map((opt, idx) => (
                          <li key={idx} className={idx === q.correctAnswer ? 'text-emerald-600 font-semibold' : 'text-gray-700'}>
                            {idx + 1}. {opt}
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 text-sm"
                        >
                          <lucide.Edit2 size={14} />
                          تعديل
                        </button>
                        <button
                          onClick={() => deleteQuestion(q._id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1 text-sm"
                        >
                          <lucide.Trash2 size={14} />
                          حذف
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {questions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  لا توجد أسئلة. قم بإضافة سؤال جديد أعلاه.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'quiz') {
    if (!quizStarted) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-white to-red-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 max-w-2xl w-full text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-emerald-700 mb-4">🇱🇧 مسابقة لبنان</h1>
            <p className="text-xl sm:text-2xl mb-2 text-gray-900">مرحباً {currentTeam.name}!</p>
            <p className="text-gray-700 mb-4 text-lg">عدد الأسئلة: {questions.length}</p>
            <p className="text-gray-700 mb-8 text-lg">المدة: {formatTime(quizDuration)}</p>
            <button
              onClick={startQuiz}
              className="px-6 sm:px-8 py-3 sm:py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-lg sm:text-xl font-semibold flex items-center gap-3 mx-auto shadow-lg"
            >
              <lucide.Play size={24} />
              ابدأ المسابقة
            </button>
          </div>
        </div>
      );
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-white to-red-100 p-3 sm:p-4">
        <div className="max-w-3xl mx-auto pt-4 sm:pt-8">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-6">
              <div className="text-base sm:text-lg font-semibold text-gray-700">
                السؤال {currentQuestionIndex + 1} من {questions.length}
              </div>
              <div className={`flex items-center gap-2 text-xl sm:text-2xl font-bold ${timeRemaining < 30 ? 'text-red-600' : 'text-emerald-600'}`}>
                <lucide.Clock size={24} />
                {formatTime(timeRemaining)}
              </div>
            </div>

            <div className="mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-right leading-relaxed">{currentQuestion.question}</h2>
              <div className="space-y-3 sm:space-y-4">
                {currentQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(idx)}
                    className={`w-full p-3 sm:p-4 text-right rounded-xl border-2 transition text-base sm:text-lg ${
                      selectedAnswer === idx
                        ? 'bg-emerald-100 border-emerald-500 font-semibold text-gray-900'
                        : 'bg-white bg-white border-gray-300 hover:border-emerald-300 text-gray-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={selectedAnswer === null}
              className={`w-full py-3 sm:py-4 rounded-xl font-semibold text-white text-lg shadow-lg ${
                selectedAnswer === null
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {currentQuestionIndex < questions.length - 1 ? 'التالي' : 'إنهاء'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'results') {
    if (!finalScore) return null;
    
    const percentage = Math.round((finalScore.score / finalScore.total) * 100);

    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-br from-emerald-100 via-white to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 max-w-2xl w-full text-center">
          <div className="mb-6">
            <lucide.Award size={60} className="mx-auto text-yellow-500 mb-4 sm:hidden" />
            <lucide.Award size={80} className="mx-auto text-yellow-500 mb-4 hidden sm:block" />
            <h1 className="text-3xl sm:text-4xl font-bold text-emerald-700 mb-3">انتهت المسابقة!</h1>
            <p className="text-xl sm:text-2xl text-gray-900 mb-4">{currentTeam.name}</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-2xl p-6 sm:p-8 mb-6 border-2 border-emerald-200">
            <p className="text-5xl sm:text-6xl font-bold text-emerald-700 mb-3">{finalScore.score}/{finalScore.total}</p>
            <p className="text-2xl sm:text-3xl font-semibold text-gray-900">{percentage}%</p>
            <div className="mt-4 pt-4 border-t border-emerald-300">
              {percentage === 100 && (
                <p className="text-lg sm:text-xl text-emerald-700 font-semibold">🎉 ممتاز! إجابة كاملة!</p>
              )}
              {percentage >= 80 && percentage < 100 && (
                <p className="text-lg sm:text-xl text-emerald-600 font-semibold">👏 رائع جداً!</p>
              )}
              {percentage >= 60 && percentage < 80 && (
                <p className="text-lg sm:text-xl text-blue-600 font-semibold">👍 جيد!</p>
              )}
              {percentage < 60 && (
                <p className="text-lg sm:text-xl text-orange-600 font-semibold">💪 حاول مرة أخرى!</p>
              )}
            </div>
          </div>

          <p className="text-gray-700 text-lg mb-6">شكراً لمشاركتك في المسابقة!</p>
          
          <button
            onClick={() => {
              setView('login');
              setCurrentTeam(null);
              setQuizStarted(false);
              setCurrentQuestionIndex(0);
              setSelectedAnswer(null);
              setAnswers([]);
              setFinalScore(null);
              setAccessCode('');
              setTeamName('');
            }}
            className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 font-semibold"
          >
            العودة للصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }
}

export default App;