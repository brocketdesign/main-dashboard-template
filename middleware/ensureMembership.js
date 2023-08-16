const stripe = require('stripe')(process.env.STRIPE_SECRET);

const ensureMembership = async (req, res, next) => {
    try {
      if(!req.user.subscriptionId ){
        
        // If the user does not have an active subscription, redirect them to the subscription page
        next();
      }
      // Fetch the user's subscriptions from Stripe
      const subscriptions = await stripe.subscriptions.list({ customer: req.user.stripeCustomerID });
    
      // Check if the user has an active subscription
      const hasActiveSubscription = subscriptions.data.some(subscription => subscription.status === 'active');
    
      if (!hasActiveSubscription) {
        // If the user does not have an active subscription, redirect them to the subscription page

        req.flash('error', 'You need a membership to access this page!')

        return res.redirect('/payment/subscription/');
      }

      // If the user has an active subscription, proceed to the next middleware
      next();
    } catch (error) {
      console.log('Failed to fetch subscriptions:', error);
      res.redirect('/error');
    }
}
  
module.exports = ensureMembership