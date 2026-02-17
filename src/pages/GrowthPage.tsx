import { useState, useMemo } from 'react';
import { Plus, Zap, Target } from 'lucide-react';
import { motion } from 'motion/react';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import GoalCard from '../components/goals/GoalCard';
import GoalForm from '../components/goals/GoalForm';
import { useApp } from '../context/AppContext';
import type { Goal } from '../types';

export default function GrowthPage() {
  const { state, addGoal, updateGoal, deleteGoal, completeAction, skipAction } = useApp();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<(Goal & { type: 'career' | 'emotional-intelligence' }) | undefined>();
  const [activeTab, setActiveTab] = useState<'goals' | 'actions'>('goals');

  const { user, goals, actions } = state;

  // Goals data
  const goalsWithType = useMemo(() => {
    return goals.map((goal) => {
      const type: 'career' | 'emotional-intelligence' = 'focusArea' in goal ? 'emotional-intelligence' : 'career';
      return { ...goal, type };
    });
  }, [goals]);

  const activeGoals = goalsWithType.filter((g) => g.status === 'active');
  const completedGoals = goalsWithType.filter((g) => g.status === 'completed');

  // Actions data
  const activeActions = actions.filter((a) => !a.completed && !a.skipped);
  const completedActions = actions.filter((a) => a.completed);

  // Stats
  const stats = {
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    avgProgress:
      goalsWithType.length > 0
        ? Math.round(goalsWithType.reduce((sum, g) => sum + g.progress, 0) / goalsWithType.length)
        : 0,
    pendingActions: activeActions.length,
    completedActions: completedActions.length,
  };

  const handleEdit = (goal: Goal & { type: 'career' | 'emotional-intelligence' }) => {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>
              Your Growth
            </h1>
            <p style={{ color: '#6B7280', marginTop: '0.25rem', margin: 0 }}>
              Set goals and track actionable steps
            </p>
          </div>

          {activeTab === 'goals' && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus size={16} /> New Goal
            </Button>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          <Card>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
              Active Goals
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10B981', margin: '0.5rem 0 0 0' }}>
              {stats.activeGoals}
            </p>
          </Card>
          <Card>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
              Completed
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#4A5FC1', margin: '0.5rem 0 0 0' }}>
              {stats.completedGoals}
            </p>
          </Card>
          <Card>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
              Avg Progress
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F59E0B', margin: '0.5rem 0 0 0' }}>
              {stats.avgProgress}%
            </p>
          </Card>
          <Card>
            <p style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
              Pending Actions
            </p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#EF4444', margin: '0.5rem 0 0 0' }}>
              {stats.pendingActions}
            </p>
          </Card>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#F3F4F6', padding: '0.5rem', borderRadius: '10px', width: 'fit-content' }}>
          <Button
            size="sm"
            variant={activeTab === 'goals' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('goals')}
            style={{ cursor: 'pointer' }}
          >
            <Target size={16} /> Goals
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'actions' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('actions')}
            style={{ cursor: 'pointer' }}
          >
            <Zap size={16} /> Actions
          </Button>
        </div>

        {/* Goals Content */}
        {activeTab === 'goals' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {/* Active Goals */}
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', marginBottom: '1rem', margin: 0 }}>
                Active Goals ({stats.activeGoals})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeGoals.length > 0 ? (
                  activeGoals.map((goal, idx) => (
                    <motion.div
                      key={goal.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
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
                  ))
                ) : (
                  <Card>
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                      <p style={{ color: '#6B7280', margin: 0 }}>
                        No active goals. Create one to get started!
                      </p>
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#6B7280', marginBottom: '1rem', margin: 0 }}>
                  Completed Goals ({stats.completedGoals})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: 0.7 }}>
                  {completedGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onEdit={handleEdit}
                      onDelete={deleteGoal}
                      onUpdateProgress={(id, progress) => updateGoal(id, { progress })}
                      onUpdateStatus={(id, status) => updateGoal(id, { status })}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Actions Content */}
        {activeTab === 'actions' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            {/* Pending Actions */}
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', marginBottom: '1rem', margin: 0 }}>
                Recommended Actions ({stats.pendingActions})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {activeActions.length > 0 ? (
                  activeActions.map((action, idx) => (
                    <motion.div
                      key={action.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                              {action.title}
                            </h3>
                            <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                              {action.description}
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: '#9CA3AF' }}>
                              <span>{action.category}</span>
                              <span>⏱ {action.estimatedMinutes} min</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => completeAction(action.id)}
                            >
                              Do It
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => skipAction(action.id)}
                            >
                              Skip
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))
                ) : (
                  <Card>
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                      <p style={{ color: '#6B7280', margin: 0 }}>
                        Great job! No outstanding actions. Check back later for more recommendations.
                      </p>
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Completed Actions */}
            {completedActions.length > 0 && (
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#6B7280', marginBottom: '1rem', margin: 0 }}>
                  Completed ({stats.completedActions})
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: 0.6 }}>
                  {completedActions.slice(0, 3).map((action) => (
                    <Card key={action.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1rem' }}>✅</span>
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                            {action.title}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '0.15rem 0 0 0' }}>
                            Completed {action.completedAt ? new Date(action.completedAt).toLocaleDateString() : 'recently'}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Goal Form Modal */}
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
