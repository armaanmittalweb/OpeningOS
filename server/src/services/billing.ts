export type BillingPlan = 'free' | 'player' | 'coach' | 'team';

export async function createCheckoutSession(userId: string, plan: BillingPlan) {
  // Stripe-compatible adapter. Wire STRIPE_SECRET_KEY and replace this function
  // with Stripe SDK calls in production; response shape is intentionally stable.
  return { provider: 'stripe-adapter', mode: 'subscription', userId, plan, url: `/billing/mock-checkout?plan=${plan}` };
}

export async function createBillingPortal(userId: string) {
  return { provider: 'stripe-adapter', userId, url: '/billing/mock-portal' };
}
