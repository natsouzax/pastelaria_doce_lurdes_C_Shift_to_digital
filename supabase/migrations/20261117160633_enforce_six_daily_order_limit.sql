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
  v_other_order_count integer;
  v_over_capacity boolean;
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

  -- Match the order-creation and manager-confirmation lock for this pickup date.
  perform pg_advisory_xact_lock(hashtextextended(v_order.pickup_date::text, 0));

  -- New pending orders reserve slots at creation. At confirmation, count only
  -- already-confirmed work so legacy pending orders can fill remaining slots.
  select count(*)::integer into v_other_order_count
  from public.orders
  where pickup_date = v_order.pickup_date
    and status in ('confirmed','in_production','ready','delivered')
    and id <> p_order_id;

  select coalesce(sum(i.custom_count), 0)::integer into v_reserved_count
  from (
    select o.id, count(*) filter (where oi.is_custom_cake) as custom_count
    from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.pickup_date = v_order.pickup_date and o.status in ('confirmed','in_production','ready','delivered')
    group by o.id
  ) i
  join public.orders reserved on reserved.id = i.id
  where reserved.status in ('confirmed','in_production','ready','delivered');

  v_over_capacity := v_other_order_count >= 6 or v_reserved_count + v_custom_count > 6;
  if v_over_capacity and not p_external_payment_received then
    raise exception using errcode = 'P0001', message = 'CAPACITY_FULL';
  end if;

  insert into public.simulated_payments(order_id, kind, amount_cents, recorded_by, note, external_payment_received, idempotency_key)
  values (p_order_id, 'deposit', p_amount_cents, p_recorded_by, p_note, p_external_payment_received, p_idempotency_key)
  returning id into v_payment_id;

  if not v_over_capacity then
    update public.orders set status = 'confirmed', confirmed_at = now(), capacity_resolution_required = false, updated_at = now() where id = p_order_id;
    return jsonb_build_object('result', 'confirmed', 'payment_id', v_payment_id, 'status', 'confirmed');
  end if;

  update public.orders set capacity_resolution_required = true, updated_at = now() where id = p_order_id;
  return jsonb_build_object('result', 'capacity_lost_after_payment', 'payment_id', v_payment_id, 'status', 'pending');
end;
$$;

revoke all on function public.confirm_order_after_deposit(uuid, uuid, uuid, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.confirm_order_after_deposit(uuid, uuid, uuid, integer, boolean, text) to service_role;
