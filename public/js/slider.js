function generateNavigation() {
  $('#slickCarousel .slick-prev').html('<i class="fas fa-angle-left"></i>').addClass('badge bg-dark border-0 rounded-0 p-3');
  $('#slickCarousel .slick-next').html('<i class="fas fa-angle-right"></i>').addClass('badge bg-dark border-0 rounded-0 p-3');
}

$(document).ready(function() {
  $(document).on('click','#activeSlider,.expand-card', function() {
    const currentItemId = $(this).closest('.info-container').data('id');
    sessionStorage.setItem('isexpand', 'true'); // or any value you want
    pauseAllVideoExept(currentSlideId);
    muteAllVideo();
    activeFirstVideo();
    $('.carousel-toolbar').show().addClass('d-flex');
    destroyMasonryLayout();
    activateCarousel(currentItemId);
    generateNavigation();
    scrollToCurrentSlide(currentItemId);
    $(`.play-button[data-id="${currentItemId}"],.instant-play-button[data-id="${currentItemId}"]`).click();
  });

  $('#closeSlickModal').on('click', function() {
    $('.carousel-toolbar').hide().removeClass('d-flex');
    sessionStorage.removeItem('isexpand');
    muteAllVideo();
    deactivateCarousel();
    scrollToCurrentSlide();
  });

  $('html, body, .custom-carousel-container').on('scroll', updateCurrentSlideId);
});

var currentSlideId = 0;

function updateCurrentSlideId() {
  var closestDistance = Infinity;
  $('.custom-carousel-item').each(function() {
    var distanceFromTop = $(this).offset().top - $(window).scrollTop();
    if (distanceFromTop < closestDistance && distanceFromTop > -100) {
      closestDistance = distanceFromTop;
      currentSlideId = $(this).find('.info-container').attr('data-id');
    }
  });
}

function scrollToCurrentSlide(currentItemId) {
  if (currentItemId) currentSlideId = currentItemId;
  var targetElement = $(`.custom-carousel-item[data-id="${currentSlideId}"]`);
  targetElement.addClass('active')
  if (targetElement.length) {
    $('html, body, .custom-carousel-container').animate({ scrollTop: targetElement.offset().top }, 100);
  } else {
    console.log("No element found with ID:", currentSlideId);
  }
}

function prependCurrentCard(currentItemId) {
  var targetElement = $(`.custom-carousel-item[data-id="${currentItemId}"]`);
  $('.custom-carousel-container').prepend(targetElement);
}

function activateCarousel(currentItemId) {
  $('.setting-absolute').each(function() {
    $(this).hide();
  });
  $('.pagination').toggleClass('d-flex d-none')
  $('#imageList').hide();
  const carouselContainer = $('.custom-carousel-container');
  const cards = $('.custom-carousel-item');
  isFullScreen = true;
  carouselContainer.removeClass('row').css({
    display: 'flex', "align-items": "center", "flex-direction": "column",
    overflowY: 'auto', position: "absolute", inset: "0",
    "z-index": 2, "background-color": "#000000d4"
  }).addClass('fullScreen');
  removeGridDesign(cards);
  cards.css({ flex: '0 0 auto', marginRight: '20px' })
    .find('.video-container').css({ "max-height": "80vh", width: "100vw" })
    .find('img').css("max-height", "80vh");
  prependCurrentCard(currentItemId);
}

function deactivateCarousel() {
  $('.setting-absolute').each(function() {
    $(this).show();
  });
  $('.pagination').toggleClass('d-flex d-none')
  $('#imageList').show();
  const carouselContainer = $('.custom-carousel-container');
  const cards = $('.custom-carousel-item');
  isFullScreen = false;
  carouselContainer.addClass('row').css({
    display: '', "flex-direction": "", "align-items": '',
    position: "", overflowY: '', "z-index": '', "background-color": ""
  }).removeClass('fullScreen');
  cards.css({ flex: '', marginRight: '' })
    .find('.video-container').css({ height: "100%", width: "100%" });
  prependCurrentCard(currentSlideId);
  handleMasonry();
  updategridlayout();
}

function removeGridDesign(cards) {
  cards.each(function() {
    $(this).removeClass(function(index, className) {
      return (className.match(/(^|\s)col-\S+/g) || []).join(' ');
    }).find('.video-container').addClass("h-100vh");
  });
}

function pauseAllVideoExept(currentSlideId) {
  $('video').each(function() {
    if ($(this).closest('.video-container').data('id') != currentSlideId) {
      $(this).trigger('pause').addClass('force-pause-carousel');
    }
  });
}

function enableAllVideo() {
  $('video').each(function() {
    setTimeout(() => $(this).removeClass('force-pause-carousel'), 1000);
  });
}

function muteAllVideo() {
  $('video').prop('muted', true);
  $('.fa-volume-up').addClass('d-none');
  $('.fa-volume-off').removeClass('d-none');
}

function activeFirstVideo() {
  $('.custom-carousel-container video').eq(0).trigger('play');
}
