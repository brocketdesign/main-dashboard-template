
var currentPage = 1;
var isLoading = false;

window.onload = function() {
  fetch('/api/current-model')
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(data => {
      // If data.model is not defined or null, set the default value to "No Model Selected"
      const modelName = data.model ? data.model : 'picxReal_10';
      if(!!document.querySelector('#modelDropdown')){
        document.getElementById('modelDropdown').innerText = modelName;
      }
    })
    .catch(error => {
      console.error('There has been a problem with your fetch operation:', error);
    });
};




$(document).ready(function() {
  enableTooltips();

  handleCategories(function(){
    manageCategoriesBehavior();
    initializeTags();
  });

  initCarousel();

  handlePromptInput();

  initializeUserPreference();

  handleGenerateForever();

  displaySomeCivitAi();
  //Image gallery
  loadImages();
  $(window).scroll(function() {
    if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100 && !isLoading && !isAnyFullScreen()) {
        loadImages();
    }
  });

});

function enableTooltips(){
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
 }
function handlePromptInput(){
  autosize(document.querySelector('#prompt-input'));
  const promptInput = document.querySelector('#prompt-input');
  if(promptInput){
    promptInput.addEventListener('input', () => {
      autosize(promptInput);
    });
  }
  $('#prompt-input').on('keypress', function(e) {
      if (e.which == 13) { // 13 is the Enter key
          e.preventDefault(); // Stop that key from doing what it normally does
          // Call your secret function here!
          generateDiffusedImage();
      }
  });
}
function manageCategoriesBehavior() {

  // Listening for clicks on categories
  $(document).on('click', '[data-id^="category-"]', function() {
    // Extract the category ID
    const categoryID = $(this).data('id').split('-')[1];

    $('.categories').removeClass('selected');
    $('.subcategories[data-id^="subcategory-"]').hide();
    $('.tags').hide();

    $(this).addClass('selected');
    $(`.subcategories[data-id="subcategory-${categoryID}"]`).show();
  });

  // Listening for clicks on subcategories
  $(document).on('click', '[data-id^="subcategory-"]', function(event) {
    event.stopPropagation(); // Prevent the click from bubbling up to the category

    // Hide all tags before showing the selected subcategory's tags
    $('.tags').hide();

    // Show the tags related to the clicked subcategory
    $(this).find('.tags').show();
  });

  //handleTagBehavior
  $(document).on('click','#tags-list .tag',function(){
    const tagId = $(this).data('id')
    disableTag(tagId);
    updatePrompt();
    updateTagsList();
  })
}

function selectTag(el){
  selectSingleTagPerCategory(el);
  //updatePromptAndGenerate();
  updatePrompt();
  updateTagsList();
}

function saveUserTags(data){
  $.ajax({
    type: 'POST',
    url: 'tags',
    data: JSON.stringify(data),
    contentType: 'application/json',
    success: function(data) {
      console.log(data);
    },
    error: function(error) {
      console.error(error);
    }
  });
}

function promptreload(){
  $('#prompt-input').val('')
  
  $('.tags.selected').each(function(){
    $(this).removeClass('selected')
  })

  $('.tag').each(function(){
    $(this).text('')
  })

  $.ajax({
    type: 'POST',
    url: '/reset-tags',
    success: function(response) {
      console.log('Tag reset');
    },
    error: function(xhr, status, error) {
      console.error(error);
    }
  });
}

function togglePrompt(el){
  $(el).parent().find('.gallery-prompt').toggle()
}
function handleCategories(callback) {
  $(document).ready(function() {
    $.get('/api/categories', function(categories) {
      categories.forEach(category => {
        // Create category card with dark theme classes
        const categoryElement = $('<div>', { 'class': ' col-12 border border-light' });
        const cardElement = $('<div>', { 'class': 'categories card bg-dark text-white h-100 rounded-0', 'data-id': `category-${category.id}` });

        // Add card body with pointer style for the header
        const cardBody = $('<div>', { 'class': 'card-body' }).css({
          'cursor': 'pointer'
        });
        cardBody.append($('<span>', { 'class': 'card-title', 'data-name': category.name }).text(category.name_JP));

        // Create a container for subcategories
        const subcategoriesElement = $('<div>', { 'class': 'subcategories mt-2', 'data-id': `subcategory-${category.id}`, 'style': 'display:none;' });

        // Iterate over subcategories to create their elements
        category.subcategories.forEach(subcategory => {
          const subcategoryCardBody = $('<div>', { 'class': 'subcategory-body my-1 pt-2 px-3 rounded-0', 'data-id': `subcategory-${category.id}-${subcategory.id}` }).css({
            'cursor': 'pointer',
            'background-color': 'rgba(147, 147, 147, 0.37)', // Adjust the color to match your theme
            'border-radius': '0.25rem'
          });

          // Add the subcategory title
          subcategoryCardBody.append($('<span>', { 'class': 'subcategory-title fw-bold text-white', 'data-name': subcategory.name }).text(subcategory.name_JP));

          // Create a flex container for tags
          const tagsFlex = $('<div>', { 'class': 'd-flex flex-wrap align-items-center mt-2', 'data-id': `tag-${category.id}-${subcategory.id}` });

          // Iterate over tags to create their elements
          subcategory.tags.forEach(tag => {
            const tagBadge = $('<span>', { 
              'class': 'tags badge text-bg-dark me-2 mb-2', 
              'style': 'cursor: pointer;', 
              'data-id': `${category.id}-${subcategory.id}-${tag.id}`,
              'data-name': tag.name,
              'data-nameJP': tag.name_JP,
              'onclick': 'selectTag(this)'
            }).text(tag.name_JP != undefined ? tag.name_JP : tag.name);

            tagsFlex.append(tagBadge);
          });

          subcategoryCardBody.append(tagsFlex);
          subcategoriesElement.append(subcategoryCardBody);
        });

        cardElement.append(cardBody, subcategoriesElement);
        categoryElement.append(cardElement);
        $('#categories-container').append(categoryElement); // Assuming you have a div with this ID
      });
      if (callback) {
        callback();
      }
    });
  });
}

function selectSingleTagPerCategory(el) {
  const selectedTagId = $(el).data('id');
  const [categoryID, subcategoryID, tagID] = selectedTagId.split('-');

  // Deselect all other tags in the same category
  $(`[data-id^="category-${categoryID}"] .tags.selected`).each(function() {
    if ($(this).data('id') !== selectedTagId) {
      //$(this).removeClass('selected');
    }
  });

  // Select the clicked tag
  $(el).toggleClass('selected');
}

function generateThis(itemId) {

  var url = "/api/sdimage/" + itemId;
  $.get(url, function(data) {
    const imagePath = `./public/output/${itemId}.png`;
    generateDiffusedImage({prompt:data.prompt,imagePath,aspectRatio:data.aspectRatio})
  })
  .fail(function() {
    console.log("Oops! Couldn't fetch the item. Maybe it's on a coffee break?");
  });
}
let keepGenerating = false;

function generateForever(itemId) {
  if (!keepGenerating) {
    return;
  }

  var url = "/api/sdimage/" + itemId;
  $.get(url, function(data) {
    const imagePath = `./public/output/${itemId}.png`;
    generateDiffusedImage({prompt:data.prompt, imagePath, aspectRatio:data.aspectRatio});
    // Call generateThis again after generating the image
    generateForever(itemId);
  })
  .fail(function() {
    console.log("Oops! Couldn't fetch the item. Maybe it's on a coffee break?");
  });
}


function handleGenerateForever() {
  $('#keepGenerating-button').click(function() {
    keepGenerating = !keepGenerating;
    $(this).find('i').addClass('rotate')
    if (keepGenerating) {
      var $navGallery = $('#nav-gallery');
      var slideIndex = $navGallery.slick('slickCurrentSlide');
      const currentSlideElement = $navGallery.find('.slick-slide[data-slick-index="' + slideIndex + '"]');
      const itemId = currentSlideElement.find('img').data('id');    
      console.log("Let the image generation party begin!");
      generateForever(itemId);
    } else {
      console.log("Party's over, folks!");
      $(this).find('i').removeClass('rotate')
    }
  });
}



function generateDiffusedImage(option = {}) {
  if($('#generate-button').hasClass('isLoading')){
    return;
  }
  const {
    tags = $('#tag-input').val(),
    negativePrompt = $('#negativePrompt-input').val(),
    prompt = $('#prompt-input').val(),
    imagePath = null,
    aspectRatio = getCurrentActiveAspect(),
    isRoop = false,
    baseFace = null,
    itemId = null
  } = option;

  const API = $('#gen-container').data('api');
  let API_ENDPOINT = {
    img2img : !API ? '/api/img2img' : `/api/${API}/img2img`,
    txt2img : !API ? '/api/txt2img' : `/api/${API}/txt2img`
  };
  if(isRoop){
    API_ENDPOINT.img2img = API_ENDPOINT.img2img+'?isRoop=true'
    API_ENDPOINT.txt2img = API_ENDPOINT.txt2img+'?isRoop=true'
  }
  $(`.handle-roop[data-id=${itemId}]`).addClass('loading')
  $('.loader').show();
  $('.isgenerating').addClass('rotate');
  $('#generate-button').hide().addClass('isLoading');

  const modelName = $('#modelDropdown').text();

  console.log({tags,negativePrompt,prompt,imagePath,aspectRatio});

  let query = imagePath ? API_ENDPOINT.img2img : API_ENDPOINT.txt2img;
  fetch(query, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      prompt: prompt + ',(' + tags + ')', 
      negative_prompt: '', 
      aspectRatio,
      imagePath: imagePath ? imagePath : null,
      modelName,
      baseFace
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status} ${response.statusText})`);
      }

      return response.json(); // Use response.json() to parse the JSON response
    })
    .then(data => {
      const mode = parseInt($('.mode-container').data('mode'))
      if(mode == 7){
        generateAndUpdate(data,itemId)
        return
      }
      generateImage(data)
    })
    .catch(error => {
      console.error('Error generating diffused image:', error);
    })
    .finally(() => {
      $(`.handle-roop[data-id=${itemId}]`).removeClass('loading')
      $('.loader').hide();
      $('.isgenerating').removeClass('rotate isgenerating');
      $('#generate-button').show()
      $('#generate-button').removeClass('isLoading')
    });
}
function generateAndUpdate(data, imageId) {
  const base64Image = data.image;
  
  // Find the .video-container with the specific data-id and append the new image
  const imgContainer =  $('.video-container[data-id="' + imageId + '"]')
  const baseImageSrc = imgContainer.attr('src')
  imgContainer
      .find('img[data-id="' + imageId + '"]')
      .attr('data-src',baseImageSrc)
      .attr('data-roop',`data:image/png;base64, ${base64Image}`)
      .attr('src',`data:image/png;base64, ${base64Image}`)
  $('.handle-roop[data-id="' + imageId + '"]')
    .addClass('done')
  
  updateMasonryLayout();

  const $thisCard = imgContainer.closest('.card.info-container')
  addCardToList($thisCard)
}

function generateImage(data){

  const base64Image = data.image;
  const imageId = data.image_id
  // Create an <img> element
  const img = document.createElement('img');
  img.setAttribute('src', `data:image/png;base64, ${base64Image}`);
  img.setAttribute('class', 'm-auto');
  img.setAttribute('data-id',imageId)
  // Create a div element
  const div = document.createElement('div');
  div.setAttribute('class', 'gallery-item');
  
  // Wrap the img in the div
  div.appendChild(img);

  addSlide($(div).clone()); 
  addImageToList($(div).clone())
  
}
function changeModel(hash) {
  fetch('/api/model', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hash: hash }),
  })
    .then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then((data) => {
      console.log(data)
      // Update the dropdown button text to reflect the selected model
      document.getElementById('modelDropdown').innerText = data.model;
    })
    .catch((error) => {
      console.error('There has been a problem with your fetch operation:', error);
    });
}


function updatePrompt(){
  const selectedTags = [];
  $('.tags.selected').each(function() {
    const [categoryID, subcategoryID, tagID] = $(this).data('id').split('-');

    // Grabbing the names using the IDs
    const categoryName = $(`[data-id='category-${categoryID}']`).find('[data-name]').attr('data-name');
    const subcategoryName = $(`[data-id='subcategory-${categoryID}-${subcategoryID}']`).find('[data-name]').attr('data-name');
    const tagName = $(this).attr('data-name');

    // Push the combined names to the array
    selectedTags.push(`${categoryName} ${subcategoryName} ${tagName}`);
  });

  // Join the tags with a comma and update the input field
  const inputString = selectedTags.join(', ');  
  $('#tag-input').val(inputString);

}

function updatePromptAndGenerate(){
  const selectedTags = [];
  $('.tags.selected').each(function() {
    const [categoryID, subcategoryID, tagID] = $(this).data('id').split('-');

    // Grabbing the names using the IDs
    const categoryName = $(`[data-id='category-${categoryID}']`).find('[data-name]').attr('data-name');
    const subcategoryName = $(`[data-id='subcategory-${categoryID}-${subcategoryID}']`).find('[data-name]').attr('data-name');
    const tagName = $(this).attr('data-name');

    // Push the combined names to the array
    selectedTags.push(`${categoryName} ${subcategoryName} ${tagName}`);
  });

  // Join the tags with a comma and update the input field
  const inputString = selectedTags.join(', ');  
  $('#tag-input').val(inputString);

  generateDiffusedImage();
}

function updateTagsList() {
  const tagsList = $('#tags-list');
  tagsList.empty(); // Clear the list before adding new items

  $('.tags.selected').each(function() {
    // Get the name of the tag
    const tagName = $(this).data('namejp');
    const tagId = $(this).data('id');

    // Append it to the list
    tagsList.append(
      $('<div class="tag d-inline badge bg-white text-dark shadow border mx-1">')
      .attr('data-id',tagId)
      .css({'cursor':'pointer'})
      .text(tagName)
    );
  });

  // Save the updated list of selected tags
  saveSelectedTags();
}

function saveSelectedTags() {
  const selectedTags = [];

  $('.tags.selected').each(function() {
    selectedTags.push($(this).data('id'));
  });

  // Save the array of selected tags to local storage
  localStorage.setItem('selectedTags', JSON.stringify(selectedTags));
}
function initializeTags() {
  const savedTags = JSON.parse(localStorage.getItem('selectedTags'));

  if (savedTags) {
    savedTags.forEach(tagId => {
      // Add the 'selected' class to the tags that were saved
      $('.tags').filter(function() {
        return $(this).data('id') === tagId;
      }).addClass('selected');
    });

    // Now update the tags list
    updateTagsList();
    updatePrompt();
  }
}

function initCarousel(){
  initMainGallery();
  initNavGallery();
  handleCarouselBehavior();
}
function initMainGallery(slideIndex){
  const $gallery = $('#diffused-image-gallery')
  if ($gallery .hasClass('slick-initialized')) {
    $('diffused-image-gallery').slick('unslick');
  }  
  $gallery .slick({
    centerMode: true,
    centerPadding: '10vw',
    slidesToShow: 1,
    arrows: false, 
    fade: false,
    asNavFor: '#nav-gallery',
    responsive: [
      {
        breakpoint: 768, // For screens smaller than 768px
        settings: {
          centerPadding: '0',
        }
      }
      // You can add more breakpoints here if needed
    ]
  });
  if(slideIndex){
    goToSlideWhenReady($gallery, slideIndex);
  }
}
function initNavGallery(slideIndex){
  const $gallery = $('#nav-gallery')
  if ( $gallery.hasClass('slick-initialized')) {
     $gallery.slick('unslick');
  }  
  $gallery.slick({
    slidesToShow: 7,
    centerMode: true,
    focusOnSelect: true,
    slidesToScroll: 1,
    asNavFor: '#diffused-image-gallery',
    dots: false,
    arrows: false,
    responsive: [
      {
        breakpoint: 768, // For screens smaller than 768px
        settings: {
          slidesToShow: 3 // Adjust this number as needed for smaller screens
        }
      }
      // You can add more breakpoints here if needed
    ]
  });
  
  if(slideIndex){
    goToSlideWhenReady($gallery, slideIndex);
  }
}
function addSlide(imgElement) {
  var $gallery = $('#diffused-image-gallery');
  var $galleryNav = $('#nav-gallery');

  // Clone the image element for the navigation gallery
  var imgElementForNav = $(imgElement).clone();

  // Add the new slide to the main gallery
  $gallery.slick('slickAdd', imgElement);

  // Add the clone to the navigation gallery
  $galleryNav.slick('slickAdd', imgElementForNav);

  // Get the index of the last slide (which is the new one)
  var newIndex = $gallery.slick('getSlick').slideCount - 1;

  // Slide right to the new slide in the main gallery
  goToSlideWhenReady($gallery, newIndex);
}
function addImageToList(imgElement) {
  var $gallery = $('#diffused-image-gallery');
  // Get the index of the last slide (which is the new one)
  var newIndex = $gallery.slick('getSlick').slideCount - 1;

  const imgContainer = $('#imageList');
  // Add a click event listener to the image
  $(imgElement).on('click', function() {
    makeNavGalleryFullScreen(newIndex)
  });
  imgContainer.prepend(imgElement);
}
function makeNavGalleryFullScreen(slideIndex) {
  var $navGallery = $('#nav-gallery');
  var $toolbar = $('#fullscreen-toolbar');

  // Add a class for full-screen styling
  $navGallery.closest('.contain-carousel').addClass('full-screen').removeClass('position-relative');
  $toolbar.addClass('d-flex').show();

  if($navGallery.hasClass('slick-initialized')) {
    $navGallery.slick('unslick');
  }

  $navGallery.slick({
    centerMode: true,
    centerPadding: '25vw',
    asNavFor: '#diffused-image-gallery',
    dots: false,
    focusOnSelect: true,
    arrows: false,
    responsive: [
      {
        breakpoint: 768, // For screens smaller than 768px
        settings: {
          centerPadding: '0',
        }
      }
      // You can add more breakpoints here if needed
    ]
  });
  
  disableScrolling();
  goToSlideWhenReady($navGallery, slideIndex);
}

function revertNavGallery() {
  var $navGallery = $('#nav-gallery');
  var slideIndex = $navGallery.slick('slickCurrentSlide');
  var $toolbar = $('#fullscreen-toolbar');

  // Remove the full-screen class
  $navGallery.closest('.contain-carousel').removeClass('full-screen').addClass('position-relative');;
  $toolbar.removeClass('d-flex').hide();
  // Revert back to the original styles
  $navGallery.closest('.contain-carousel').attr('style', '');

  initNavGallery(slideIndex);
  enableScrolling();
}

function revertImageGallery() {
  var $navGallery = $('#image-gallery');
  var slideIndex = $navGallery.slick('slickCurrentSlide');
  var $toolbar = $('#image-gallery-fullscreen-toolbar');

  // Remove the full-screen class
  $navGallery.closest('.contain-carousel').removeClass('full-screen').addClass('position-relative');
  $toolbar.removeClass('d-flex').hide();
  // Revert back to the original styles
  $navGallery.closest('.contain-carousel').attr('style', '');

  // Unslick the gallery
  $navGallery.slick('unslick');
  enableScrolling();
  restoreOriginalOrder();
  scrollToOriginalImage(slideIndex);
}

function scrollToOriginalImage(slideIndex) {
  var $targetImage = $('#image-gallery .image-gallery-container[data-original-order=' + slideIndex + ']');
  if ($targetImage.length) {
    $('html, body').animate({
      scrollTop: $targetImage.offset().top
    }, 500); 
  }
}

function makeImageGalleryFullScreen(slideIndex) {
  var $navGallery = $('#image-gallery');
  var $toolbar = $('#image-gallery-fullscreen-toolbar');

  // Add a class for full-screen styling
  $navGallery.closest('.contain-carousel').addClass('full-screen').removeClass('position-relative');
  $toolbar.addClass('d-flex').show();

  setOriginalOrder();

  if ($navGallery.hasClass('slick-initialized')) {
    $navGallery.slick('unslick');
  }

  $navGallery.slick({
    centerMode: true,
    centerPadding: '25vw',
    dots: false,
    focusOnSelect: true,
    arrows: false,
    responsive: [
      {
        breakpoint: 768, // For screens smaller than 768px
        settings: {
          centerPadding: '0',
        }
      }
      // You can add more breakpoints here if needed
    ]
  });
  
  disableScrolling();
  goToSlideWhenReady($navGallery, slideIndex);
}

function handleCarouselBehavior(){
  $(document).find('#fullscreen').on('click', function() {
    var slideIndex = $('#diffused-image-gallery').slick('slickCurrentSlide');
    makeNavGalleryFullScreen(slideIndex);
  });
  $(document).find('#close-fullscreen').on('click', function() {
    revertNavGallery();
  });
  $(document).find('.regeneration').on('click', function() {
    var $navGallery = $('#nav-gallery');
    var slideIndex = $navGallery.slick('slickCurrentSlide');
    const currentSlideElement = $navGallery.find('.slick-slide[data-slick-index="' + slideIndex + '"]');
    const itemId = currentSlideElement.find('img').data('id');    
    $(this).find('i').addClass('isgenerating')
    generateThis(itemId)
  }); 

  $(document).on('click', '#image-gallery .image-gallery-container', function() {
    if($('#image-gallery').closest('.contain-carousel').hasClass('full-screen')){return}
    const slideIndex = $(this).index();
    makeImageGalleryFullScreen(slideIndex);
  });
  $(document).find('#close-image-gallery-fullscreen').on('click', function() {
    revertImageGallery();
  });
  $(document).find('.image-gallery-regeneration').on('click', function() {
    var $navGallery = $('#image-gallery');
    var slideIndex = $navGallery.slick('slickCurrentSlide');
    const currentSlideElement = $navGallery.find('.slick-slide[data-slick-index="' + slideIndex + '"]');
    const itemId = currentSlideElement.find('img').data('id');    
    $(this).find('i').addClass('isgenerating')
    generateThis(itemId)
  }); 
}

function disableScrolling() {
  document.body.classList.add('no-scroll');
}
function enableScrolling() {
  document.body.classList.remove('no-scroll');
}

function loadImages() {
  if (isLoading) return;
  isLoading = true;
  $.ajax({
      url: '/api/sdgallery?page=' + currentPage,
      type: 'GET',
      dataType: 'json',
      success: function(response) {
          if (response.images.length > 0) {
              response.images.forEach(function(image, index) {
                  const order = (currentPage - 1) * response.images.length + index;
                  $('#image-gallery').append(
                      $('<div>').addClass('image-gallery-container col-6 col-sm-4 col-lg-3 p-1 m-auto').append(
                          $('<img>').attr('src', 'data:image/png;base64,' + image.image).attr('data-id', image.imageId)
                      )
                  );
              });
              currentPage++;
          }
          isLoading = false;
          //updateMasonryLayout();
      },
      error: function() {
          console.error('Error fetching images');
          isLoading = false;
      }
  });
}


function restoreOriginalOrder() {
  var items = $('#image-gallery .image-gallery-container').detach().toArray();
  items.sort(function(a, b) {
      return $(a).data('original-order') - $(b).data('original-order');
  });
  $('#image-gallery').append(items);
}
function setOriginalOrder(){
  $('#image-gallery .image-gallery-container').each(function(index) {
    $(this).attr('data-original-order', index);
  });
}
function isAnyFullScreen() {
  // Check if any .contain-carousel has the .full-screen class
  return $('.contain-carousel.full-screen').length > 0;
}
function changeAspectRatio(ratio) {
  // Assuming you have a function that saves the preference to the database, cookies, or local storage
  saveUserPreference(ratio);

  // Add some classy jQuery to toggle an 'active' class
  $('.aspect-ratio-btn span').removeClass('active');
  $('#ratio' + ratio.replace(':', 'x') + ' span').addClass('active');
}

// Example save function, replace with your actual implementation
function saveUserPreference(ratio) {
  
  localStorage.setItem('userAspectRatio', ratio);
  
  // Add some classy jQuery to toggle an 'active' class
  $('.aspect-ratio-btn span').removeClass('active');
  $('#ratio' + ratio.replace(':', 'x') + ' span').addClass('active');
}

function initializeUserPreference() {
  // Check local storage for the user's preference
  var savedRatio = localStorage.getItem('userAspectRatio');
  
  // If we've got something, great! If not, default to '1:1' like a good old square
  var aspectRatio = savedRatio || '1:1';

  // Now let's set the stage with the user's last-known or default preference
  changeAspectRatio(aspectRatio);
}
function getCurrentActiveAspect() {
  // Find the span with the 'active' class and get the id of its parent button
  var activeButtonId = $('.aspect-ratio-btn span.active').parent().attr('id');
  
  // We've got the ID, now let's extract the aspect ratio
  var aspectRatio = activeButtonId.replace('ratio', '').replace('x', ':');
  
  // Return the ratio to whoever's asking
  return aspectRatio;
}

function disableTag(tagId){
  $(document).find(`.subcategories .tags.selected[data-id="${tagId}"]`).removeClass('selected');
}

function goToSlideWhenReady($gallery, newIndex) {
  // Check if the slider is initialized
  if ($gallery.hasClass('slick-initialized')) {
      // The slider is ready, let's jump to the slide!
      $gallery.slick('slickGoTo', newIndex, true);
      console.log("Slider was ready! Jumped to slide:", newIndex);
  } else {
      // The slider isn't ready, let's wait a bit and try again
      console.log("Waiting for the slider... 🕒");
      setTimeout(() => goToSlideWhenReady($gallery, newIndex), 500); // Checks every half a second
  }
}

function checkInputAndParty() {
  // Grab that input value like it's the last piece of pizza
  const query = $('#civitai-input').val();
  
  // Is it a number or is it a cleverly disguised letter?
  if ($.isNumeric(query)) {
      // If it's a number, let's party 🎉
      _getCivitAiData(page=1);
      console.log("Woo! That's a number. Party on!");
  } else {
      // If not, well, let's have a different kind of party 🎭
      getCivitAiModelData(page=1);
      console.log("Oh no! That's not a number. Party elsewhere!");
  }
}


function displaySomeCivitAi(){
  const gallery = $('#image-gallery-civitai-home');
  $.get('https://civitai.com/api/v1/images?limit=20&nsfw=true',function(response){
    displayCivitGallery(gallery,response.items)
  })
}


function getCivitAiModelData(page=1){
  const query = $('#civitai-input').val()
  const gallery = $('#civitai-gallery-civitai');
  if(!query){
    console.log('No ID provided')
  }
  $.get(`https://civitai.com/api/v1/models?limit=5&nsfw=true&page=${page}&query=${query}`,function(response){
    const allImages = response.items.reduce((imageArray, item) => {
      const modelVersionImages = item.modelVersions.reduce((acc, modelVersion) => {
        return acc.concat(modelVersion.images);
      }, []);
    
      return imageArray.concat(modelVersionImages);
    }, []);
    
    console.log("Feast your eyes on these images!", allImages);
    displayCivitGallery(gallery,allImages)
  })

}
function _getCivitAiData(){
  const civitaiID = $('#civitai-input').val()
  const gallery = $('#civitai-gallery-civitai');
  if(!civitaiID){
    console.log('No ID provided')
  }
  $.get('https://civitai.com/api/v1/model-versions/'+civitaiID,function(response){
    displayCivitGallery(gallery,response.images)
  })

}
function getCivitAiData(page=1){
  const civitaiID = $('#civitai-input').val()
  const gallery = $('#civitai-gallery-civitai');
  if(!civitaiID){
    console.log('No ID provided')
  }
  $.get(`https://civitai.com/api/v1/images?limit=20&page=${page}&modelVersionId=${civitaiID}`,function(response){
    console.log(response)
    displayCivitGallery(gallery,response.items)
  })

}
function displayCivitGallery(gallery,images) {

  gallery.empty();
  for (let image of images) {
    if(!image.meta){
      continue;
    }
      gallery.append(
          $('<div>').addClass('image-gallery-container col-6 col-sm-4 col-lg-3 p-1 m-auto position-relative')
          .append($('<img>')
              .addClass('lazy')
              .attr('data-src', image.url)
              .attr('data-prompt', image.meta.prompt)
              .attr('data-negativePrompt', image.meta.negativePrompt)
              .css('width', '100%')
          )
          .append($('<div>')
              .addClass('toolbar show-on-hover position-absolute')
              .css({ 'bottom': '0', 'left': '0', 'right': '0' })
              .append($('<button>')
                  .addClass('btn btn-light')
                  .html('<i class="fa fa-spinner"></i>') // Add spinner icon here
                  .on('click', function () {
                      generateDiffusedImage({prompt: image.meta.prompt, negativePrompt: image.meta.negativePrompt,tags:'', aspectRatio: findClosestAspectRatio(image.width, image.height) });
                  })
              )
              .append($('<button>')
                  .addClass('btn btn-light')
                  .html('<i class="fa fa-image"></i>') // Add spinner icon here
                  .on('click', function () {
                      generateDiffusedImage({imagePath:image.url, prompt: image.meta.prompt, negativePrompt: image.meta.negativePrompt,tags:'', aspectRatio: findClosestAspectRatio(image.width, image.height) });
                  })
              )
          )
      );
      $(document).find(".image-gallery-container img.lazy").Lazy();
  }
}


function findClosestAspectRatio(width, height) {
  // Calculate the actual aspect ratio
  const actualRatio = width / height;

  // Define our eligible aspect ratios
  const ratios = {
      '1:1': 1,
      '2:3': 2 / 3,
      '3:2': 3 / 2
  };

  // Find the closest aspect ratio
  let closestMatch = '';
  let smallestDifference = Infinity;

  for (const ratio in ratios) {
      const difference = Math.abs(ratios[ratio] - actualRatio);
      if (difference < smallestDifference) {
          smallestDifference = difference;
          closestMatch = ratio;
      }
  }

  // Return the closest aspect ratio
  return closestMatch;
}

