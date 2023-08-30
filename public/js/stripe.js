var stripe = Stripe('pk_test_51Grb83C8xKGwQm6J0yFqNpWwgFu8MF582uq74ktVViobsBzM2hjVT2fXFvW5JQwLQnoaAmXBWtGevNodYi0bT5uv00sjuMNw1n'); // Replace with your public key

function createCheckoutSession(e) {
  const productId = $(e).data('id')
  const priceId = $(e).data('price')
  fetch('/payment/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product_id: productId,
      price_id: priceId
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
