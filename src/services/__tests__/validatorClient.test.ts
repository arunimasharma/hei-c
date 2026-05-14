import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the supabase client module before importing the SUT ─────────────────
//
// listSessions() ultimately calls supabase.from('validator_sessions')
//   .select(...).is('deleted_at', null).order('created_at', { ascending: false }).
// We capture the chain so the test can assert the query shape and inject rows.
//
// vi.mock() is hoisted to the top of the file, so the factory can't refer to
// outer locals. vi.hoisted() lets us share the spy refs across the boundary.

const { fromSpy, selectSpy, isSpy, orderSpy } = vi.hoisted(() => ({
  fromSpy:   vi.fn(),
  selectSpy: vi.fn(),
  isSpy:     vi.fn(),
  orderSpy:  vi.fn(),
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: fromSpy },
  isSupabaseConfigured: true,
}));

// Now import the SUT. The mock above is hoisted by vitest.
import { listSessions } from '../validatorClient';

beforeEach(() => {
  fromSpy.mockReset();
  selectSpy.mockReset();
  isSpy.mockReset();
  orderSpy.mockReset();

  fromSpy.mockReturnValue({ select: selectSpy });
  selectSpy.mockReturnValue({ is: isSpy });
  isSpy.mockReturnValue({ order: orderSpy });
});

describe('listSessions', () => {
  it('queries validator_sessions, filters soft-deleted rows, orders newest first', async () => {
    orderSpy.mockResolvedValue({ data: [], error: null });

    await listSessions();

    expect(fromSpy).toHaveBeenCalledWith('validator_sessions');
    expect(selectSpy).toHaveBeenCalledTimes(1);
    const selectCols = (selectSpy.mock.calls[0]?.[0] ?? '') as string;
    // Every column the UI reads must be selected.
    for (const col of [
      'id', 'user_id', 'mode', 'title',
      'generated_doc', 'doc_generated_at',
      'created_at', 'updated_at',
    ]) {
      expect(selectCols).toContain(col);
    }
    expect(isSpy).toHaveBeenCalledWith('deleted_at', null);
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('maps snake_case rows into camelCase ValidatorSession objects', async () => {
    orderSpy.mockResolvedValue({
      data: [
        {
          id: 'sess_1',
          user_id: 'user_1',
          mode: 'strategic_bet',
          title: 'Auto-quarantine flakes',
          generated_doc: '# Brief',
          doc_generated_at: '2026-05-03T12:00:00Z',
          created_at: '2026-05-03T11:00:00Z',
          updated_at: '2026-05-03T12:00:00Z',
        },
        {
          id: 'sess_2',
          user_id: 'user_1',
          mode: 'quick_prototype',
          title: null,
          generated_doc: null,
          doc_generated_at: null,
          created_at: '2026-05-02T09:00:00Z',
          updated_at: '2026-05-02T09:30:00Z',
        },
      ],
      error: null,
    });

    const sessions = await listSessions();

    expect(sessions).toEqual([
      {
        id: 'sess_1',
        userId: 'user_1',
        mode: 'strategic_bet',
        title: 'Auto-quarantine flakes',
        generatedDoc: '# Brief',
        docGeneratedAt: '2026-05-03T12:00:00Z',
        createdAt: '2026-05-03T11:00:00Z',
        updatedAt: '2026-05-03T12:00:00Z',
      },
      {
        id: 'sess_2',
        userId: 'user_1',
        mode: 'quick_prototype',
        title: null,
        generatedDoc: null,
        docGeneratedAt: null,
        createdAt: '2026-05-02T09:00:00Z',
        updatedAt: '2026-05-02T09:30:00Z',
      },
    ]);
  });

  it('returns an empty array when supabase returns no rows', async () => {
    orderSpy.mockResolvedValue({ data: null, error: null });
    const sessions = await listSessions();
    expect(sessions).toEqual([]);
  });

  it('throws a ValidatorError when supabase returns an error', async () => {
    orderSpy.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(listSessions()).rejects.toThrow('permission denied');
  });
});
