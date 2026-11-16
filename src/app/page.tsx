'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiFailure, type CreatedOrder, type NewOrder, type Product, type StaffOrder, type StaffRole, type TrackedOrder } from '@/lib/api';
import { createAuthClient } from '@/lib/supabase/client';
import { dateLabel, lisbonPickupTimestamp, nextDemoPickupDate } from '@/lib/dates';

type View = 'shop' | 'track' | 'staff';
type Line = { key:string; product_id:string; quantity:string; weight_kg:string; cake_message:string; declared_allergies:string };
const euro = (cents:number) => new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(cents/100);
const stateLabel:Record<string,string> = { pending:'Pendente',confirmed:'Confirmada',in_production:'Em produção',ready:'Pronta',delivered:'Entregue',cancelled:'Cancelada',to_do:'A fazer',in_progress:'Em produção' };
const errorText = (error:unknown) => {
  if(error instanceof ApiFailure){
    const messages:Record<string,string> = {
      CAPACITY_FULL:'A data já atingiu a capacidade de seis bolos. Escolha outra data.',
      CAPACITY_LOST_AFTER_PAYMENT:'A vaga deixou de estar disponível depois do sinal. É necessário resolver o reembolso.',
      PICKUP_TOO_SOON:'A data escolhida não respeita a antecedência necessária.',
      MONDAY_PICKUP:'Não há levantamentos à segunda-feira.',
      UNAUTHENTICATED:'A sessão terminou. Entre novamente.',
      FORBIDDEN:'Esta conta não tem permissão para esta ação.',
      RATE_LIMITED:'Foram feitas demasiadas consultas. Tente mais tarde.',
    };
    return messages[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.';
};
const newLine = (product:Product):Line => ({ key:crypto.randomUUID(), product_id:product.id, quantity:'1',weight_kg:product.is_custom_cake?'2':'',cake_message:'',declared_allergies:'' });

export default function Home() {
  const [view,setView]=useState<View>('shop');
  const [products,setProducts]=useState<Product[]>([]);
  const [catalogError,setCatalogError]=useState('');
  const [lines,setLines]=useState<Line[]>([]);
  const [customerName,setCustomerName]=useState('');
  const [customerPhone,setCustomerPhone]=useState('');
  const [pickupDate,setPickupDate]=useState(nextDemoPickupDate);
  const [pickupTime,setPickupTime]=useState('10:00');
  const [created,setCreated]=useState<CreatedOrder|null>(null);
  const [trackingCode,setTrackingCode]=useState('');
  const [tracked,setTracked]=useState<TrackedOrder|null>(null);
  const [formError,setFormError]=useState('');
  const [trackError,setTrackError]=useState('');
  const [busy,setBusy]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [role,setRole]=useState<StaffRole|null>(null);
  const [authError,setAuthError]=useState('');
  const [staffDate,setStaffDate]=useState(nextDemoPickupDate);
  const [orders,setOrders]=useState<StaffOrder[]>([]);
  const [staffError,setStaffError]=useState('');
  const [staffBusy,setStaffBusy]=useState(false);
  const paymentKeys=useRef<Record<string,string>>({});

  const loadProducts=useCallback(async()=>{ try { setCatalogError('');setProducts(await api.products()); } catch(error){setCatalogError(errorText(error));} },[]);
  const loadOrders=useCallback(async(date:string)=>{ try { setStaffError('');setOrders(await api.staffOrders(date)); } catch(error){setStaffError(errorText(error));setOrders([]);} },[]);
  useEffect(()=>{void loadProducts();},[loadProducts]);
  useEffect(()=>{
    let active=true;
    try {
      const auth=createAuthClient();
      void auth.auth.getUser().then(async({data})=>{if(active&&data.user){try{setRole((await api.me()).role);}catch(error){setAuthError(errorText(error));}}});
      const {data:{subscription}}=auth.auth.onAuthStateChange((_event,session)=>{
        if(!active)return;
        setOrders([]);
        if(!session){setRole(null);}
        else {setRole(null);void api.me().then(me=>{if(active){setRole(me.role);setAuthError('');}}).catch(error=>{if(active){setRole(null);setAuthError(errorText(error));}});}
      });
      return ()=>{active=false;subscription.unsubscribe();};
    } catch(error){setAuthError(errorText(error));return ()=>{active=false;};}
  },[]);
  useEffect(()=>{if(role&&view==='staff')void loadOrders(staffDate);},[role,view,staffDate,loadOrders]);

  function updateLine(key:string,patch:Partial<Line>){setLines(current=>current.map(line=>line.key===key?{...line,...patch}:line));}
  function productOf(line:Line){return products.find(product=>product.id===line.product_id);}
  const estimate=lines.reduce((sum,line)=>{const product=productOf(line);if(!product)return sum;const n=Number(product.is_custom_cake?line.weight_kg:line.quantity);return sum+(Number.isFinite(n)?Math.round(n*product.unit_price_cents):0);},0);

  async function submitOrder(event:React.FormEvent){
    event.preventDefault();setFormError('');setCreated(null);
    if(!lines.length){setFormError('Adicione pelo menos um produto.');return;}
    const items:NewOrder['items']=[];
    for(const line of lines){const product=productOf(line);if(!product)continue;const quantity=Number(line.quantity);const weight=Number(line.weight_kg);
      if(product.is_custom_cake){if(!(weight>0)){setFormError('Indique o peso de cada bolo.');return;}items.push({product_id:product.id,quantity:1,weight_kg:weight,cake_message:line.cake_message||null,declared_allergies:line.declared_allergies.split(',').map(s=>s.trim()).filter(Boolean),production_notes:null});}
      else {if(!(quantity>0)){setFormError('Indique uma quantidade positiva.');return;}items.push({product_id:product.id,quantity});}
    }
    setBusy(true);
    try {const result=await api.createOrder({customer:{name:customerName.trim(),phone:customerPhone.trim()},pickup_at:lisbonPickupTimestamp(pickupDate,pickupTime),notes:null,items});setCreated(result);setTrackingCode(result.tracking_code);setLines([]);}
    catch(error){setFormError(errorText(error));}
    finally{setBusy(false);}
  }

  async function trackOrder(event:React.FormEvent){event.preventDefault();setTrackError('');setTracked(null);setBusy(true);try{setTracked(await api.track(trackingCode));}catch(error){setTrackError(errorText(error));}finally{setBusy(false);}}
  async function signIn(event:React.FormEvent){event.preventDefault();setAuthError('');setStaffBusy(true);try{const auth=createAuthClient();const {error}=await auth.auth.signInWithPassword({email,password});if(error)throw error;setPassword('');const me=await api.me();setRole(me.role);setView('staff');}catch(error){setAuthError(errorText(error));}finally{setStaffBusy(false);}}
  async function signOut(){try{await createAuthClient().auth.signOut();}finally{setRole(null);setOrders([]);setView('shop');}}
  async function staffAction(action:()=>Promise<unknown>){setStaffError('');setStaffBusy(true);try{await action();await loadOrders(staffDate);}catch(error){const detail=error instanceof ApiFailure&&error.paymentRecorded?' O sinal foi registado; não repita o pagamento.':'';await loadOrders(staffDate);setStaffError(errorText(error)+detail);}finally{setStaffBusy(false);}}
  async function pay(order:StaffOrder,kind:'deposit'|'balance'|'refund',amount:number){
    const action=kind==='refund'?'reembolso simulado':'pagamento externo recebido';
    if(!window.confirm(`Confirma o ${action} de ${euro(amount)}? Este registo altera o saldo da encomenda.`))return;
    const token=`${order.id}:${kind}`;const key=paymentKeys.current[token]??crypto.randomUUID();paymentKeys.current[token]=key;
    try{await api.payment(order.id,kind,amount,kind!=='refund',key);delete paymentKeys.current[token];}
    catch(error){if(error instanceof ApiFailure&&error.status<500)delete paymentKeys.current[token];throw error;}
  }
  const nav=(name:View,label:string)=><button type="button" className={view===name?'active':''} onClick={()=>setView(name)}>{label}</button>;

  return <div className="real-shell">
    <header className="real-header"><div className="real-brand">✿ <span>doce lurdes</span></div><nav aria-label="Navegação principal">{nav('shop','Encomendar')}{nav('track','Acompanhar')}{nav('staff',role?role==='manager'?'Gestão':'Produção':'Equipa')}</nav></header>
    <main className="real-main">
      {view==='shop'&&<><section className="real-hero"><p>PASTELARIA ARTESANAL</p><h1>Um doce momento começa aqui.</h1><span>Escolha os seus produtos e indique quando pretende levantar a encomenda.</span></section>
        <section className="real-card"><h2>Catálogo</h2>{catalogError&&<div className="real-error" role="alert">{catalogError} <button onClick={()=>void loadProducts()}>Tentar novamente</button></div>}{!catalogError&&!products.length&&<p>A carregar produtos…</p>}
          <div className="real-products">{products.map(product=><article key={product.id}><h3>{product.name}</h3><p>{product.category} · {euro(product.unit_price_cents)}/{product.unit.replace('_',' ')}</p><small>Alergénios: {product.allergens.join(', ')||'Não indicados'} · Antecedência: {product.min_lead_hours} h</small><button type="button" onClick={()=>setLines(current=>[...current,newLine(product)])}>Adicionar {product.is_custom_cake?'bolo':'produto'}</button></article>)}</div></section>
        <form className="real-card real-form" onSubmit={submitOrder}><h2>A sua encomenda</h2>{!lines.length&&<p>Adicione um produto do catálogo para começar.</p>}{lines.map((line,index)=>{const product=productOf(line);if(!product)return null;return <fieldset key={line.key}><legend>{index+1}. {product.name}</legend><button className="real-link" type="button" onClick={()=>setLines(current=>current.filter(item=>item.key!==line.key))}>Remover</button>{product.is_custom_cake?<><label>Peso deste bolo (kg)<input required type="number" min="0.001" step="0.001" value={line.weight_kg} onChange={event=>updateLine(line.key,{weight_kg:event.target.value})}/></label><label>Mensagem no bolo<input maxLength={80} value={line.cake_message} onChange={event=>updateLine(line.key,{cake_message:event.target.value})}/></label><label>Alergias declaradas (separadas por vírgula)<input value={line.declared_allergies} onChange={event=>updateLine(line.key,{declared_allergies:event.target.value})}/></label></>:<label>Quantidade ({product.unit.replace('_',' ')})<input required type="number" min="0.001" step="0.001" value={line.quantity} onChange={event=>updateLine(line.key,{quantity:event.target.value})}/></label>}</fieldset>;})}
          <div className="real-fields"><label>Dia de levantamento<input required type="date" value={pickupDate} onChange={event=>setPickupDate(event.target.value)}/></label><label>Hora<input required type="time" value={pickupTime} onChange={event=>setPickupTime(event.target.value)}/></label><label>Nome<input required maxLength={120} value={customerName} onChange={event=>setCustomerName(event.target.value)}/></label><label>Telefone<input required maxLength={40} value={customerPhone} onChange={event=>setCustomerPhone(event.target.value)}/></label></div>
          <p>Total estimado: <strong>{euro(estimate)}</strong>. O servidor confirma o preço e o sinal.</p><p className="real-note">O pedido fica Pendente. Aguarde a Gestora verificar a disponibilidade antes de pagar o sinal.</p>{formError&&<div className="real-error" role="alert">{formError}</div>}<button className="real-primary" disabled={busy||!lines.length}>{busy?'A enviar…':'Enviar pedido'}</button></form>
        {created&&<section className="real-card real-success" aria-live="polite"><h2>Pedido recebido</h2><p>Estado: {stateLabel[created.status]}. Total {euro(created.total_cents)}; sinal necessário {euro(created.deposit_required_cents)}.</p><p>Guarde o código agora; ele é apresentado uma única vez.</p><code>{created.tracking_code}</code><button onClick={()=>void navigator.clipboard.writeText(created.tracking_code)}>Copiar código</button><p>{created.message}</p></section>}
      </>}
      {view==='track'&&<section className="real-card"><h1>Acompanhar pedido</h1><form className="real-inline" onSubmit={trackOrder}><label>Código de seguimento<input value={trackingCode} onChange={event=>setTrackingCode(event.target.value)} required/></label><button className="real-primary" disabled={busy}>Consultar</button></form>{trackError&&<div className="real-error" role="alert">{trackError}</div>}{tracked&&<div className="real-track"><h2>{stateLabel[tracked.status]}</h2><p>Levantamento: {dateLabel(new Date(tracked.pickup_at))}</p><p>Total {euro(tracked.total_cents)} · Pago {euro(tracked.amount_paid_cents)} · Em falta {euro(tracked.balance_due_cents)}</p>{tracked.items.map((item,index)=><article key={index}><strong>{item.product_name}</strong> · {item.weight_kg??item.quantity} {item.weight_kg?'kg':item.unit}<br/>Estado: {stateLabel[item.production_status]}{item.cake_message&&<p>Mensagem: {item.cake_message}</p>}</article>)}</div>}</section>}
      {view==='staff'&&<>{!role?<section className="real-card real-login"><h1>Entrada da equipa</h1><p>Gestora e Produção entram com as suas contas de teste.</p><form onSubmit={signIn}><label>Email<input type="email" required value={email} onChange={event=>setEmail(event.target.value)} autoComplete="username"/></label><label>Palavra-passe<input type="password" required value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password"/></label>{authError&&<div className="real-error" role="alert">{authError}</div>}<button className="real-primary" disabled={staffBusy}>Entrar</button></form></section>:<><section className="real-hero"><p>{role==='manager'?'GESTÃO':'PRODUÇÃO'}</p><h1>{role==='manager'?'Encomendas do dia':'Plano de produção'}</h1><button className="real-link" onClick={()=>void signOut()}>Terminar sessão</button></section><section className="real-card"><div className="real-toolbar"><label>Data de levantamento<input type="date" value={staffDate} onChange={event=>setStaffDate(event.target.value)}/></label><button onClick={()=>void loadOrders(staffDate)}>Atualizar</button></div>{staffError&&<div className="real-error" role="alert">{staffError}</div>}{!orders.length&&!staffError&&<p>Não há encomendas para esta data.</p>}{orders.map(order=><article className="real-order" key={order.id}><div className="real-order-head"><div><strong>{role==='manager'?order.customer_name:`Pedido ${order.id.slice(0,8)}`}</strong><p>{dateLabel(new Date(order.pickup_at))} · {stateLabel[order.status]}</p></div>{role==='manager'&&<div><b>{euro(order.total_cents??0)}</b><p>Pago {euro(order.amount_paid_cents??0)} · Falta {euro(order.balance_due_cents??0)}</p></div>}</div>{role==='manager'&&<p>Contacto: {order.customer_phone}</p>}{order.capacity_resolution_required&&role==='manager'&&<div className="real-error">Sinal recebido sem vaga. Resolva o reembolso; não registe o sinal outra vez.</div>}
            {order.items.map(item=><div className="real-item" key={item.id}><div><strong>{item.product_name}</strong> · {item.weight_kg??item.quantity} {item.weight_kg?'kg':item.unit}<p>Estado: {stateLabel[item.production_status]}</p>{item.cake_message&&<p>Mensagem: {item.cake_message}</p>}{role==='production'&&<><p className="real-allergy">Alergias declaradas: {item.declared_allergies.join(', ')||'Nenhuma'}</p><p>Alergénios do produto: {item.product_allergens.join(', ')||'Não indicados'}</p>{item.production_notes&&<p>Notas: {item.production_notes}</p>}</>}</div>{role==='production'&&item.production_status!=='ready'&&<button disabled={staffBusy} onClick={()=>void staffAction(()=>api.itemStatus(item.id,item.production_status==='to_do'?'in_progress':'ready'))}>{item.production_status==='to_do'?'Iniciar':'Marcar pronto'}</button>}</div>)}
            {role==='manager'&&<div className="real-actions">{order.status==='pending'&&!order.capacity_resolution_required&&(order.items.some(item=>item.weight_kg!==null)?<button disabled={staffBusy} onClick={()=>void staffAction(()=>pay(order,'deposit',order.deposit_required_cents??0))}>Registar sinal {euro(order.deposit_required_cents??0)}</button>:<button disabled={staffBusy} onClick={()=>void staffAction(()=>api.orderStatus(order.id,'confirmed'))}>Confirmar</button>)}{order.status==='ready'&&(order.balance_due_cents??0)>0&&<button disabled={staffBusy} onClick={()=>void staffAction(()=>pay(order,'balance',order.balance_due_cents??0))}>Registar restante {euro(order.balance_due_cents??0)}</button>}{order.status==='ready'&&(order.balance_due_cents??0)===0&&<button disabled={staffBusy} onClick={()=>void staffAction(()=>api.orderStatus(order.id,'delivered'))}>Marcar entregue</button>}{order.capacity_resolution_required&&(order.amount_paid_cents??0)>0&&<button disabled={staffBusy} onClick={()=>void staffAction(()=>pay(order,'refund',order.amount_paid_cents??0))}>Registar reembolso</button>}{!['delivered','cancelled'].includes(order.status)&&!order.capacity_resolution_required&&<button disabled={staffBusy} onClick={()=>{const reason=window.prompt('Motivo do cancelamento');if(reason?.trim())void staffAction(()=>api.orderStatus(order.id,'cancelled',reason.trim()));}}>Cancelar</button>}</div>}</article>)}</section></>}</>}
    </main><footer className="real-footer">Pastelaria Doce Lurdes · pagamentos simulados · levantamento em Europe/Lisbon</footer>
  </div>;
}
