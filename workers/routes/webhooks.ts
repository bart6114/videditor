import { Env } from '../env';
import Stripe from 'stripe';
import { corsResponse, corsError } from '../utils/cors';

/**
 * Handle webhook requests (Stripe, Stream, etc.)
 */
export async function handleWebhookRequest(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response> {
  if (pathname === '/api/webhooks/stripe') {
    return handleStripeWebhook(request, env);
  }

  if (pathname === '/api/webhooks/stream') {
    return handleStreamWebhook(request, env);
  }

  return corsError('Not found', { status: 404, env });
}

/**
 * Handle Stripe webhooks
 */
async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return corsError('Missing signature', { status: 400, env });
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
    });

    const body = await request.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );

    console.log('Stripe webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(env, session);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(env, subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed:', invoice.id);
        // Handle failed payment (e.g., downgrade user)
        break;
      }
    }

    return corsResponse({ received: true }, { status: 200, env });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return corsError(
      error instanceof Error ? error.message : 'Webhook failed',
      { status: 400, env }
    );
  }
}

async function handleCheckoutCompleted(
  env: Env,
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.client_reference_id;
  if (!userId) return;

  const subscription = session.subscription as string;
  const customerId = session.customer as string;

  // Create or update subscription in D1
  const subId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO subscriptions (id, user_id, stripe_customer_id, stripe_subscription_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       stripe_customer_id = excluded.stripe_customer_id,
       stripe_subscription_id = excluded.stripe_subscription_id,
       status = excluded.status,
       updated_at = datetime('now')`
  )
    .bind(subId, userId, customerId, subscription)
    .run();

  console.log('Subscription created for user:', userId);
}

async function handleSubscriptionUpdated(
  env: Env,
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const user = await env.DB.prepare(
    'SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?'
  )
    .bind(customerId)
    .first<{ user_id: string }>();

  if (!user) {
    console.error('User not found for customer:', customerId);
    return;
  }

  // Update subscription
  await env.DB.prepare(
    `UPDATE subscriptions
     SET status = ?,
         current_period_start = ?,
         current_period_end = ?,
         cancel_at_period_end = ?,
         updated_at = datetime('now')
     WHERE user_id = ?`
  )
    .bind(
      subscription.status,
      new Date(subscription.current_period_start * 1000).toISOString(),
      new Date(subscription.current_period_end * 1000).toISOString(),
      subscription.cancel_at_period_end ? 1 : 0,
      user.user_id
    )
    .run();

  console.log('Subscription updated for user:', user.user_id);
}

/**
 * Handle Cloudflare Stream webhooks
 */
async function handleStreamWebhook(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      uid: string;
      status: { state: string };
      meta?: Record<string, string>;
    };

    const { uid, status, meta } = body;
    const projectId = meta?.projectId;

    if (!projectId) {
      console.error('No project ID in Stream webhook');
      return corsResponse({ received: true }, { status: 200, env });
    }

    // Update project with Stream ID and status
    if (status.state === 'ready') {
      await env.DB.prepare(
        `UPDATE projects
         SET stream_id = ?,
             status = 'completed',
             updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(uid, projectId)
        .run();

      console.log('Stream video ready:', uid, 'for project:', projectId);
    } else if (status.state === 'error') {
      await env.DB.prepare(
        `UPDATE projects
         SET status = 'error',
             error_message = 'Stream processing failed',
             updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(projectId)
        .run();

      console.error('Stream processing failed for project:', projectId);
    }

    return corsResponse({ received: true }, { status: 200, env });
  } catch (error) {
    console.error('Stream webhook error:', error);
    return corsError('Webhook processing failed', { status: 400, env });
  }
}
