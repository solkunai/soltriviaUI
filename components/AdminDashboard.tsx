import React, { useState, useEffect } from 'react';
import { supabase } from '../src/utils/supabase';

interface Question {
  id?: string;
  category: string;
  text: string;
  options: string[];
  correct_index: number;
  difficulty: number;
  active: boolean;
}

const AdminDashboard: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState<Question>({
    category: 'solana',
    text: '',
    options: ['', '', '', ''],
    correct_index: 0,
    difficulty: 1,
    active: true,
  });

  const categories = ['solana', 'defi', 'nfts', 'bitcoin', 'memecoins', 'history'];

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      // Check if Supabase is configured
      const { data, error: fetchError } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) {
        if (fetchError.message?.includes('JWT') || fetchError.message?.includes('auth')) {
          throw new Error('Supabase not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local');
        }
        throw fetchError;
      }
      setQuestions(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch questions. Make sure Supabase is configured in .env.local');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate form
      if (!formData.text.trim()) {
        throw new Error('Question text is required');
      }
      if (formData.options.some(opt => !opt.trim())) {
        throw new Error('All options must be filled');
      }
      if (formData.correct_index < 0 || formData.correct_index > 3) {
        throw new Error('Correct answer index must be 0-3');
      }

      if (editingQuestion?.id) {
        // Update existing question
        const { error: updateError } = await supabase
          .from('questions')
          .update({
            category: formData.category,
            text: formData.text,
            options: formData.options,
            correct_index: formData.correct_index,
            difficulty: formData.difficulty,
            active: formData.active,
          })
          .eq('id', editingQuestion.id);

        if (updateError) throw updateError;
        setSuccess('Question updated successfully!');
      } else {
        // Create new question
        const { error: insertError } = await supabase
          .from('questions')
          .insert({
            category: formData.category,
            text: formData.text,
            options: formData.options,
            correct_index: formData.correct_index,
            difficulty: formData.difficulty,
            active: formData.active,
          });

        if (insertError) throw insertError;
        setSuccess('Question created successfully!');
      }

      // Reset form
      setFormData({
        category: 'solana',
        text: '',
        options: ['', '', '', ''],
        correct_index: 0,
        difficulty: 1,
        active: true,
      });
      setEditingQuestion(null);
      setShowForm(false);
      fetchQuestions();
    } catch (err: any) {
      setError(err.message || 'Failed to save question');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      category: question.category,
      text: question.text,
      options: [...question.options],
      correct_index: question.correct_index,
      difficulty: question.difficulty,
      active: question.active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    setLoading(true);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('questions')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setSuccess('Question deleted successfully!');
      fetchQuestions();
    } catch (err: any) {
      setError(err.message || 'Failed to delete question');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (question: Question) => {
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('questions')
        .update({ active: !question.active })
        .eq('id', question.id);

      if (updateError) throw updateError;
      fetchQuestions();
    } catch (err: any) {
      setError(err.message || 'Failed to update question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-[1000] italic uppercase tracking-tighter text-white mb-2">
            ADMIN <span className="text-[#14F195]">DASHBOARD</span>
          </h1>
          <div className="h-0.5 w-32 bg-[#14F195] opacity-30"></div>
          <p className="text-zinc-400 text-sm mt-4 font-black uppercase tracking-wider">
            Question Management System
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm font-black uppercase">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm font-black uppercase">{success}</p>
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="mb-8 bg-[#0D0D0D] border border-white/10 rounded-2xl p-6">
            <h2 className="text-2xl font-[1000] italic uppercase text-white mb-6">
              {editingQuestion ? 'EDIT QUESTION' : 'ADD NEW QUESTION'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-300 text-xs font-black uppercase mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 text-xs font-black uppercase mb-2">
                    Difficulty (1-3)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-black uppercase mb-2">
                  Question Text
                </label>
                <textarea
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white min-h-[100px]"
                  placeholder="Enter the question..."
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-300 text-xs font-black uppercase mb-2">
                  Options
                </label>
                {formData.options.map((option, idx) => (
                  <div key={idx} className="mb-2 flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={formData.correct_index === idx}
                      onChange={() => setFormData({ ...formData, correct_index: idx })}
                      className="w-4 h-4"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...formData.options];
                        newOptions[idx] = e.target.value;
                        setFormData({ ...formData, options: newOptions });
                      }}
                      className="flex-1 px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-zinc-300 text-xs font-black uppercase">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Active
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-[#14F195] hover:bg-[#14F195]/90 text-black font-[1000] italic uppercase rounded-lg disabled:opacity-50"
                >
                  {loading ? 'SAVING...' : editingQuestion ? 'UPDATE' : 'CREATE'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingQuestion(null);
                    setFormData({
                      category: 'solana',
                      text: '',
                      options: ['', '', '', ''],
                      correct_index: 0,
                      difficulty: 1,
                      active: true,
                    });
                  }}
                  className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-[1000] italic uppercase rounded-lg"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Actions */}
        {!showForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-[#14F195] hover:bg-[#14F195]/90 text-black font-[1000] italic uppercase rounded-lg"
            >
              + ADD NEW QUESTION
            </button>
          </div>
        )}

        {/* Questions List */}
        <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl p-6">
          <h2 className="text-2xl font-[1000] italic uppercase text-white mb-6">
            QUESTIONS ({questions.length})
          </h2>

          {loading && !questions.length ? (
            <p className="text-zinc-400 text-center py-8">Loading questions...</p>
          ) : questions.length === 0 ? (
            <p className="text-zinc-400 text-center py-8">No questions found</p>
          ) : (
            <div className="space-y-4">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="p-4 bg-black/40 border border-white/5 rounded-lg hover:border-white/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 text-xs font-black uppercase rounded ${
                          question.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {question.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                        <span className="px-2 py-1 text-xs font-black uppercase bg-zinc-800 text-zinc-300 rounded">
                          {question.category}
                        </span>
                        <span className="px-2 py-1 text-xs font-black uppercase bg-zinc-800 text-zinc-300 rounded">
                          DIFF: {question.difficulty}
                        </span>
                      </div>
                      <p className="text-white font-bold mb-3">{question.text}</p>
                      <div className="space-y-1">
                        {question.options.map((opt, idx) => (
                          <div
                            key={idx}
                            className={`text-sm ${
                              idx === question.correct_index
                                ? 'text-[#14F195] font-bold'
                                : 'text-zinc-400'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}. {opt}
                            {idx === question.correct_index && ' ✓'}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleEdit(question)}
                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-black uppercase rounded"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => toggleActive(question)}
                        className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs font-black uppercase rounded"
                      >
                        {question.active ? 'DEACTIVATE' : 'ACTIVATE'}
                      </button>
                      <button
                        onClick={() => question.id && handleDelete(question.id)}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-black uppercase rounded"
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
