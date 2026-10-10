create table if not exists public.calendar_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  item_data jsonb not null,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  last_mutation_id text not null,
  last_mutation_digest text not null check (last_mutation_digest ~ '^[a-f0-9]{64}$'),
  primary key (user_id, item_id),
  check (jsonb_typeof(item_data) = 'object' and item_data ->> 'id' = item_id)
);

create index if not exists calendar_items_owner_updated_idx
  on public.calendar_items (user_id, updated_at desc);

create table if not exists public.mutation_receipts (
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id text not null,
  item_id text not null,
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  result_revision integer not null check (result_revision > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

alter table public.calendar_items enable row level security;
alter table public.mutation_receipts enable row level security;

revoke all on table public.calendar_items from anon, authenticated;
grant select on table public.calendar_items to authenticated;
revoke all on table public.mutation_receipts from anon, authenticated;

drop policy if exists calendar_items_select_own on public.calendar_items;
create policy calendar_items_select_own
  on public.calendar_items for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.apply_calendar_item_mutation(
  p_item_id text,
  p_operation_id text,
  p_payload_digest text,
  p_base_revision integer,
  p_mutation_kind text,
  p_proposed_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_receipt public.mutation_receipts%rowtype;
  v_item public.calendar_items%rowtype;
  v_next_revision integer;
  v_now timestamptz := clock_timestamp();
  v_item_data jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = '로그인이 필요합니다.';
  end if;
  if p_item_id is null or length(trim(p_item_id)) = 0 or position('/' in p_item_id) > 0
      or p_operation_id is null or length(trim(p_operation_id)) = 0
      or p_payload_digest is null or p_payload_digest !~ '^[a-f0-9]{64}$'
      or p_mutation_kind is null or p_mutation_kind not in ('upsert', 'delete')
      or (p_base_revision is not null and p_base_revision < 1)
      or (p_mutation_kind = 'delete' and p_base_revision is null)
      or jsonb_typeof(p_proposed_snapshot) is distinct from 'object'
      or p_proposed_snapshot ->> 'id' is distinct from p_item_id then
    raise exception using errcode = '22023', message = '원격 저장 요청이 올바르지 않습니다.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':operation:' || p_operation_id, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':item:' || p_item_id, 0));
  v_now := clock_timestamp();

  select * into v_receipt
    from public.mutation_receipts
    where user_id = v_user_id and operation_id = p_operation_id;
  if found then
    if v_receipt.item_id <> p_item_id or v_receipt.payload_digest <> p_payload_digest then
      raise exception using errcode = 'P0001', message = '[integrity] 작업 ID가 다른 내용에 재사용되었습니다.';
    end if;
    select * into v_item
      from public.calendar_items
      where user_id = v_user_id and item_id = p_item_id;
    if not found or v_item.revision < v_receipt.result_revision
        or (v_item.revision = v_receipt.result_revision and (
          v_item.last_mutation_id <> p_operation_id
          or v_item.last_mutation_digest <> v_receipt.payload_digest
          or v_item.item_data ->> 'updatedAt' <> (to_jsonb(v_receipt.created_at) #>> '{}')
        )) then
      raise exception using errcode = 'P0001', message = '[integrity] 저장 영수증과 원격 일정이 일치하지 않습니다.';
    end if;
    return jsonb_build_object(
      'status', 'already-applied',
      'receipt', jsonb_build_object('itemId', v_receipt.item_id, 'payloadDigest', v_receipt.payload_digest,
        'resultRevision', v_receipt.result_revision, 'createdAt', v_receipt.created_at),
      'remote', v_item.item_data
    );
  end if;

  select * into v_item
    from public.calendar_items
    where user_id = v_user_id and item_id = p_item_id
    for update;
  if not found then
    if p_base_revision is not null then
      raise exception using errcode = 'P0001', message = '[integrity] 기준 revision이 있는 원격 일정이 사라졌습니다.';
    end if;
    v_next_revision := 1;
  else
    if v_item.deleted_at is not null or v_item.revision is distinct from p_base_revision then
      return jsonb_build_object('status', 'conflict', 'remote', v_item.item_data);
    end if;
    v_next_revision := v_item.revision + 1;
  end if;

  v_item_data := (case when p_mutation_kind = 'delete' and v_item.item_id is not null
    then v_item.item_data else p_proposed_snapshot end)
    || jsonb_build_object(
      'revision', v_next_revision,
      'updatedAt', to_jsonb(v_now),
      'deletedAt', case when p_mutation_kind = 'delete' then to_jsonb(v_now) else 'null'::jsonb end,
      'lastMutationId', p_operation_id,
      'lastMutationDigest', p_payload_digest
    );

  insert into public.calendar_items (user_id, item_id, item_data, revision, updated_at, deleted_at, last_mutation_id, last_mutation_digest)
  values (v_user_id, p_item_id, v_item_data, v_next_revision, v_now,
    case when p_mutation_kind = 'delete' then v_now else null end, p_operation_id, p_payload_digest)
  on conflict (user_id, item_id) do update set
    item_data = excluded.item_data,
    revision = excluded.revision,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    last_mutation_id = excluded.last_mutation_id,
    last_mutation_digest = excluded.last_mutation_digest;

  insert into public.mutation_receipts (user_id, operation_id, item_id, payload_digest, result_revision, created_at)
  values (v_user_id, p_operation_id, p_item_id, p_payload_digest, v_next_revision, v_now);

  return jsonb_build_object(
    'status', 'applied',
    'receipt', jsonb_build_object('itemId', p_item_id, 'payloadDigest', p_payload_digest,
      'resultRevision', v_next_revision, 'createdAt', v_now),
    'remote', v_item_data
  );
end;
$$;

revoke all on function public.apply_calendar_item_mutation(text, text, text, integer, text, jsonb) from public, anon;
grant execute on function public.apply_calendar_item_mutation(text, text, text, integer, text, jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_items'
      ) then
    execute 'alter publication supabase_realtime add table public.calendar_items';
  end if;
end;
$$;
