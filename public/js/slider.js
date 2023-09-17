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
$(document).ready(function() {

    const images = $('.custom-carousel-item').map(function() {
      return {
        img: $(this).find('img').attr('src'),
        id: $(this).find('.info-container').attr('data-id'),
        source: $(this).find('.source').attr('href'),
        delete: $(this).find('.info-container').attr('data-id'),
        title:$(this).find('.info-container').attr('data-title')
      };
    }).get();

    $('.custom-carousel-item[data-mode="3"] .card-body-over, .custom-carousel-item[data-mode="4"] .card-body-over ')
    .on('click', function() {
    var clickedImageIndex = images.findIndex(function(image) {
      return image.img === $(this).closest('.custom-carousel-item').find('img').attr('src');
    }.bind(this));

    $('#slickCarousel').empty();

    for (var i = 0; i < images.length; i++) {
      $('#slickCarousel').append('<div><img src="' + images[i].img + '" class="d-block w-100"></div>');
    }

    $('#slickCarousel').on('afterChange swipe', function(event, slick, currentSlide) {
        updateSliderToolBar(images) 
    });

    $('#slickModal').on('shown.bs.modal', function () {
      $('#slickCarousel').slick('slickGoTo', clickedImageIndex);
    });

    $('#slickCarousel').slick({
      dots: false,
      infinite: true,
      speed: 300,
      slidesToShow: 1,
      adaptiveHeight: true
    });
    //$('#slickCarousel').slick('slickGoTo', clickedImageIndex);


    $('#slickModal').modal('show');
  });
  $('#closeSlickModal').on('click', function() {
    $('#slickModal').modal('hide');
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
