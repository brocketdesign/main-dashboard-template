const getCurrentSlide = () => {
        // Get a reference to the Slick slider instance
        var slickSlider = $('#slickCarousel').slick('getSlick');

        // Assuming you want to remove the currently active slide (current slide)
        return slickSlider.currentSlide
}
const removeCurrentSlide = (images) => {
    // Get a reference to the Slick slider instance
    var slickSlider = $('#slickCarousel').slick('getSlick');
    const currentIndex = slickSlider.currentSlide;
    // Use the slickRemove method to remove the current slide
    slickSlider.slickRemove(currentIndex);  
    // Remove the corresponding card from images array
    images.splice(currentIndex, 1);
}
function scrollToCurrentSlide(images) {
  // Get the current slide index
  const currentSlide = getCurrentSlide();
  const imageId = images[currentSlide].id;

  // Find the div element you want to scroll to
  const targetElement = $(`.card.info-container[data-id=${imageId}]`);

  // Check if the element exists
  if (targetElement.length > 0) {
      // Calculate the position to scroll to
      const scrollToPosition = targetElement.offset().top;

      $('html, body').animate({
        scrollTop: scrollToPosition
    }, 1000, function() {
        enableAllVideo();
    });
    
  } else {
      console.log(`Element with ID ${imageId} not found.`);
  }
}

const updateSliderToolBar = (images) => {
    const currentSlide = getCurrentSlide();
    $('#slickCarousel-tool-bar').attr('data-id',images[currentSlide].id)
    $('#slickCarousel-tool-bar').attr('data-title',images[currentSlide].title)
    $('#slickCarousel-tool-bar').find('.source').attr('href',images[currentSlide].source)
    console.log(images[currentSlide])
    const $buttonDownload = $('#slickCarousel-tool-bar').find('.download-button')
    $buttonDownload
    .removeClass('done text-primary')
    .data('id',images[currentSlide].id)
    .data('title',images[currentSlide].title)
}
function managevideo(images){
  const currentSlide = getCurrentSlide();
  const playButton = '.slick-slide.slick-current.slick-active .play-button'
  const iframeButton = '.slick-slide.slick-current.slick-active .iframe-button'
  const videoElement = '.slick-slide.slick-current.slick-active video'
  if(!!document.querySelector(playButton)){$(playButton).click()}
  if(!!document.querySelector(iframeButton)){$(iframeButton).click()}
  if(!!document.querySelector(videoElement)){$(videoElement)[0].play()}
  //Stop previous video
  const previousIndex = $(`.slick-slide[data-slick-index=${currentSlide-1}]`);
  const previousVideo = previousIndex.find('video');
  if (previousVideo.length > 0) {
      previousVideo[0].pause(); // Access the native video element
  }
  const videoId = images[currentSlide-1]? images[currentSlide-1].id : false
  if( $(`.video-container[data-id=${videoId}] video`).length>0){
    $(`.video-container[data-id=${videoId}] video`)[0].pause();
  }
}
function generateNavigation(){
  const preveNav = $('#slickCarousel .slick-prev')
  const nextNav = $('#slickCarousel .slick-next')
  preveNav.html('<i class="fas fa-angle-left"></i>')
  preveNav.addClass('badge bg-dark border-0 rounded-0 p-3')
  nextNav.html('<i class="fas fa-angle-right"></i>')
  nextNav.addClass('badge bg-dark border-0 rounded-0 p-3')
}

$(document).ready(function() {
    var currentSLideIndex = 0
    const images = $('.custom-carousel-item').map(function() {
      return {
        img: $(this).find('img').attr('src'),
        id: $(this).find('.info-container').attr('data-id'),
        source: $(this).find('.source').attr('href'),
        delete: $(this).find('.info-container').attr('data-id'),
        title:$(this).find('.info-container').attr('data-title')
      };
    }).get();

    $('#activeSlider,.expand-card')
    .on('click', function() {
    pauseAllVideo()
    
    var clickedImageIndex = images.findIndex(function(image) {
      return image.img === $(this).closest('.custom-carousel-item').find('img').attr('src');
    }.bind(this));

    clickedImageIndex = clickedImageIndex>=0? clickedImageIndex : currentSLideIndex
    $('#slickCarousel').empty();

    for (var i = 0; i < images.length; i++) {
      const currentCard = $(`.card.info-container[data-id="${images[i].id}"]`).parent().clone()
      currentCard.find('img').css({'object-fit':'contain','height':'','min-height':'auto'})
      //$('#slickCarousel').append('<div><img src="' + images[i].img + '" class="d-block w-100"></div>');
      $('#slickCarousel').append('<div style="height:100vh">'+currentCard.html()+'</div>');
    }

    $('#slickCarousel').on('afterChange swipe', function(event, slick, currentSlide) {
        updateSliderToolBar(images) 
        managevideo(images)
        currentSLideIndex = currentSlide
    });
    if(clickedImageIndex){
      $('#slickModal').on('shown.bs.modal', function () {
        $('#slickCarousel').slick('slickGoTo', clickedImageIndex);
      }); 
    }

    $('#slickCarousel').slick({
      arrows: true,
      dots: false,
      infinite: true,
      speed: 300,
      slidesToShow: 1,
      adaptiveHeight: true
    });

    generateNavigation()
    //$('#slickCarousel').slick('slickGoTo', clickedImageIndex);


    $('#slickModal').modal('show');
  });
  $('#closeSlickModal').on('click', function() {
    $('#slickModal').modal('hide');
    scrollToCurrentSlide(images)
  });
  $('#slickModal').on('hidden.bs.modal', function () {
    $('#slickCarousel').slick('unslick');
    $('#slickModal').off('shown.bs.modal');
  });

    $('#slickCarousel-tool-bar').find('.slider-delete-button').on('click',function(){
        handleHiding($(this).closest('#slickCarousel-tool-bar').attr('data-id'))
        removeCurrentSlide(images);
        // Call 'slick("refresh")' to reinitialize the slider after slide removal
        $('#slickCarousel').slick('refresh');
    })
});
function pauseAllVideo() {
  $(document).find(`video`).each(function() {
    $(this).trigger('pause')
    $(this).addClass('force-pause')
  });
}
function enableAllVideo(){
  $(document).find(`video`).each(function() {
    setTimeout(() => {
          $(this).removeClass('force-pause')
    }, 1000);
  });
}