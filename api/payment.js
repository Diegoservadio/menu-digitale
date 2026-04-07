export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { plan, email } = req.body;

    // Crea cliente Stripe
    const customer = await stripe.customers.create({ email });

    // Cerca o crea il prodotto/prezzo
    const amount = plan === 'yearly' ? 14900 : 1900;
    const interval = plan === 'yearly' ? 'year' : 'month';

    const price = await stripe.prices.create({
      unit_amount: amount,
      currency: 'eur',
      recurring: { interval },
      product_data: { name: `Tavola ${plan === 'yearly' ? 'Annuale' : 'Mensile'}` },
    });

    // Subscription con 14 giorni di trial — nessuna carta richiesta subito
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      trial_period_days: 14,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;

    res.status(200).json({
      clientSecret: clientSecret || null,
      subscriptionId: subscription.id,
      trialEnd: subscription.trial_end,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
