create type public.product_unit as enum ('kg', 'unidade', 'cento', 'duzia', 'meia_duzia');
create type public.order_status as enum ('pending', 'confirmed', 'in_production', 'ready', 'delivered', 'cancelled');
create type public.order_source as enum ('online', 'counter', 'phone');
create type public.production_status as enum ('to_do', 'in_progress', 'ready');
create type public.payment_kind as enum ('deposit', 'balance', 'refund');
create type public.staff_role as enum ('manager', 'production');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  category text not null,
  unit public.product_unit not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  allergens text[] not null default '{}',
  min_lead_hours integer not null check (min_lead_hours >= 0),
  is_custom_cake boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_custom_cake or (unit = 'kg' and unit_price_cents > 0 and min_lead_hours >= 120))
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tracking_code_hash text not null unique,
  customer_name text not null,
  customer_phone text not null,
  pickup_at timestamptz not null,
  pickup_date date not null,
  status public.order_status not null default 'pending',
  notes text,
  source public.order_source not null default 'online',
  total_cents integer not null check (total_cents >= 0),
  deposit_required_cents integer not null default 0 check (deposit_required_cents >= 0),
  capacity_resolution_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  check (total_cents >= deposit_required_cents),
  check (pickup_date = (pickup_at at time zone 'Europe/Lisbon')::date),
  check (extract(isodow from (pickup_at at time zone 'Europe/Lisbon')) <> 1)
);
create index orders_pickup_day_status_idx on public.orders (pickup_date, status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  unit_snapshot public.product_unit not null,
  unit_price_cents_snapshot integer not null check (unit_price_cents_snapshot >= 0),
  quantity numeric(10,3) not null check (quantity > 0),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  is_custom_cake boolean not null,
  weight_kg numeric(7,3),
  cake_message text,
  declared_allergies text[] not null default '{}',
  production_notes text,
  production_status public.production_status not null default 'to_do',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_custom_cake and quantity = 1 and weight_kg is not null and weight_kg > 0 and unit_snapshot = 'kg') or
    (not is_custom_cake and weight_kg is null and cake_message is null and cardinality(declared_allergies) = 0)
  )
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_custom_idx on public.order_items (order_id) where is_custom_cake;

create table public.simulated_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  kind public.payment_kind not null,
  amount_cents integer not null check (amount_cents > 0),
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  note text,
  external_payment_received boolean not null default false,
  idempotency_key uuid not null,
  unique(recorded_by, idempotency_key)
);
create index payments_order_idx on public.simulated_payments (order_id, recorded_at);

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.staff_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.track_rate_events (
  request_hash text not null,
  requested_at timestamptz not null default now()
);
create index track_rate_events_lookup_idx on public.track_rate_events (request_hash, requested_at desc);

-- All access goes through the Next.js server. The Data API receives no table grants.
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.simulated_payments enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.track_rate_events enable row level security;
revoke all on public.products, public.orders, public.order_items, public.simulated_payments, public.staff_profiles, public.track_rate_events from anon, authenticated;

create or replace function public.confirm_order_after_deposit(
  p_order_id uuid,
  p_recorded_by uuid,
  p_idempotency_key uuid,
  p_amount_cents integer,
  p_external_payment_received boolean,
  p_note text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_custom_count integer;
  v_reserved_count integer;
  v_payment_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if v_order.status <> 'pending' then raise exception using errcode = 'P0001', message = 'INVALID_STATE'; end if;
  if v_order.capacity_resolution_required then raise exception using errcode = 'P0001', message = 'INVALID_STATE'; end if;
  if exists (select 1 from public.simulated_payments where recorded_by = p_recorded_by and idempotency_key = p_idempotency_key) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_PAYMENT';
  end if;
  if p_amount_cents <> v_order.deposit_required_cents or p_amount_cents <= 0 then
    raise exception using errcode = 'P0001', message = 'PAYMENT_MISMATCH';
  end if;
  select count(*) into v_custom_count from public.order_items where order_id = p_order_id and is_custom_cake;
  if v_custom_count = 0 then raise exception using errcode = 'P0001', message = 'PAYMENT_MISMATCH'; end if;

  -- Transaction advisory lock serializes confirmations for the Lisbon calendar date.
  perform pg_advisory_xact_lock(hashtextextended(v_order.pickup_date::text, 0));
  select coalesce(sum(i.custom_count), 0)::integer into v_reserved_count
  from (
    select o.id, count(*) filter (where oi.is_custom_cake) as custom_count
    from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.pickup_date = v_order.pickup_date and o.status <> 'cancelled'
    group by o.id
  ) i
  join public.orders reserved on reserved.id = i.id
  where reserved.status <> 'pending';

  if v_reserved_count + v_custom_count > 6 and not p_external_payment_received then
    raise exception using errcode = 'P0001', message = 'CAPACITY_FULL';
  end if;

  insert into public.simulated_payments(order_id, kind, amount_cents, recorded_by, note, external_payment_received, idempotency_key)
  values (p_order_id, 'deposit', p_amount_cents, p_recorded_by, p_note, p_external_payment_received, p_idempotency_key)
  returning id into v_payment_id;

  if v_reserved_count + v_custom_count <= 6 then
    update public.orders set status = 'confirmed', confirmed_at = now(), capacity_resolution_required = false, updated_at = now() where id = p_order_id;
    return jsonb_build_object('result', 'confirmed', 'payment_id', v_payment_id, 'status', 'confirmed');
  end if;

  update public.orders set capacity_resolution_required = true, updated_at = now() where id = p_order_id;
  return jsonb_build_object('result', 'capacity_lost_after_payment', 'payment_id', v_payment_id, 'status', 'pending');
end;
$$;
revoke all on function public.confirm_order_after_deposit(uuid, uuid, uuid, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.confirm_order_after_deposit(uuid, uuid, uuid, integer, boolean, text) to service_role;
