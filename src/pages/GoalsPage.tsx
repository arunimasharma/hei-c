import { useState, useMemo } from 'react';
import { Plus, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/common/Button';
import GoalCard from '../components/goals/GoalCard';
import GoalForm from '../components/goals/GoalForm';
import { useApp } from '../context/AppContext';
import type { Goal, GoalType } from '../types';

export default function GoalsPage() {
  const { state, addGoal, updateGoal, deleteGoal } = useApp();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<(Goal & { type: GoalType }) | undefined>();
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'active' | 'completed' | 'paused' | 'archived'
  >('active');
  const [filterType, setFilterType] = useState<'all' | 'career' | 'emotional-intelligence'>(
    'all'
  );

  const { user, goals } = state;

  const goalsWithType = useMemo(() => {
    return goals.map((goal) => {
      const type: GoalType = 'focusArea' in goal ? 'emotional-intelligence' : 'career';
      return { ...goal, type };
    });
  }, [goals]);

  const filteredGoals = useMemo(() => {
    return goalsWithType.filter((goal) => {
      const matchesStatus = filterStatus === 'all' || goal.status === filterStatus;
      const matchesType = filterType === 'all' || goal.type === filterType;
      return matchesStatus && matchesType;
    });
  }, [goalsWithType, filterStatus, filterType]);

  const stats = useMemo(() => {
    return {
      total: goals.length,
      active: goals.filter((g) => g.status === 'active').length,
      completed: goals.filter((g) => g.status === 'completed').length,
      avgProgress:
        goals.length > 0 ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length) : 0,
    };
  }, [goals]);

  const handleEdit = (goal: Goal & { type: GoalType }) => {
    setEditingGoal(goal);
    setIsFormOpen(true);
  };

  const handleSubmit = (newGoal: Goal) => {
    if (editingGoal) {
      updateGoal(editingGoal.id, newGoal);
      setEditingGoal(undefined);
    } else {
      addGoal(newGoal);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingGoal(undefined);
  };

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937' }}>
              Your Goals
            </h1>
            <p style={{ color: '#6B7280', marginTop: '0.25rem' }}>
              Track your career and emotional intelligence goals
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus size={16} /> Create Goal
          </Button>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#F0F9FF',
              padding: '1rem',
              borderRadius: '12px',
              borderLeft: '4px solid #0EA5E9',
            }}
          >
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Total Goals</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937' }}>
              {stats.total}
            </p>
          </div>
          <div
            style={{
              backgroundColor: '#F0FDF4',
              padding: '1rem',
              borderRadius: '12px',
              borderLeft: '4px solid #10B981',
            }}
          >
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Active</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937' }}>
              {stats.active}
            </p>
          </div>
          <div
            style={{
              backgroundColor: '#EFF6FF',
              padding: '1rem',
              borderRadius: '12px',
              borderLeft: '4px solid #3B82F6',
            }}
          >
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Completed</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937' }}>
              {stats.completed}
            </p>
          </div>
          <div
            style={{
              backgroundColor: '#FFFBEB',
              padding: '1rem',
              borderRadius: '12px',
              borderLeft: '4px solid #F59E0B',
            }}
          >
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Avg Progress</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937' }}>
              {stats.avgProgress}%
            </p>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            paddingBottom: '1rem',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          <Filter size={18} color="#6B7280" />
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(
                e.target.value as 'all' | 'active' | 'completed' | 'paused' | 'archived'
              )
            }
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={filterType}
            onChange={(e) =>
              setFilterType(
                e.target.value as 'all' | 'career' | 'emotional-intelligence'
              )
            }
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            <option value="all">All Types</option>
            <option value="career">Career Goals</option>
            <option value="emotional-intelligence">Emotional IQ (EQ)</option>
          </select>
        </div>

        {/* Goals List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredGoals.length > 0 ? (
            <AnimatePresence>
              {filteredGoals.map((goal, idx) => (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <GoalCard
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={deleteGoal}
                    onUpdateProgress={(id, progress) => updateGoal(id, { progress })}
                    onUpdateStatus={(id, status) => updateGoal(id, { status })}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
              <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>
                {goals.length === 0
                  ? 'No goals set yet. Create your first goal to get started!'
                  : 'No goals match your filters'}
              </p>
              {goals.length === 0 && (
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus size={16} /> Create Your First Goal
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <GoalForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        goal={editingGoal}
        userId={user?.id || ''}
      />
    </DashboardLayout>
  );
}
