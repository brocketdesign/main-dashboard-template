const express = require('express');
const router = express.Router();

const stripe = require('stripe')(process.env.STRIPE_SECRET);

const ensureAuthenticated = require('../middleware/authMiddleware');

const BasicPlan = {
  id: process.env.STRIPE_BASIC_PLAN,
  price: process.env.STRIPE_BASIC_PLAN_PRICE,
  type: process.env.STRIPE_BASIC_PLAN_TYPE
}
const PremiumPlan = {
  id: process.env.STRIPE_PREMIUM_PLAN,
  price: process.env.STRIPE_PREMIUM_PLAN_PRICE,
  type: process.env.STRIPE_PREMIUM_PLAN_TYPE
}

const { ObjectId } = require('mongodb');

router.get('/subscription',ensureAuthenticated, async (req, res) => {
  try {
    if(req.user.subscriptionId && req.user.subscriptionId.length > 1){
      res.redirect('/payment/subscription/bought-products')
      return
    }
    // Retrieve both product objects from Stripe using the product IDs
    const basicProduct = await stripe.products.retrieve(BasicPlan.id);
    const premiumProduct = await stripe.products.retrieve(PremiumPlan.id);

    // Retrieve the default price IDs of both products
    const basicDefaultPriceId = basicProduct.default_price;
    const premiumDefaultPriceId = premiumProduct.default_price;

    const basicPrice = await stripe.prices.retrieve(basicDefaultPriceId)
    const premiumPrice = await stripe.prices.retrieve(premiumDefaultPriceId)

    // Pass the relevant product information to the payment view
    res.render('subscription-payment', {
      publishableKey: process.env.STRIPE_PUBLIC,
      basicProductName: basicProduct.name,
      basicProductDescription: basicProduct.description,
      basicProductPrice: basicPrice.unit_amount,
      basicProductImage: basicProduct.images[0],
      basicProductId: basicProduct.id,
      basicPriceId: basicDefaultPriceId,
      premiumProductName: premiumProduct.name,
      premiumProductDescription: premiumProduct.description,
      premiumProductPrice: premiumPrice.unit_amount,
      premiumProductImage: premiumProduct.images[0],
      premiumProductId: premiumProduct.id,
      premiumPriceId: premiumDefaultPriceId,
      user:req.user,
      title: "Choose a membership"
    });
  } catch (error) {
    console.log(error);
    res.render('error',{user:req.user});
  }
});

router.get('/subscription/bought-products',ensureAuthenticated, async (req, res) => {
  
  try {
      if(!req.user.subscriptionId){
        res.render('subscription-bought-products', {user:req.user, subscriptions:[], title:"My memberships" });
        return
      }
      const sub = await stripe.subscriptions.retrieve(req.user.subscriptionId);

      console.log(sub)

      const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      }
      
      const subscribedProducts = [{
        id: sub.id,
        startDate: new Date(sub.created * 1000).toLocaleDateString('ja-JP',options),
        nextPaymentDate: new Date(sub.current_period_end * 1000).toLocaleDateString('ja-JP',options),
        isActive: sub.status === 'active' // This can also be 'inactive', 'past_due', 'canceled', 'unpaid' etc. depending on your use case
      }]

      // Render the bought products page with the list of product details
      res.render('subscription-bought-products', {user:req.user, subscriptions:subscribedProducts, title:"My memberships" });
  } catch (error) {
      // Handle error
      console.log(error)
      res.render('error', { error });
  }
});

router.get('/subscription-payment-success', async (req, res) => {
  const { session_id } = req.query;

  if (!session_id) {
    res.redirect('/'); // Or wherever you want to redirect if there is no session ID
    return;
  }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    console.log(subscription)

    const userId = session.metadata.userId;  // Retrieve userId from session metadata
    const subscriptionId = session.subscription;  // Retrieve subscriptionId from session

    console.log(userId,subscriptionId)

    // Store the subscription ID with the user document in your MongoDB collection
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { subscription, subscriptionId, stripeCustomerID: subscription.customer  } 
      }
    );
  

  res.render('subscription-payment-success', { user:req.user, subscription }); 
});

router.get('/subscription-payment-error', (req, res) => {
  res.render('subscription-payment-error',{user:req.user}); // Render the login template
});

router.post('/subscription/cancel/:subscriptionId', async (req, res) => {
  const subscriptionId = req.params.subscriptionId;
  
  try {
    // Cancel the subscription
    const canceledSubscription = await stripe.subscriptions.del(subscriptionId);

    if (canceledSubscription.status === 'canceled') {
      // Remove the subscription ID from the user document in your MongoDB collection
      await db.collection('users').updateOne(
        { _id: new ObjectId(req.user._id) },
        { 
          $unset: { subscriptionId: "" }
        }
      );
      req.flash('info', 'Your subscription has been successfully canceled.');
    } else {
      // The subscription wasn't canceled for some reason
      req.flash('error', 'There was a problem canceling your subscription. Please try again.');
    }
  } catch (error) {
    console.error(`Failed to cancel subscription ${subscriptionId}:`, error);
    req.flash('error', 'There was a problem canceling your subscription. Please try again.');
  }

  res.redirect('/payment/subscription/bought-products');
});

router.post('/create-checkout-session', async (req, res) => {
  const { product_id } = req.body;

  const product = await stripe.products.retrieve(product_id);
  const defaultPriceId = product.default_price;

  // Get the protocol (http or https) and the host from the request
  const protocol = req.protocol;
  const host = req.get('host');

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: defaultPriceId,
      quantity: 1,
    }],
    mode: 'subscription', 
    success_url: `${protocol}://${host}/payment/subscription-payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${protocol}://${host}/payment/subscription-payment-error`,
    metadata: { userId: req.user._id.toString() },  // Store userId in session metadata
  });

  res.json({ id: session.id });
});


module.exports = router;
