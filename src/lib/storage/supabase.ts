import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarItem, FieldIssue, PendingDraft, ProposedCalendarItem, RepositoryError, ValidationResult } from '../../domain/items';
import { validateCanonicalItem, validateProposedItem } from '../../domain/validation';
import { getSupabaseBrowserClient } from '../supabase/client';
import type { SupabasePublicConfig } from '../supabase/config';
import type { Database, Json } from '../supabase/database.types';
import type { MutationReceipt, RemoteCommitResult, RemoteStore } from './contracts';

type ValueRecord = Record<string, unknown>;
const DIGEST = /^[a-f0-9]{64}$/;
const isRecord = (value: unknown): value is ValueRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const validDocumentId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && !value.includes('/');

function failure(code: RepositoryError['code'], message: string, retryable = false, fieldIssues?: FieldIssue[]): RepositoryError {
  return { code, message, retryable, ...(fieldIssues ? { fieldIssues } : {}) };
}

function mapError(error: unknown): RepositoryError {
  if (isRecord(error) && ['persistence', 'auth', 'validation', 'permission', 'quota', 'integrity'].includes(String(error.code)) && typeof error.retryable === 'boolean') {
    return error as RepositoryError;
  }
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : '';
  const message = isRecord(error) && typeof error.message === 'string' ? error.message : '';
  if (message.startsWith('[integrity]')) return failure('integrity', message.slice('[integrity]'.length).trim());
  if (code === '42501' || isRecord(error) && error.status === 403) {
    return failure('permission', '이 계정에는 요청한 자료를 저장하거나 읽을 권한이 없습니다.');
  }
  if (['28000', 'PGRST301'].includes(code) || isRecord(error) && error.status === 401) {
    return failure('auth', '로그인이 필요합니다.');
  }
  if (code === '22023') return failure('validation', '원격 저장 요청이 올바르지 않습니다.');
  if (code === 'PGRST202') return failure('persistence', 'Supabase 데이터베이스 마이그레이션을 적용해 주세요.');
  const retryable = ['08000', '08003', '08006', '53300', '57014', 'PGRST000', 'PGRST001', 'PGRST003'].includes(code)
    || isRecord(error) && typeof error.status === 'number' && error.status >= 500;
  return failure('persistence', 'Supabase 서버 확인을 완료하지 못했습니다. 같은 작업으로 다시 확인해야 합니다.', retryable);
}

function checkedItem(value: unknown, itemId: string): CalendarItem {
  const validation: ValidationResult<CalendarItem> = validateCanonicalItem(value);
  if (!validation.valid) throw failure('integrity', '검증되지 않은 원격 일정은 표시하거나 덮어쓸 수 없습니다.', false, validation.issues);
  if (validation.value.id !== itemId) throw failure('integrity', '원격 일정 ID와 저장 경로가 일치하지 않습니다.');
  return validation.value;
}

function checkedDraft(uid: string, draft: PendingDraft): ProposedCalendarItem {
  if (uid !== draft.uid || !validDocumentId(uid)) throw failure('auth', '현재 계정과 초안 소유자가 일치해야 합니다.');
  if (!validDocumentId(draft.itemId) || !validDocumentId(draft.operationId)
      || (draft.baseRevision !== null && (!Number.isSafeInteger(draft.baseRevision) || draft.baseRevision < 1))
      || !DIGEST.test(draft.payloadDigest) || !['upsert', 'delete'].includes(draft.mutationKind)
      || (draft.mutationKind === 'delete' && draft.baseRevision === null)) {
    throw failure('validation', '고정된 작업 ID, digest와 기준 revision이 필요합니다.');
  }
  const validation = validateProposedItem(draft.proposedSnapshot);
  if (!validation.valid) throw failure('validation', '입력한 일정을 확인해 주세요.', false, validation.issues);
  if (validation.value.id !== draft.itemId) throw failure('validation', '초안 ID와 일정 ID가 일치해야 합니다.');
  return validation.value;
}

function decodeReceipt(value: unknown): MutationReceipt {
  if (!isRecord(value) || !validDocumentId(value.itemId) || typeof value.payloadDigest !== 'string'
      || !DIGEST.test(value.payloadDigest) || !Number.isSafeInteger(value.resultRevision)
      || Number(value.resultRevision) < 1 || typeof value.createdAt !== 'string'
      || !Number.isFinite(Date.parse(value.createdAt))) {
    throw failure('integrity', '원격 작업 영수증의 형식이 올바르지 않습니다.');
  }
  return {
    itemId: value.itemId,
    payloadDigest: value.payloadDigest,
    resultRevision: Number(value.resultRevision),
    createdAt: value.createdAt,
  };
}

function verifyReceipt(receipt: MutationReceipt, draft: PendingDraft, remote: CalendarItem): void {
  if (receipt.itemId !== draft.itemId || receipt.payloadDigest !== draft.payloadDigest
      || remote.revision < receipt.resultRevision
      || (remote.revision === receipt.resultRevision && (
        remote.lastMutationId !== draft.operationId
        || remote.lastMutationDigest !== receipt.payloadDigest
        || remote.updatedAt !== receipt.createdAt
      ))) {
    throw failure('integrity', '작업 ID가 다른 내용에 재사용되었거나 영수증과 원격 일정이 일치하지 않습니다.');
  }
}

function remoteRows(value: unknown): CalendarItem[] {
  if (!Array.isArray(value)) throw failure('integrity', 'Supabase 일정 목록 형식이 올바르지 않습니다.');
  return value.map((row) => {
    if (!isRecord(row)) throw failure('integrity', 'Supabase 일정 행 형식이 올바르지 않습니다.');
    return checkedItem(row.item_data, String(row.item_id ?? ''));
  });
}

/** Supabase Auth/Postgres SDK access stays behind the repository adapter. */
export function createSupabaseRemoteStore(client: SupabaseClient<Database>): RemoteStore {
  async function fetchSnapshot(uid: string, onValue: Parameters<RemoteStore['subscribe']>[1], onError: Parameters<RemoteStore['subscribe']>[2]): Promise<void> {
    const rows: { item_id: string; item_data: Json }[] = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client.from('calendar_items')
        .select('item_id,item_data')
        .eq('user_id', uid)
        .range(from, from + pageSize - 1);
      if (error) {
        onError(mapError(error));
        return;
      }
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    try {
      onValue({ items: remoteRows(rows), fromCache: false, hasPendingWrites: false, receivedAt: new Date().toISOString() });
    } catch (failureValue) {
      onError(mapError(failureValue));
    }
  }

  return {
    subscribe(uid, onValue, onError) {
      if (!validDocumentId(uid)) {
        onError(failure('auth', '조회할 계정이 필요합니다.'));
        return () => {};
      }
      let active = true;
      let requestGeneration = 0;
      const load = async () => {
        const generation = ++requestGeneration;
        await fetchSnapshot(uid, (snapshot) => {
          if (active && generation === requestGeneration) onValue(snapshot);
        }, (error) => {
          if (active && generation === requestGeneration) onError(error);
        });
      };
      const channel = client.channel(`calendar-items:${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_items', filter: `user_id=eq.${uid}` }, () => { void load(); })
        .subscribe((status, error) => {
          if (!active) return;
          if (status === 'SUBSCRIBED') void load();
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError(mapError(error ?? new Error('Supabase Realtime 연결에 실패했습니다.')));
        });
      return () => {
        active = false;
        requestGeneration += 1;
        void client.removeChannel(channel);
      };
    },
    async commit(uid, draft): Promise<RemoteCommitResult> {
      try {
        const proposal = checkedDraft(uid, draft);
        const { data, error } = await client.rpc('apply_calendar_item_mutation', {
          p_item_id: draft.itemId,
          p_operation_id: draft.operationId,
          p_payload_digest: draft.payloadDigest,
          p_base_revision: draft.baseRevision,
          p_mutation_kind: draft.mutationKind,
          p_proposed_snapshot: JSON.parse(JSON.stringify(proposal)) as Json,
        });
        if (error) throw error;
        if (!isRecord(data) || typeof data.status !== 'string') throw failure('integrity', '저장 결과가 올바른 형식이 아닙니다.');
        if (data.status === 'conflict') return { status: 'conflict', remote: checkedItem(data.remote, draft.itemId) };
        if (data.status !== 'applied' && data.status !== 'already-applied') throw failure('integrity', '알 수 없는 Supabase 저장 결과입니다.');
        const receipt = decodeReceipt(data.receipt);
        const remote = checkedItem(data.remote, draft.itemId);
        verifyReceipt(receipt, draft, remote);
        return { status: data.status, receipt, remote };
      } catch (error) {
        throw mapError(error);
      }
    },
    async clearReadCache() {
      // Supabase Realtime/PostgREST does not keep an item database cache in this browser.
    },
  };
}

export function createSupabaseStore(config: SupabasePublicConfig): RemoteStore {
  return createSupabaseRemoteStore(getSupabaseBrowserClient(config));
}
