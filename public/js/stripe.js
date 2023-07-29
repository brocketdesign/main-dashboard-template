var stripe = Stripe('pk_test_51Grb83C8xKGwQm6J0yFqNpWwgFu8MF582uq74ktVViobsBzM2hjVT2fXFvW5JQwLQnoaAmXBWtGevNodYi0bT5uv00sjuMNw1n'); // Replace with your public key

document.getElementById('basic-checkout-button').addEventListener('click', function () {
  createCheckoutSession('prod_JaEhEGeJwWMJsx');
});

document.getElementById('premium-checkout-button').addEventListener('click', function () {
  createCheckoutSession('prod_JaEgtLGBWmmqQa');
});

function createCheckoutSession(productId) {
  fetch('/payment/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product_id: productId
    })
  })
  .then(function (response) {
    return response.json();
  })
  .then(function (session) {
    return stripe.redirectToCheckout({ sessionId: session.id });
  })
  .catch(function (error) {
    console.error('Error:', error);
  });
}
