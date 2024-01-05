
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
      const modelName = data.model ? data.model : 'No Model Selected';
      document.getElementById('modelDropdown').innerText = modelName;
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

}

function selectTag(el){
  selectSingleTagPerCategory(el);
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
              'class': 'tags badge text-bg-primary me-2 mb-2', 
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
      $(this).removeClass('selected');
    }
  });

  // Select the clicked tag
  $(el).addClass('selected');
}

function generateThis(itemId) {

  var url = "/api/sdimage/" + itemId;
  $.get(url, function(data) {
    const imagePath = `./public/output/${itemId}.png`;
    generateDiffusedImage(data.prompt,imagePath)
  })
  .fail(function() {
    console.log("Oops! Couldn't fetch the item. Maybe it's on a coffee break?");
  });
}



function generateDiffusedImage(prompt,imagePath) {
  if($('#generate-button').hasClass('isLoading')){
    return
  }
  $('.loader').show();
  $('.fa-spinner').addClass('rotate');
  
  $('#generate-button').hide().addClass('isLoading')

  const inputString = prompt ? '' : $('#tag-input').val();
  const promptString = prompt || $('#prompt-input').val();
  const aspectRatio = getCurrentActiveAspect()

  console.log(`Generate ${aspectRatio} ${inputString} ${promptString}  `)
 
  const query = imagePath ? '/api/img2img' : '/api/txt2img'
  fetch(query, { // Update the URL to match the API endpoint on your Node.js server
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      prompt: promptString+',('+inputString+')', 
      negative_prompt: '', 
      aspectRatio,
      imagePath:imagePath ? imagePath : null
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status} ${response.statusText})`);
      }

      return response.json(); // Use response.json() to parse the JSON response
    })
    .then(data => {
      generateImage(data)
    })
    .catch(error => {
      console.error('Error generating diffused image:', error);
    })
    .finally(() => {
      $('.loader').hide();
      $('.fa-spinner').removeClass('rotate');
      $('#generate-button').show()
      $('#generate-button').removeClass('isLoading')
    });
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

  generateDiffusedImage();
}

function updateTagsList() {
  const tagsList = $('#tags-list');
  tagsList.empty(); // Clear the list before adding new items

  $('.tags.selected').each(function() {
    // Get the name of the tag
    const tagName = $(this).data('namejp');

    // Append it to the list
    tagsList.append($('<div class="d-inline badge bg-white text-dark shadow border mx-1">').text(tagName));
  });

  // Save the updated list of selected tags
  saveSelectedTags();
}

function saveSelectedTags() {
  const selectedTags = [];

  $('.tags.selected').each(function() {
    selectedTags.push($(this).data('namejp'));
  });

  // Save the array of selected tags to local storage
  localStorage.setItem('selectedTags', JSON.stringify(selectedTags));
}
function initializeTags() {
  const savedTags = JSON.parse(localStorage.getItem('selectedTags'));

  if (savedTags) {
    savedTags.forEach(tagName => {
      // Add the 'selected' class to the tags that were saved
      $('.tags').filter(function() {
        return $(this).data('namejp') === tagName;
      }).addClass('selected');
    });

    // Now update the tags list
    updateTagsList();
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
    $gallery.slick('slickGoTo', slideIndex);
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
    $gallery.slick('slickGoTo', slideIndex, true);
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
  $gallery.slick('slickGoTo', newIndex, true);
}
function addImageToList(imgElement) {
  var $gallery = $('#diffused-image-gallery');
  var slideIndex = $gallery.slick('slickCurrentSlide');

  const imgContainer = $('#imageList');
  // Add a click event listener to the image
  $(imgElement).on('click', function() {
    makeNavGalleryFullScreen(slideIndex)
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
  $navGallery.slick('slickGoTo', slideIndex, true);
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
  $navGallery.slick('slickGoTo', slideIndex, true);
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
                      $('<div>').addClass('image-gallery-container masonry-item col-6 col-sm-4 col-lg-3 p-1').append(
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
