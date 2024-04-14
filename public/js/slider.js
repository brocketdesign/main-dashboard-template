function generateNavigation(){
  const preveNav = $('#slickCarousel .slick-prev')
  const nextNav = $('#slickCarousel .slick-next')
  preveNav.html('<i class="fas fa-angle-left"></i>')
  preveNav.addClass('badge bg-dark border-0 rounded-0 p-3')
  nextNav.html('<i class="fas fa-angle-right"></i>')
  nextNav.addClass('badge bg-dark border-0 rounded-0 p-3')
}

$(document).ready(function() {

    $('#activeSlider,.expand-card').on('click', function() {
      const currentItemId = $(this).closest('.card-title ').data('id')
      pauseAllVideoExept(currentSlideId)
      muteAllVideo();
      activeFirstVideo();
      $('.carousel-toolbar').show().addClass('d-flex')

      destroyMasonryLayout();
      activateCarousel(currentItemId) 
      generateNavigation()
      scrollToCurrentSlide(currentItemId)
    });

  $('#closeSlickModal').on('click', function() {
    $('.carousel-toolbar').hide().removeClass('d-flex')
    muteAllVideo();
    deactivateCarousel();
    scrollToCurrentSlide();
  });
});
// Let's assume 'currentSlideId' is already declared as you mentioned
var currentSlideId = 0;

// Function to update the currentSlideId based on which image is closest to the top of the viewport
function updateCurrentSlideId() {
    var closestDistance = Infinity; // Start with a really high number
    $('.custom-carousel-item').each(function() {
        var distanceFromTop = $(this).offset().top - $(window).scrollTop();
        if (distanceFromTop < closestDistance && distanceFromTop > -100) { // Adjust -100 based on your needs
            closestDistance = distanceFromTop;
            currentSlideId = $(this).find('.info-container').attr('data-id');
        }
    });
}

// Function to scroll to the current slide based on currentSlideId
function scrollToCurrentSlide(currentItemId) {
  if(currentItemId){currentSlideId=currentItemId}
  var targetElement = $(`.custom-carousel-item[data-id="${currentSlideId}"]`);
  if (targetElement.length) {
      $('html, body, .custom-carousel-container').animate({
          scrollTop: targetElement.offset().top
      }, 1000); // Smooth scroll with a duration of 1000ms
  } else {
      console.log("No element found with ID:", currentSlideId);
  }
}
function prependCurrentCard(currentItemId){
  // First, we find our VIP element using the passed `currentItemId`
  var targetElement = $(`.custom-carousel-item[data-id="${currentItemId}"]`);
  
  // Here's the swanky VIP lounge, aka the container
  const container = $('.custom-carousel-container');
  
  // Now, let's move our VIP element to the front of the line
  container.prepend(targetElement);
}

//$(window).on('scroll', updateCurrentSlideId);
$('html, body, .custom-carousel-container').on('scroll', updateCurrentSlideId)

function activateCarousel(currentItemId) {
  const carouselContainer = $('.custom-carousel-container')
  const cards = $('.custom-carousel-item');
  isFullScreen = true
  carouselContainer.removeClass('row')
  carouselContainer.css({
      display: 'flex',
      "align-items":"center",
      "flex-direction":"column",
      overflowY: 'auto',
      position: "absolute",
      inset: "0",
      "z-index":2,
      "background-color": "#000000d4"
  });
  removeGridDesign(cards)
  cards.each(function() {
    $(this).find('.video-container').css("max-height","80vh").css("width","100vw")
    $(this).find('.video-container img').css("max-height","80vh")
  });
  // And let's give the cards a bit of breathing room
  cards.css({
      flex: '0 0 auto',
      marginRight: '20px' // Feel free to adjust the spacing to your liking
  });
  prependCurrentCard(currentItemId)
}
function deactivateCarousel() {
  const carouselContainer = $('.custom-carousel-container')
  const cards = $('.custom-carousel-item');
  isFullScreen = false
  carouselContainer.addClass('row')
  // Return the container to its original comfy state
  carouselContainer.css({
      display: '',
      "flex-direction":"",
      "align-items":'',
      position: "",
      overflowY: '',
      "z-index":'',
      "background-color": ""
  });
  
  cards.each(function() {
    $(this).find('.video-container').css("height","100%").css("width","100%")
  });
  // And let the cards slump back into their natural state
  cards.css({
      flex: '',
      marginRight: '' // Removing the extra space we added earlier
  });
  prependCurrentCard(currentSlideId)
  console.log({currentSlideId})
  handleMasonry()
  updategridlayout();
}

function removeGridDesign(cards){
  cards.each(function() {
    // For each card, we'll get its class list
    var classes = this.className.split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
        // If a class begins with 'col-', we show it the door
        if (classes[i].startsWith('col-')) {
            $(this).removeClass(classes[i]);
        }
    }
    $(this).find('.video-container').addClass("h-100vh")
});

}
function pauseAllVideoExept(currentSlideId) {
  $(document).find(`video`).each(function() {
    if($(this).closest('.video-container').data('id') != currentSlideId){
      $(this).trigger('pause')
      $(this).addClass('force-pause-carousel')
    }
  });
}
function enableAllVideo(){
  $(document).find(`video`).each(function() {
    setTimeout(() => {
          $(this).removeClass('force-pause-carousel')
    }, 1000);
  });
}
function muteAllVideo(){
  $('video').each(function() {
    this.muted = true;
  });

  // Toggle the icon visibility
  $('.fa-volume-up').addClass('d-none');
  $('.fa-volume-off').removeClass('d-none');
}
function activeFirstVideo(){
  $('.custom-carousel-container video').eq(0).trigger('play')
}