import Stripe from 'stripe';
import { query } from './db.js';

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return new Stripe(key, { apiVersion: '2024-06-20' as any });
}

export async function ensureCustomer(userId: string, email?: string) {
  const existing = await query<{ provider_customer_id: string }>('select provider_customer_id from billing_customers where user_id=$1', [userId]);
  if (existing.rows[0]?.provider_customer_id) return existing.rows[0].provider_customer_id;
  const stripe = stripeClient();
  const customer = await stripe.customers.create({ email, metadata: { userId } });
  await query('insert into billing_customers(user_id, provider, provider_customer_id) values($1,$2,$3) on conflict(user_id) do update set provider_customer_id=excluded.provider_customer_id, updated_at=now()', [userId, 'stripe', customer.id]);
  return customer.id;
}

export async function createCheckoutSession(userId: string, email: string, plan: 'pro' | 'coach') {
  const stripe = stripeClient();
  const customer = await ensureCustomer(userId, email);
  const price = plan === 'coach' ? process.env.STRIPE_PRICE_COACH : process.env.STRIPE_PRICE_PRO;
  if (!price) throw new Error(`Stripe price for ${plan} is not configured.`);
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: process.env.BILLING_SUCCESS_URL || `${process.env.PUBLIC_APP_URL}/#settings`,
    cancel_url: process.env.BILLING_CANCEL_URL || `${process.env.PUBLIC_APP_URL}/#settings`,
    metadata: { userId, plan },
  });
}

export async function createPortalSession(userId: string) {
  const row = await query<{ provider_customer_id: string }>('select provider_customer_id from billing_customers where user_id=$1', [userId]);
  if (!row.rows[0]?.provider_customer_id) throw new Error('Billing customer not found.');
  return stripeClient().billingPortal.sessions.create({ customer: row.rows[0].provider_customer_id, return_url: process.env.PUBLIC_APP_URL || 'http://localhost:4173/#settings' });
}

export async function handleStripeWebhook(rawBody: Buffer | string, signature?: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = stripeClient();
  const event = secret && signature ? stripe.webhooks.constructEvent(rawBody, signature, secret) : JSON.parse(String(rawBody));
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub: any = event.data.object;
    const customerId = sub.customer;
    const customer = await query<{ user_id: string }>('select user_id from billing_customers where provider_customer_id=$1', [customerId]);
    const userId = customer.rows[0]?.user_id;
    if (userId) {
      await query(`insert into billing_subscriptions(user_id, provider, provider_subscription_id, price_id, plan, status, current_period_end, cancel_at_period_end, metadata)
        values($1,'stripe',$2,$3,$4,$5,to_timestamp($6),$7,$8)
        on conflict(provider_subscription_id) do update set price_id=excluded.price_id, plan=excluded.plan, status=excluded.status, current_period_end=excluded.current_period_end, cancel_at_period_end=excluded.cancel_at_period_end, metadata=excluded.metadata, updated_at=now()`,
        [userId, sub.id, sub.items?.data?.[0]?.price?.id || '', sub.metadata?.plan || 'pro', sub.status, sub.current_period_end || null, !!sub.cancel_at_period_end, sub]);
      await query('update billing_customers set plan=$2, status=$3, updated_at=now() where user_id=$1', [userId, sub.metadata?.plan || 'pro', sub.status]);
    }
  }
  return { received: true };
}
