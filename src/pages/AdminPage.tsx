import { useState, useEffect } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { fetchAllCohorts, createCohort, updateCohort, fetchCohortUsers, type AdminCohort, type EnrolledUser } from '../services/adminService';
import { Users, Calendar, DollarSign, Plus, ChevronDown, ChevronUp, Download } from 'lucide-react';

export default function AdminPage() {
  const { isAdmin, authReady } = useAuth();
  const [cohorts, setCohorts] = useState<AdminCohort[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedCohort, setExpandedCohort] = useState<string | null>(null);
  const [cohortUsers, setCohortUsers] = useState<Record<string, EnrolledUser[]>>({});
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: '',
    enrollment_opens_at: '',
    enrollment_closes_at: '',
    cohort_starts_at: '',
    cohort_ends_at: '',
    price_cents: 7900,
    max_seats: '',
  });

  const loadCohorts = async () => {
    setLoading(true);
    const data = await fetchAllCohorts();
    setCohorts(data);
    setLoading(false);
  };

  useEffect(() => { loadCohorts(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const cohort = await createCohort({
      name: form.name,
      enrollment_opens_at: new Date(form.enrollment_opens_at).toISOString(),
      enrollment_closes_at: new Date(form.enrollment_closes_at).toISOString(),
      cohort_starts_at: new Date(form.cohort_starts_at).toISOString(),
      cohort_ends_at: new Date(form.cohort_ends_at).toISOString(),
      price_cents: form.price_cents,
      max_seats: form.max_seats ? parseInt(form.max_seats) : null,
    });
    if (cohort) {
      setCohorts(prev => [cohort, ...prev]);
      setShowCreateForm(false);
      setForm({ name: '', enrollment_opens_at: '', enrollment_closes_at: '', cohort_starts_at: '', cohort_ends_at: '', price_cents: 7900, max_seats: '' });
    }
  }

  async function handleToggleActive(cohort: AdminCohort) {
    const success = await updateCohort(cohort.id, { is_active: !cohort.is_active });
    if (success) loadCohorts();
  }

  async function handleExpandCohort(cohortId: string) {
    if (expandedCohort === cohortId) { setExpandedCohort(null); return; }
    setExpandedCohort(cohortId);
    if (!cohortUsers[cohortId]) {
      const users = await fetchCohortUsers(cohortId);
      setCohortUsers(prev => ({ ...prev, [cohortId]: users }));
    }
  }

  function exportCSV(cohortId: string) {
    const users = cohortUsers[cohortId];
    if (!users) return;
    const header = 'Email,Purchased At,Coach Usage,Validator Usage,Taste Usage\n';
    const rows = users.map(u =>
      `${u.email},${u.purchased_at},${u.coach_usage},${u.validator_usage},${u.taste_usage}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohort-${cohortId}-users.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authReady) return null;
  if (!isAdmin) return <Navigate to="/unauthorized" replace />;

  const now = new Date();

  return (
    <DashboardLayout>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#1F2937', margin: 0 }}>Admin Dashboard</h1>
          <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus size={16} /> New Cohort
          </Button>
        </div>

        {showCreateForm && (
          <Card>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', margin: '0 0 1rem' }}>Create New Cohort</h3>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Input label="Cohort Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Summer 2026 Cohort" required />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input label="Enrollment Opens" type="datetime-local" value={form.enrollment_opens_at} onChange={e => setForm({ ...form, enrollment_opens_at: e.target.value })} required />
                <Input label="Enrollment Closes" type="datetime-local" value={form.enrollment_closes_at} onChange={e => setForm({ ...form, enrollment_closes_at: e.target.value })} required />
                <Input label="Cohort Starts" type="datetime-local" value={form.cohort_starts_at} onChange={e => setForm({ ...form, cohort_starts_at: e.target.value })} required />
                <Input label="Cohort Ends" type="datetime-local" value={form.cohort_ends_at} onChange={e => setForm({ ...form, cohort_ends_at: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <Input label="Price (cents)" type="number" value={String(form.price_cents)} onChange={e => setForm({ ...form, price_cents: parseInt(e.target.value) || 0 })} required />
                <Input label="Max Seats (optional)" type="number" value={form.max_seats} onChange={e => setForm({ ...form, max_seats: e.target.value })} placeholder="Leave empty for unlimited" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Button variant="outline" type="button" onClick={() => setShowCreateForm(false)} style={{ flex: 1 }}>Cancel</Button>
                <Button type="submit" style={{ flex: 1 }}>Create Cohort</Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <p style={{ color: '#6B7280', textAlign: 'center' }}>Loading cohorts...</p>
        ) : cohorts.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#6B7280' }}>No cohorts yet. Create your first one!</p>
          </Card>
        ) : (
          cohorts.map(cohort => {
            const isOpen = now >= new Date(cohort.enrollment_opens_at) && now <= new Date(cohort.enrollment_closes_at) && cohort.is_active;
            const isActive = now >= new Date(cohort.cohort_starts_at) && now <= new Date(cohort.cohort_ends_at);
            const isPast = now > new Date(cohort.cohort_ends_at);
            const isExpanded = expandedCohort === cohort.id;
            const users = cohortUsers[cohort.id] ?? [];

            return (
              <Card key={cohort.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>{cohort.name}</h3>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 600, padding: '0.125rem 0.5rem', borderRadius: '999px',
                        backgroundColor: isOpen ? '#ECFDF5' : isPast ? '#F3F4F6' : isActive ? '#EFF6FF' : '#FEF3C7',
                        color: isOpen ? '#065F46' : isPast ? '#6B7280' : isActive ? '#1E40AF' : '#92400E',
                      }}>
                        {isOpen ? 'Enrolling' : isPast ? 'Ended' : isActive ? 'Active' : 'Upcoming'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: '0.25rem 0 0' }}>
                      ${(cohort.price_cents / 100).toFixed(0)} &middot; {new Date(cohort.cohort_starts_at).toLocaleDateString()} — {new Date(cohort.cohort_ends_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button size="sm" variant={cohort.is_active ? 'outline' : 'primary'} onClick={() => handleToggleActive(cohort)}>
                      {cohort.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleExpandCohort(cohort.id)}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: isExpanded ? '1rem' : 0 }}>
                  <div style={{ backgroundColor: '#F9FAFB', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                    <Calendar size={16} color="#6B7280" style={{ margin: '0 auto 0.25rem' }} />
                    <p style={{ fontSize: '0.6875rem', color: '#9CA3AF', margin: 0 }}>Enrollment</p>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', margin: '0.125rem 0 0' }}>
                      {new Date(cohort.enrollment_opens_at).toLocaleDateString()} — {new Date(cohort.enrollment_closes_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ backgroundColor: '#F9FAFB', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                    <Users size={16} color="#6B7280" style={{ margin: '0 auto 0.25rem' }} />
                    <p style={{ fontSize: '0.6875rem', color: '#9CA3AF', margin: 0 }}>Seats</p>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', margin: '0.125rem 0 0' }}>
                      {cohort.max_seats ? `${cohort.max_seats} max` : 'Unlimited'}
                    </p>
                  </div>
                  <div style={{ backgroundColor: '#F9FAFB', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                    <DollarSign size={16} color="#6B7280" style={{ margin: '0 auto 0.25rem' }} />
                    <p style={{ fontSize: '0.6875rem', color: '#9CA3AF', margin: 0 }}>Price</p>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', margin: '0.125rem 0 0' }}>
                      ${(cohort.price_cents / 100).toFixed(0)}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                        Enrolled Users ({users.length})
                      </h4>
                      {users.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => exportCSV(cohort.id)}>
                          <Download size={14} /> CSV
                        </Button>
                      )}
                    </div>
                    {users.length === 0 ? (
                      <p style={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>No enrolled users yet.</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Email</th>
                              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Purchased</th>
                              <th style={{ textAlign: 'center', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Coach</th>
                              <th style={{ textAlign: 'center', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Validator</th>
                              <th style={{ textAlign: 'center', padding: '0.5rem', color: '#6B7280', fontWeight: 600 }}>Taste</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(u => (
                              <tr key={u.user_id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '0.5rem', color: '#1F2937' }}>{u.email}</td>
                                <td style={{ padding: '0.5rem', color: '#6B7280' }}>{new Date(u.purchased_at).toLocaleDateString()}</td>
                                <td style={{ padding: '0.5rem', color: '#6B7280', textAlign: 'center' }}>{u.coach_usage}</td>
                                <td style={{ padding: '0.5rem', color: '#6B7280', textAlign: 'center' }}>{u.validator_usage}</td>
                                <td style={{ padding: '0.5rem', color: '#6B7280', textAlign: 'center' }}>{u.taste_usage}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}
