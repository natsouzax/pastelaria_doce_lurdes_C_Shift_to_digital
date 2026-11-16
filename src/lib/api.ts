export type Product = { id:string; name:string; category:string; unit:'kg'|'unidade'|'cento'|'duzia'|'meia_duzia'; unit_price_cents:number; allergens:string[]; min_lead_hours:number; is_custom_cake:boolean };
export type OrderStatus = 'pending'|'confirmed'|'in_production'|'ready'|'delivered'|'cancelled';
export type ItemStatus = 'to_do'|'in_progress'|'ready';
export type OrderItem = { id:string; product_name:string; quantity:number; unit:Product['unit']; weight_kg:number|null; cake_message:string|null; product_allergens:string[]; declared_allergies:string[]; production_notes:string|null; production_status:ItemStatus };
export type StaffOrder = { id:string; status:OrderStatus; pickup_at:string; items:OrderItem[]; customer_name?:string; customer_phone?:string; total_cents?:number; deposit_required_cents?:number; amount_paid_cents?:number; balance_due_cents?:number; capacity_resolution_required?:boolean };
export type TrackedOrder = { status:OrderStatus; pickup_at:string; total_cents:number; amount_paid_cents:number; balance_due_cents:number; items:Pick<OrderItem,'product_name'|'quantity'|'unit'|'weight_kg'|'cake_message'|'production_status'>[] };
export type NewOrder = { customer:{name:string;phone:string}; pickup_at:string; notes:string|null; items:Array<{product_id:string;quantity:number;weight_kg?:number;cake_message?:string|null;declared_allergies?:string[];production_notes?:string|null}> };
export type CreatedOrder = { order_id:string; tracking_code:string; status:OrderStatus; pickup_at:string; total_cents:number; deposit_required_cents:number; amount_paid_cents:number; balance_due_cents:number; capacity_reserved:boolean; message:string };
export type StaffRole = 'manager'|'production';
export type StaffMe = { role:StaffRole };

export class ApiFailure extends Error {
  constructor(public status:number, public code:string, message:string, public fields?:Record<string,string>, public paymentRecorded=false) { super(message); }
}

async function request<T>(path:string, init?:RequestInit):Promise<T> {
  const response = await fetch(path, { ...init, cache:'no-store', credentials:'same-origin', headers:{ ...(init?.body ? {'Content-Type':'application/json'} : {}), ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = body?.error ?? {}; throw new ApiFailure(response.status,error.code ?? 'HTTP_ERROR',error.message ?? 'Não foi possível concluir. Tente novamente.',error.fields,error.payment_recorded === true); }
  return body as T;
}

async function allPages<T>(path:string):Promise<T[]> {
  const data:T[]=[]; let cursor:string|null=null;
  do { const sep=path.includes('?')?'&':'?'; const page:{data:T[];next_cursor:string|null}=await request(`${path}${cursor?`${sep}cursor=${encodeURIComponent(cursor)}`:''}`); data.push(...page.data); cursor=page.next_cursor; } while(cursor);
  return data;
}

export const api = {
  products:()=>allPages<Product>('/api/products'),
  createOrder:(data:NewOrder)=>request<CreatedOrder>('/api/orders',{method:'POST',body:JSON.stringify(data)}),
  track:(code:string)=>request<TrackedOrder>(`/api/orders/track/${encodeURIComponent(code.trim())}`),
  me:()=>request<StaffMe>('/api/staff/me'),
  staffOrders:(date:string)=>allPages<StaffOrder>(`/api/staff/orders?pickup_date=${encodeURIComponent(date)}`),
  payment:(id:string,kind:'deposit'|'balance'|'refund',amount_cents:number,external_payment_received:boolean,key:string)=>request<{order:StaffOrder}>(`/api/staff/orders/${id}/payments`,{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify({kind,amount_cents,external_payment_received,note:null})}),
  itemStatus:(id:string,status:'in_progress'|'ready')=>request<{item:{id:string;production_status:ItemStatus};order:{id:string;status:OrderStatus}}>(`/api/staff/order-items/${id}/status`,{method:'PATCH',body:JSON.stringify({status})}),
  orderStatus:(id:string,status:'confirmed'|'delivered'|'cancelled',reason?:string)=>request<{id:string;status:OrderStatus}>(`/api/staff/orders/${id}/status`,{method:'PATCH',body:JSON.stringify(status==='cancelled'?{status,reason}:{status})}),
};
