// Utility functions
const logout = () => window.location.href = '/user/logout';
const YOUR_LARGE_SCREEN_BREAKPOINT = 992
// Use showdown library to convert markdown to HTML
const converter = new showdown.Converter();
const checkFormChange = (initialData, form) => {
    return Array.from(form.entries()).some(([name, value]) => value !== initialData.get(name));
}

const previewImage = (imageInput, imagePreview) => {
    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        $(imagePreview).show()
        reader.onload = () => imagePreview.src = reader.result;
        reader.readAsDataURL(file);
    });
}

const inputTrigger = (inputElement, triggerElement) => {
    triggerElement.addEventListener('click', () => inputElement.click());
}
let msnry = null ;
let isFullScreen = false
const handleMasonry = () => {
    const masonryContainer = document.querySelector('.masonry-container');
    const gridRangeValue = $('#grid-range').val();

    if(masonryContainer && (window.innerWidth >= YOUR_LARGE_SCREEN_BREAKPOINT || gridRangeValue >= 2)) {
        msnry = new Masonry(masonryContainer, {
            itemSelector: '.masonry-item:not([style*="display: none"])', 
            columnWidth: '.masonry-item',
            percentPosition: true
        });
    }
}

function updateMasonryLayout() {
    if (msnry && !isFullScreen) {
        msnry.layout();
    }
}

function destroyMasonryLayout(callback) {
    if (msnry) {
        msnry.destroy();
        if(callback) { callback(); }
    }
}
function reinitializeMasonry() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const masonryContainer = document.querySelector('.masonry-wrapper');
    
    // Lock the height to prevent scrolling
    const originalHeight = masonryContainer.offsetHeight;
    masonryContainer.style.height = `${originalHeight}px`;

    destroyMasonryLayout(() => {
        handleMasonry();
        updateMasonryLayout();

        // Restore the scroll position
        window.scrollTo(scrollLeft, scrollTop);

        // Unlock the height after layout update
        masonryContainer.style.height = '';
    });
}

// Masonry setup
$(window).on('load', function() {
    handleMasonry()
});
$(window).on('resize', function() {
    if(isFullScreen){return}
    //handleMasonry()
});

$(document).ready(function() {
    let formChanged = false;
    let form = $('#updateProfile form').not('#reset-form');
    let inputs = $('#updateProfile form input, #updateProfile form select, #updateProfile form textarea');
    let initialFormData = new FormData(form[0]);

    inputs.change(() => formChanged = true);
    form.on('submit', () => formChanged = false);
    window.onbeforeunload = () => formChanged ? "You have unsaved changes. Are you sure you want to leave this page?" : undefined;
    // Form submission handling
    form.on('submit', function(e) {
        e.preventDefault();

        let formData = new FormData(this);

        console.log(formData);

        if (!checkFormChange(initialFormData, formData)) {
            alert('フォームに変更はありません。');
            return
        }

        handleFormSubmission(formData);
    }); 

    // Image preview and click to trigger file input
    const profileImageInput = document.getElementById('profileImage');
    const bannerImageInput = document.getElementById('bannerImage');
    const galleryImageInput = document.getElementById('image-upload');

    if (profileImageInput && bannerImageInput && galleryImageInput) {
      inputTrigger(profileImageInput, document.querySelector('.profile-image'));
      inputTrigger(bannerImageInput, document.querySelector('.banner-image'));
      inputTrigger(galleryImageInput, document.querySelector('#upload-btn'));
  
      previewImage(profileImageInput, document.querySelector('.profile-image img'));
      previewImage(bannerImageInput, document.querySelector('.header img'));
      previewImage(galleryImageInput, document.querySelector('img#image-upload-holder'));
  
    }
    // Active Tab
    if($('#updateProfile').length>0){
        if (document.querySelector('.nav-tabs')) {
            let activeTab = localStorage.getItem('activeTab');
            if(activeTab){
              new bootstrap.Tab(document.querySelector(`a[href="${activeTab}"]`)).show();
            }else{
              new bootstrap.Tab(document.querySelector(`a[href="#personalInfo"]`)).show();
            }
            $('#updateProfile').fadeIn()
            document.querySelectorAll('.nav-tabs a').forEach(t => t.addEventListener('shown.bs.tab', (e) => {
                localStorage.setItem('activeTab', e.target.getAttribute('href'));
            }));
          }
    }



    // Other event listeners
    $(document).on('click', '.alert-container', function() { $(this).fadeOut();  });
    $(".card.pricing").hover(() => $(this).addClass('border-primary'), () => $(this).removeClass('border-primary'));
    $(document).on('click','.delete-button',function(e) { 
        e.preventDefault()
        const video = $(this).closest('.card').find('video').length > 0 ? $(this).closest('.card').find('video').get(0).pause() : null;
       
        handleHiding($(this).closest('.card').data('id'))  
    });
    $(document).on('keydown', function(e) {
        if (e.key === 'd' || e.key === 'D') {
            const currentActive = $('.custom-carousel-item.active');
            const itemID = currentActive.data('id');
            currentActive.find('.delete-button').click();
        }
    });
    $(document).on('click','.expand-button',function(e) { 
        e.preventDefault()
        handleExpand($(this).closest('.card').data('id'))  
    });
    
    $(document).on('click','.delete-button-history',function(e) { 
        e.preventDefault()
        $(this).closest('a').remove()
        handleHidingHistory($(this).closest('.card').attr('data-query'))  
    });

    $(document).on('click','.summarize-button', function(event) { 
        event.preventDefault(); // Prevents the default click behavior

        const videoId = $(this).closest('.card').data('id');
          console.log('Summarize button clicked for:', {videoId});
          var $buttonContainer = $(this);
    
          // Check if the card has already been processed
          if ($buttonContainer.hasClass('done')) {
            handleFormResult(false, '既にダウンロードされています') 
              console.log('Card has already been processed.');
              return;
          }
    
          // Mark the card as done to avoid processing it again
          $buttonContainer.addClass('done');
    
          const DLicon = $buttonContainer.find('i').clone();
          const $spinner = showSpinner($buttonContainer,'summary')

          let response = {}
          response.redirect = '/api/openai/summarize?videoId='+videoId
          handleStream(response, function(message) {
            const containerID = `card-summarize`;
            if($('#'+containerID).length == 0) {   
                $('#summary .content').html('')
                // Create an initial card with the insertedId as an identifier
                const initialCardHtml = `<div class="card mb-3"><div id="${containerID}" class="card-body"></div></div>`;
                const initialCardHtmlMobile = `<div class="card mb-3"><div id="mobile-${containerID}" class="card-body"></div></div>`;

                $('#summary .content').prepend(initialCardHtml);
                $('#mobile-toolbar').append(initialCardHtmlMobile);

                console.log(`Initial card created with id: ${containerID}`);
            }   
            watchAndConvertMarkdown(`#result`, `#${containerID}`); 
            watchAndConvertMarkdown(`#result`, `#mobile-${containerID}`); 
            $(`#result`).append(message);
        },function(endMessage){
            console.log('Stream ended')
            $spinner.hide();
            $buttonContainer.find('i').show();
        });

    });
    $('.card img').on('error', function() { 
        var videoId = $(this).data('id');
        console.log('Image load error for: ',videoId)
        $(`.card[data-id=${videoId}]`).addClass('border border-danger')
        updateMasonryLayout
    });
    
    $('.card img').on('load', function() { 
        var videoId = $(this).data('id');
        
        // Check image size and remove if smaller than 500x500
        if (this.naturalWidth < 500 || this.naturalHeight < 500) {
            //$(`.card[data-id=${videoId}]`).remove();
            //updateMasonryLayout();
        }
    });    
    
    $('.card img').on('load', function() { 
        updateMasonryLayout()
    });
    $(".card").on('mouseenter', function(){
        $(this).find('.hover').show();
    });

    $(".card").on('mouseleave', function(){
        $(this).find('.hover').hide();
    });

    $('input#searchterm').on('change',function(){$('#page').val(1)})
      
      
        $(document).on('mouseenter', '.tool-button', function() {
          $(this).tooltip('show');
        });
        $(document).on('mouseout', '.tool-button', function() {
          $(this).tooltip('hide');
        });

      
    // Initialize the showdown converter
    const converter = new showdown.Converter();

    // Grab the text from the .convertToHTML element(s)
    $('.convertToHTML').each(function() {
        let markdownContent = $(this).text();
        let htmlContent = converter.makeHtml(markdownContent);

        // Replace the content of the element with the converted HTML
        $(this).html(htmlContent);
    });
    
    $('.actress.card .player-button').on('click',function(e){
        e.stopPropagation()
        downloadVideo($(this).attr('data-id'), $(this).attr('data-name'))
    })

    if(window.innerWidth <= YOUR_LARGE_SCREEN_BREAKPOINT ){
        $(document).on('click', '.dropdownMenuButton', function(){
            $(this).dropdown('toggle');
          });
    }
    //HandleCardSetting();
    //handleCardButton();
    backtothetop();

    handleAudio();

    handleInstantVideo();

    activateClickOnVisibleButtons();
    handleFavorite();
    handleSelectCountry();
    handleCopyButtons();
    updateMoments();
    enableTrackScroll();
    enableReverseTrackScroll();
    handleOpenaiForm();
    handleMemo();

    enableSubRedit();

    onLargeScreen(handleSideBar)
    onSmallScreen(handleSideBar2)
    
    handleAccordions()
    handleBookEditing();
    handleScrollDownButton();
    handleCardClickable();
    handleDownloadButton();
    handleCOmpare();
    handleCOmparePDF();
    initNsfw();
    handleSwitchNSFW();
    handleGridRange();
    handleLoadMore();
    handleResetFormSubmission();
    handleIframe()

    handleRoop();
});

let triggerKeyDown = true;

$(document).off('keydown').on('keydown', function(e) {
    if(!triggerKeyDown) return;

    if (e.which == 32 && isFullScreen) { // Spacebar key (code 32) pressed
        e.preventDefault();
        triggerKeyDown = false;

        let currentVisible = null;

        // Find the currently visible element
        $('.custom-carousel-item').each(function() {
            if (checkIfElementIsInViewportCurrent($(this))) {
                currentVisible = $(this);
                return false; // Break the loop once we find the visible element
            }
        });

        if (!currentVisible) {
            // If no visible element is found, scroll to the first element
            currentVisible = $('.custom-carousel-item').first();
        }

        currentVisible.removeClass('active');

        let nextCard;
        if (e.shiftKey) {
            // Shift + Space pressed, scroll to the previous element
            nextCard = currentVisible.prev('.custom-carousel-item');
            if (nextCard.length === 0) {
                nextCard = $('.custom-carousel-item').last(); // Loop back to the last element if at the start
            }
        } else {
            // Space pressed, scroll to the next element
            nextCard = currentVisible.next('.custom-carousel-item');
            if (nextCard.length === 0) {
                nextCard = $('.custom-carousel-item').first(); // Loop back to the first element if at the end
            }
        }

        const currentItemId = nextCard.data('id')
        $(document).find(`.play-button[data-id="${currentItemId}"],.instant-play-button[data-id="${currentItemId}"]`).not('.play').click();
        nextCard.addClass('active');
        triggerKeyDown = true;
        
        $('.custom-carousel-container').animate({
            scrollTop: $('.custom-carousel-container').scrollTop() + nextCard.position().top
        }, 100, function() {
            LazyLoad();
        });
    }
});

function checkIfElementIsInViewportCurrent($element) {
    const elementTop = $element.offset().top;
    const elementBottom = elementTop + $element.outerHeight();
    const viewportTop = $(window).scrollTop();
    const viewportBottom = viewportTop + $(window).height();

    return elementBottom > viewportTop && elementTop < viewportBottom;
}


function scrollBottomWindow(){
    $('html, body').animate({ scrollTop: $(document).height() }, 'fast', function() {
        // After the animation is complete, disable scrolling
        $('body').css('overflow', 'hidden');
    });
}

const handleCardButton = () => {
    $(document).on('click','.info-button',function(){
        $(this).closest('.card-body').find('.card-title').toggle()
    })
}
// This function checks password fields if they exist
const validatePasswordFields = async formData => {
    // Extract password data from formData
    const oldPassword = formData.get("userOldPassword");
    const newPassword = formData.get("userPassword");
    const newPasswordVerification = formData.get("userPasswordVerification");

    if (oldPassword) {
        if (!await isOldPasswordCorrect(oldPassword)) {
            return '古いパスワードが正しくありません';
        }
    }

    if (newPassword && newPasswordVerification) {
        if (!areNewPasswordsSame(newPassword, newPasswordVerification)) {
            return '新しいパスワードとパスワードの確認が一致しません';
        }
    } else if (newPassword || newPasswordVerification) {
        // Only check if both fields are filled if one of them is filled
        return 'すべてのパスワードフィールドを入力してください';
    }

    return null; // Return null if there's no error
};

// This function handles form submission
const handleFormSubmission = async formData => {
    const passwordError = await validatePasswordFields(formData);

    if (passwordError) {
        handleFormResult(false, passwordError);
        return;
    }

    $.ajax({
        url: `/user/updateProfile`,
        type: 'POST',
        enctype: 'multipart/form-data',
        data: formData,
        processData: false, // Tell jQuery not to process data
        contentType: false, // Tell jQuery not to set contentType
        success: handleFormSuccess,
        error: handleFormError
    });
};



const isOldPasswordCorrect = async (oldPassword) => {
    let isCorrect = false;
  
    await $.ajax({
        url: `/user/isOldPasswordCorrect`,
        type: 'POST',
        data: { oldPassword: oldPassword },
        success: (response) => {
            isCorrect = response.isMatch;
        },
        error: (jqXHR, textStatus, errorThrown) => {
            console.log('Error in password validation: ', textStatus, errorThrown);
        }
    });
  
    return isCorrect;
};


const areNewPasswordsSame = (newPassword,newPasswordVerification) => {
    return newPassword === newPasswordVerification;
};

const handleFormSuccess = response => {
    if (response.status === 'success') {
        handleFormResult(true, response.message);
    } else {
        handleFormResult(false, response.message);
    }
}

const handleFormError = (jqXHR, textStatus, errorThrown) => {
    handleFormResult(false, '予期せぬエラーが発生しました。');
}

const handleFormResult = (isSuccess, message) => {
    isSuccess = !!(isSuccess == true || isSuccess == 'success');
    let iconType = isSuccess ? 'success' : 'error';
    
    Swal.fire({
        position: 'top-end',
        icon: iconType,
        title: message,
        showConfirmButton: false,
        timer: 3000,
        toast: true,
        animation: false,
        customClass: {
            popup: 'animate__animated animate__fadeInDown',
            container: 'animate__animated animate__fadeOutUp animate__delay-3s',
            title: 'swal2-custom-title',
            popup: 'swal2-custom-popup'
        }
    });
};


function HandleCardSetting() {
    $(document).find('.card.info-container').each(function() {
        const card = $(this);
        const settingToggle = card.find('.card-title'); // or .setting-container
        let hideTimer;

        // Show settings when hovered
        card.hover(
            function() {
                clearTimeout(hideTimer);
                settingToggle.show();
                hideTimer = setTimeout(() => settingToggle.hide(), 3000);
            }, 
            function() {
                settingToggle.hide()
            }
        );

        // Also stop the timer if we touch the card (for touch devices)
        card.on('touchstart', function() {
            clearTimeout(hideTimer);
            settingToggle.show();
            hideTimer = setTimeout(() => settingToggle.hide(), 3000);
        });

        // Start the initial timer when the card is first set up
        hideTimer = setTimeout(() => settingToggle.hide(), 3000);
    });
}

function displayCardSetting(settingId) {
    // Ensure the settingId is properly formatted or escaped if necessary
    // Especially if settingId can contain special characters

    const card = $(`.card.info-container[data-id="${settingId}"]`);
    const setting = card.find(`.card-title[data-id="${settingId}"]`);

    if (!setting.is(':visible')) {
        setting.show();
        setting.addClass('setting-absolute');
    } else {
        setting.hide();
        setting.removeClass('setting-absolute');
    }

    // Optional: Add error handling if card or setting is not found
}

function isLargeScreen() {
    return window.innerWidth > 1024; // Define large screen size threshold here
}
$(document).ready(function() {
    // Function to handle debouncing
    function debounce(func, wait, immediate) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    // Call LazyLoad once on page load
    setTimeout(() => {
        LazyLoad();
    }, 1000);

    // Debounced LazyLoad call on scroll and resize
    const debouncedLazyLoad = debounce(LazyLoad, 100); // Adjust debounce time as needed
    $(window).on('scroll resize', debouncedLazyLoad);
});

function controlVideoStatus(){
    $(document).on('play pause', 'video', function(event) {
      // We log the event type to see if it's playing or pausing
      console.log(`Video event: ${event.type}`);
  
      // Toggling the 'force-pause' class based on the event type
      if (event.type === 'play') {
        $(this).addClass('force-pause');
      } else if (event.type === 'pause') {
        $(this).removeClass('force-pause');
      }
    });
  }
  
function manageVideo(isVisible, $element) {
    const mode = parseInt($('.mode-container').data('mode'))    
    isLazyLoad(mode, function(isLazyLoadValue) {
            // Find the video element within the provided element
            const $video = $element.find('video');

            // Check if the video element exists
            if ($video.length) {
                // If the element is visible and the video is not already playing
                if (isVisible && $video.get(0).paused && isLazyLoadValue) {
                    $video.get(0).play();
                    addCardToList($element)
                } 
                // If the element is not visible and the video is playing
                else if (!isVisible && !$video.get(0).paused) {
                    $video.get(0).pause();
                }
            }
    })

}
function LazyLoad(){
    const mode = parseInt($('.mode-container').data('mode'));
    const maxLoadCount = 3;
    let loadCount = 0;

    $('.card.info-container').each(function(){
        if (loadCount >= maxLoadCount) {
            return false;
        }

        const isVisible = checkIfElementIsInViewport($(this));
        if(
            isVisible && !$(this).hasClass('lazyLoad') && $('#search').data('mode') != 1 && $('#search').data('mode') != 2
            || isVisible && !$(this).hasClass('lazyLoad') && isLargeScreen() && $('#search').data('mode') != 1 && $('#search').data('mode') != 2
            || isVisible && !$(this).hasClass('lazyLoad') && isFullScreen
        ){
            $(this).addClass('lazyLoad');
            const $this = $(this);
            isLazyLoad(mode, function(isLazyLoadValue) {
                if(isLazyLoadValue || isFullScreen){
                    downloadAndShow($this);
                }
            });

            loadCount++; // Increment the load count
        }

        manageVideo(isVisible, $(this));
    });
}

function isFavorite(){
    return !! document.querySelector('#fav')
}
function checkIfElementIsInViewport($element) {
    const elementTop = $element.offset().top;
    const elementHeight = $element.outerHeight();
    const elementBottom = elementTop + elementHeight;

    const viewportTop = $(window).scrollTop();
    const viewportBottom = viewportTop + $(window).height();

    const threshold = elementHeight * 0.50;
    const isAtLeast25PercentVisible =
        (elementBottom - threshold > viewportTop) && (elementTop + threshold < viewportBottom);

    return isAtLeast25PercentVisible;
}

function addCardToList(container,active = false) {
    const mode = parseInt($('.mode-container').data('mode'))
    if(mode == 6){
        return
    }
    const itemId = container.attr('data-id');
    if($('#imageList').find(`img[data-id="${itemId}"]`).length > 0 ){
        return
    }
    const thumbnail = container.find('.card-img-top').attr('src');
    const imgContainer = $('#imageList');
    const imgElement = document.createElement('img');
    imgElement.src = thumbnail; // Set the image source
    imgElement.setAttribute('data-id', itemId); // Add the data-id attribute to the image

    // Add a click event listener to the image
    $(imgElement).on('click', function() {
        // Scroll to the .info-container with the matching data-id
        $('.info-container[data-id="' + itemId + '"]').get(0).scrollIntoView({
            behavior: 'smooth' // Optional: for smooth scrolling
        });
    });

    imgContainer.prepend(imgElement); // Prepend the image to the container
    if(active){
        updateImageList(itemId)
    }

}
function updateImageList(itemId){
    $('#imageList').find(`img[data-id="${itemId}"]`).css({'border-color':'white'})
}
function downloadAndShow($thisCard){
    var id = $thisCard.data('id');
    var isdl = $thisCard.data('isdl');
    const playerButton = $thisCard.find(`.play-button`)
    const mode = parseInt($('.mode-container').data('mode'))  
    // Check if the card has already been processed
    if ($thisCard.hasClass('done')) {
        console.log('Card has already been processed.');
        return;
    }

    //Reset all the other cards
    $(`.card.info-container`).each(function(){
        playerButton.removeClass('done')
    })

    playerButton.hide()
    // Mark the card as done to avoid processing it again
    $thisCard.addClass('done');

    if($thisCard.find('.instant-play-button').length>0 || mode == 7){
        $thisCard.find('.instant-play-button').addClass('play')
        instantPlay(id)
        return
    }
    // Check if the spinner is already present, if not, create and append it to the card
    if (!$thisCard.find('.spinner-border .for-strm').length) {
        var $spinner = $('<div>').addClass('spinner-border for-strm position-absolute').css({inset:"0px", margin:"auto"}).attr('role', 'status');
        var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
        $spinner.append($span);
        $thisCard.find('.card-body-over').append($spinner);
    }

    // Show the spinner while the download is in progress
    $thisCard.find('.card-body-over').show();
    var $spinner = $thisCard.find('.spinner-border');
    $spinner.show();
    handleDownloadVideo(id)
}

    // Initialize button state
    initializeButtonState();

    // Click event to update database and button state
    $(document).on('click','#lazyLoadButton', function() {
        const mode = parseInt($(this).data('mode'));
        const isLazyLoadValue = $(this).hasClass('btn-primary') ? false : true; // Toggle state
        updateDatabaseWithLazyLoad(isLazyLoadValue, mode);
        updateButtonState(isLazyLoadValue);
    });

// Function to update database
function updateDatabaseWithLazyLoad(isLazyLoadValue, mode) {
    $.ajax({
        url: '/api/islazyload',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            islazyload: isLazyLoadValue,
            mode: mode
        }),
        success: function(response) {
            console.log('Database updated successfully:', response);
        },
        error: function(error) {
            console.error('Error updating database:', error);
        }
    });
}

// Function to update button state
function updateButtonState(isLazyLoadValue) {
    const button = $('#lazyLoadButton');
    if (isLazyLoadValue) {
        button.removeClass('btn-secondary').addClass('btn-primary');
    } else {
        button.removeClass('btn-primary').addClass('btn-secondary');
    }
}

// Function to initialize button state
function initializeButtonState() {
    const mode = parseInt($('#lazyLoadButton').data('mode'));
    $.ajax({
        url: '/api/islazyload',
        type: 'GET',
        data: { mode: mode },
        success: function(response) {
            const isLazyLoadValue = response.islazyload; 
            updateButtonState(isLazyLoadValue);
        },
        error: function(error) {
            console.error('Error fetching initial state:', error);
        }
    });
}
function isLazyLoad(mode, callback){
    $.ajax({
        url: '/api/islazyload',
        type: 'GET',
        data: { mode: mode },
        success: function(response) {
            if (typeof callback === 'function') {
                callback(response.islazyload);
            }
        },
        error: function(error) {
            console.error('Error:', error);
        }
    });
}

// Handling of card clicking
const handleCardClickable = () => {
    $(document).on('click',`.play-button`,function(event) {
        event.stopPropagation();
        $(this).addClass('play')
        const $thisCard = $(this).closest('.card.info-container')
        addCardToList($thisCard)
        downloadAndShow($thisCard)
    });
}
function handleDownloadVideo(id){
    const $thisCard = $(`.card.info-container[data-id="${id}"]`)
    const $spinner = $thisCard.find('.spinner-border');
    const $playButton = $thisCard.find('.play-button');
    const isdl = $thisCard.data('isdl');
    const mode = $('#range').data('mode');

    $.get(`http://192.168.10.115:3100/api/video?videoId=${id}&mode=${mode}`)
    .done(function(response) {
        console.log(response)
        try {
            updateImageList(id);

            if (response && response.url) {
                $spinner.hide();
                $thisCard.find('.card-body-over').addClass('hover-hide');
                displayMedia(response.url, id);
                $('#video-holder').html('').data('id', id);

                if (!isdl && response.url.includes('http')) {
                    var $downloadButton = $thisCard.find('.download-button');
                    $downloadButton.show();
                }
            } else {
                throw new Error('Video URL not available.');
            }
        } catch (error) {
            $spinner.hide();
            $playButton.removeClass('play')
            $playButton.show()
            $thisCard.find('.card-body-over').removeClass('hover-hide');
            $thisCard.removeClass('done')
        }
    })
    .fail(function(error) {
        $spinner.hide();
        $thisCard.find('.card-body-over').removeClass('hover-hide');
        $playButton.removeClass('play')
        $playButton.show()
        $thisCard.removeClass('done')
    });

  }
function displayMedia(url,id){

    $thisCard = $(`.card.info-container[data-id=${id}]`)

    if($thisCard.find('img.card-img-top').attr('src').includes('.gif') || url.includes('.jpg')){
        return
    }

    if(checkUrlandCardStatus($thisCard,url)){
        
        $thisCard.find('.card-body-over').addClass('hover-hide')
        var $video = $('<video>').attr({
            src: url,
            autoplay: true,
            width: "100%",
            controls: true,
            playsinline: true,
            loop: true
        })
        .prop('muted', true)
        .on('loadeddata', function() {
          updateMasonryLayout();
          $thisCard.find('.video-container').addClass('loaded');
        })
        .on('error',function(){
            console.log('Error loading the video')
            if(!$thisCard.hasClass('resetDownloadStatus')){
                $thisCard.addClass('resetDownloadStatus')
                resetDownloadStatus(id,function(){
                    handleDownloadVideo(id)
                })
            }else{
                handleFormResult(false,'The video could not be found.')
            }
        });
        if(!$thisCard.find('.video-container').hasClass('loaded')){
            $thisCard.find(`.video-container video`).remove()
            $thisCard.find(`.video-container`).append($video)
        }
        $thisCard.find(`img.card-img-top`).hide()
        $thisCard.find(`.play-button`).hide()
        return
    }
    
    $thisCard.find(`img.card-img-top`).attr('src',url)
    $thisCard.find(`.play-button`).hide()
}
function checkUrlandCardStatus($thisCard,url){
    return (url.includes('video') || url.includes('.mp4') || url.includes('.webm')) && !$thisCard.find('img.card-img-top').attr('src').includes('.gif')
}
function resetDownloadStatus(itemId,callback){
    $.post('/api/resetDownloadStatus',{itemId},function(){
        if(callback){
            callback()
        }
    })
}
// jQuery function to make a GET request to '/api/downloading'
function getDownloadData() {
    $('#download-list').toggle()
    $('#download-list').html('')
    if($('#download-list').is(':visible')){
    // Use jQuery's $.get method to make the GET request
    $.get("/api/downloading", function(response) {
        // Log the data returned from the server
        if(response.data.length == 0){
            $('#download-list').append(`<li class="list-group-item text-start"><span>Nothing in the download queue</span></i>`)
            return
        }
        for(item of response.data){
            $('#download-list').append(`<li class="list-group-item text-start"><div class="row"><div class="col-4" style="background-image: url('${item.imageUrl}');background-size: cover;"></div><div class="col-8">${item.alt}</div></div></i>`)
        }
      })
      .fail(function(error) {
        // Log any errors if the request fails
        console.log("Error: ", error);
      });
    }

  }
  
  // Call the function to make the request
  getDownloadData();
  
function displaySummary(response) {
    $('#summary .content').html('')
    if(response && response.data && response.data.summary && response.data.summary.length > 0){
        if($('#summary-content').length == 0){
            const initialCardHtml = `<div class="card mb-3" id="summary"><div class="card-body"></div></div>`;
            const initialCardHtmlMobile = `<div class="card mb-3" id="summary-content"><div class="card-body"></div></div>`;
            $('#summary .content').prepend(initialCardHtml);
            $('#mobile-toolbar').append(initialCardHtmlMobile);
        }
        $('#summary .card-body').append(response.data.summary)
        $('#mobile-toolbar #summary-content .card-body').append(response.data.summary)
    }
}

// Handling of download button clicking
const handleDownloadButton = () => {
  $(document).on('click', '.download-button', function(event) {
    event.preventDefault(); // Prevents the default click behavior

    var id = $(this).data('id') || $(this).closest('.info-container').data('id');
    var title = $(this).data('title') || $(this).closest('.info-container').data('title');

    var $buttonContainer = $(this);
      if ($buttonContainer.hasClass('done') ) {
        console.log('Card has already been processed.');
        return;
      }

      // Mark the card as done to avoid processing it again
      $buttonContainer.addClass('done');

      const DLicon = $buttonContainer.find('i').clone();
      $buttonContainer.html('');

      // Check if the spinner is already present, if not, create and append it to the card
      if (!$(this).find('.spinner-border.for-dl').length) {
          var $spinner = $('<div>').addClass('spinner-border for-dl spinner-border-sm text-white').attr('role', 'status');
          var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
          $spinner.append($span);
          $(this).prepend($spinner);
      }

      // Show the spinner while the download is in progress
      var $spinner = $(this).find('.spinner-border');
      $spinner.show();
      
      // Make a request to download the video
      const mode = $('#range').data('mode')
      $.post('http://192.168.10.115:3100/api/dl', { video_id: id ,title,mode}, function(response) {
        displayMedia(response.url,id)
        $spinner.remove();

        if(!$buttonContainer.find('i').length){
          $buttonContainer.append(DLicon)
        }  
        
      }).fail(function() {

        $spinner.remove();
        $buttonContainer.removeClass('done');
        console.error('Error occurred while downloading file.');
        if(!$buttonContainer.find('i').length){
          $buttonContainer.append(DLicon)
        }

        console.error('Error: Video download failed.');
        handleFormResult(false, 'Video Downloaded failed') 
        // Hide the spinner in case of an error
        $spinner.hide();
      });
  });
}
function handleFavorite() {
    $(document).on('dblclick','.card.info-container', function() {
        $(this).find('.handle-fav').click();
    });

    $(document).on('click', '.handle-fav', function() {
        const $buttonContainer = $(this);
        const itemID = $(this).data('id') || $(this).closest('.info-container').data('id');
        
        if ($buttonContainer.hasClass('fav')) {
            removeFromFav(itemID, function() {
                $(`.handle-fav[data-id=${itemID}]`).each(function() {
                    $(this).removeClass('fav');
                    handleFormResult(false, 'Media removed to favorite.');
                });
            });
        } else {
            addtofav(itemID, function() {
                $(`.handle-fav[data-id=${itemID}]`).each(function() {
                    $(this).addClass('fav');
                    handleFormResult(true, 'Media added to favorite.');
                });
            });
        }
    });

    $(document).on('keydown', function(e) {
        if (e.key === 'f' || e.key === 'F') {
            const currentActive = $('.custom-carousel-item.active');
            const itemID = currentActive.data('id');
            currentActive.find('.handle-fav').click();
        }
    });
}

function removeFromFav(video_id,callback){
    const mode = $('#range').data('mode')
    $.post('/api/removeFromFav',{video_id, mode},function(response){
        if(callback){callback()}
        //handleFormResult(response.status, response.message) 
    })
}
function addtofav(video_id,callback){
    const mode = $('#range').data('mode')
    $.post('/api/addtofav',{ video_id, mode },function(response){
        if(callback){callback()}
        //handleFormResult(response.status, response.message) 
    })
  }
const handleCOmparePDF = () => {
    $('form#comparePDF').on('submit', function(e) {
        e.preventDefault();

        let formData = new FormData(this);
        console.log(formData);

        const $this = $(this).find('button[type="submit"]');

        $this.find('i').hide(); // hide plane icon
        $this.append('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'); // add spinner

        // simulate request
        $.ajax({
            url: '/api/openai/pdf/compare', // replace with your endpoint
            method: 'POST',
            data: formData,
            processData: false, // Tell jQuery not to process data
            contentType: false, // Tell jQuery not to set contentType
            success: function(response) {

                console.log(response);
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon

                // Create a table
                let table = $('<table>').addClass('table table-striped');

                // Create table header
                let thead = $('<thead>').addClass('black white-text');
                let headerRow = $('<tr>');
                headerRow.append($('<th>').text('入力1'));
                headerRow.append($('<th>').text('入力2'));
                headerRow.append($('<th>').text('差分'));
                thead.append(headerRow);
                table.append(thead);

                // Create table body
                let tbody = $('<tbody>');

                for(let item of response.completion){
                    let row = $('<tr>');
                    row.append($('<td>').text(item.input1));
                    row.append($('<td>').text(item.input2));
                    row.append($('<td>').text(item.difference));
                    tbody.append(row);
                }

                table.append(tbody);

                // Append the table to the result div
                $('#result').empty().append(table);

            },
            error: function(error) {
                console.error(error);
                handleFormResult(false, '比較中にエラーが発生しました') 
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon
            },
            finally: function(error) {
                console.error(error);
                handleFormResult(false, '比較中にエラーが発生しました') 
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon
            }
        });
    });

}

function initNsfw(){
        getUserNSFW(function(userNSFW){
            if (userNSFW !== null) {
                $('#nsfw').prop('checked', userNSFW === 'true');
            }
            if ($('#nsfw').length > 0) {
                handleNSFWlabel(userNSFW === 'true')
                nsfwUpdateData({nsfw:userNSFW === 'true'})
            }
        })
}
const handleSwitchNSFW= () => {
       // Save the state of the switch to a local variable when it's toggled
       $('#nsfw').change(function() {
        $('input#searchterm').val('')
        const nsfw = $(this).is(':checked')
        handleNSFWlabel(nsfw === 'true' )
        nsfwUpdateData({nsfw},function(){
            //handleFormResult(true, response.message);
            location.href = location.origin + location.pathname;
        })
    });
}
function getUserNSFW(callback){
    $.get('/user/getNsfw',function(response){
        callback(response.nsfw)
    })
}
function nsfwUpdateData(nsfw,callback) {
    $.ajax({
        url: `/user/setNsfw`,
        type: 'POST',
        data: nsfw,
        success: (response) => {
           if(callback){ callback()}
        },
        error: handleFormError
    });
}

function handleNSFWlabel(nsfw){
    if(nsfw === true ){
        $('label[for="nsfw"]').addClass('btn-danger').removeClass('btn-dark')
    }else{
        $('label[for="nsfw"]').removeClass('btn-danger').addClass('btn-dark')
    }
    
}
const handleCOmpare = () => {
    $('#compare').on('submit', function(e) {
        e.preventDefault();

        const $this = $(this).find('button[type="submit"]');
        const $input1 = $('#input1').val();
        const $input2 = $('#input2').val();

        if (!input1 || !input2) {
            
            handleFormResult(false, '比較中にエラーが発生しました') 
            return;
        }


        $this.find('i').hide(); // hide plane icon
        $this.append('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'); // add spinner

        // simulate request
        $.ajax({
            url: '/api/openai/compare', // replace with your endpoint
            method: 'POST',
            data: { input1:$input1,input2:$input2,time:new Date() },
            success: function(response) {

                console.log(response);
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon

                // Create a table
                let table = $('<table>').addClass('table table-striped');

                // Create table header
                let thead = $('<thead>').addClass('black white-text');
                let headerRow = $('<tr>');
                headerRow.append($('<th>').text('Input 1'));
                headerRow.append($('<th>').text('Input 2'));
                headerRow.append($('<th>').text('Difference'));
                thead.append(headerRow);
                table.append(thead);

                // Create table body
                let tbody = $('<tbody>');

                for(let item of response.completion){
                    let row = $('<tr>');
                    row.append($('<td>').text(item.input1));
                    row.append($('<td>').text(item.input2));
                    row.append($('<td>').text(item.difference));
                    tbody.append(row);
                }

                table.append(tbody);

                // Append the table to the result div
                $('#result').empty().append(table);

            },
            error: function(error) {
                console.error(error);
                handleFormResult(false, '比較中にエラーが発生しました') 
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon
            },
            finally: function(error) {
                console.error(error);
                handleFormResult(false, '比較中にエラーが発生しました') 
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon
            }
        });
    });

}


// Function to enter fullscreen
const enterFullScreen = (videoElement) => {
    if (videoElement.requestFullscreen) {
      videoElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      console.log('Fullscreen API is not supported by this browser.');
    }
  };
  
  // Function to toggle video controls based on fullscreen state
  const toggleVideoControls = (videoElement, isFullscreen) => {
    if (isFullscreen) {
      $(videoElement).attr('controls', 'controls'); // Add controls
      $(videoElement).find('.expand').hide()
    } else {
      $(videoElement).removeAttr('controls'); // Remove controls
      $(videoElement).find('.expand').show()
    }
  };
  // Function to toggle video controls based on fullscreen state
  const toggleMenu = (cardElement, isFullscreen) => {
    if (isFullscreen) {
      $(cardElement).find('.expand').hide()
    } else {
      $(cardElement).find('.expand').show()
    }
  };
    
  // Main function to expand the video
  const handleExpand = (videoId) => {
    let videoElement = $(document).find(`.card[data-id=${videoId}]`).find('video').get(0);
  
    if(!$(videoElement).attr('controls')){
        toggleVideoControls(videoElement,true);
        toggleMenu($(`.card[data-id=${videoId}]`),true);
    }

  };
  
  
  const handleHiding = (videoId) => {
    
    const mode = $('#range').data('mode');
    let $container = $(`.card[data-id=${videoId}]`);
    $container.addClass('blurred');

    $.ajax({
        url: '/api/hide',
        method: 'POST',
        data: { element_id: videoId, category: null, mode },
        success: function(response) {
            $container.remove();
            //updateMasonryLayout();
            handleFormResult(true, 'Media hidden successfully.');
        },
        error: handleFormError
    });
};




const handleHidingHistory = (searchterm) => {
    if(!searchterm){
        console.log('Query must be defined')
        return
    }
    $.ajax({
        url: '/api/hideHistory',
        method: 'POST',
        data: { searchterm },
        success: function(response) {
            updateMasonryLayout()
            handleFormResult(true,response.message)
            // Handle the success response
            console.log(response);
            },
        error: handleFormError
    });
}
function updategridlayout(value = false,callback) {
    if(!value){value=$('#grid-range').val()}

    //Do not update the design if in full page
    if (sessionStorage.getItem('isexpand') === 'true') {
        return
    } 
    // Function implementation goes here
    // This function will be called when the range input is changed
    // You can update the grid layout or perform any other actions based on the 'value'
  
    // Remove any existing col- classes from grid items
    $('.grid-item').removeClass(function (index, className) {
      return (className.match(/(^|\s)col-\S+/g) || []).join(' ');
    });
  
    // Calculate the column width class based on the range value
    const colClass = `col-${12 / value}`;
  
    // Add the new col- class to each grid item
    $('.grid-item').addClass(colClass);
    setTimeout(() => {
        reinitializeMasonry();
        if(typeof callback == 'function'){callback()}
    }, 1000);
  }
  
  
  const handleGridRange = () => {
    if($('#range').data('mode')==1 && $(window).width() <= 768){
        $('#grid-range').val(1);
        updategridlayout(1)
        //$('#range').hide()
        //return
    }
    if($('#range').data('mode')== 1 && $(window).width() > 768){
        $('#grid-range').val(2);
        updategridlayout(2)
        //$('#range').hide()
        //return
    }
    // Check if the local variable exists
    var rangeState = localStorage.getItem('rangeState');
  
    // Initialize the range input based on the local variable
    if (rangeState !== null) {
      $('#grid-range').val(rangeState);
      updategridlayout(rangeState)
    }else{
        $('#grid-range').val(0);
    }
  
    // Save the state of the range input to local storage when it's toggled
    $('#grid-range').change(function() {
      const value = $(this).val();
      localStorage.setItem('rangeState', value);
      updategridlayout(value); // Call the function to update the grid layout with the new value
    });
  };
 
  let paginationNumber = 1
  const handleLoadMore = () => {
      if (paginationNumber === 1) {
          $('.load-more-previous').remove();
      }
  
      $('form#search').on('submit', function (e) {
          e.preventDefault();
  
          const formData = new FormData(this);
          const searchdata = $('form#search').data();
  
          let formDataObject = {};
          for (let [key, value] of formData.entries()) {
              formDataObject[key] = value;
          }
  
          const data = Object.assign({}, searchdata, formDataObject);
  
          const $buttonContainer = $('form#search').find('button[type="submit"]');
          const $spinner = showSpinner($buttonContainer, 'loadmore');
  
          if (!data.searchterm) { return; }
  
          sendSearchForm(data, function () {
              $spinner.hide();
              $buttonContainer.find('i').show();
          }, true);
      });
  
  
// Intersection Observer to detect when the .load-more button is in the viewport
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Trigger the click when the button is visible in the viewport
            $(entry.target).click();
        }
    });
}, {
    root: null, // Use the viewport as the root
    rootMargin: '100px',
    threshold: 0.1 // Trigger when 10% of the button is visible
});

// Attach observer to the .load-more button
const loadMoreButton = document.querySelector('.load-more');
if (loadMoreButton) {
    observer.observe(loadMoreButton);
}

// Existing load-more click functionality
$('.load-more').off().on('click', function () {

    const $buttonContainer = $(this);

    if ($buttonContainer.hasClass('process')) {
        return;
    }

    const data = $(this).data();
    data.page = paginationNumber; // Use the correct current page for the request

    const $spinner = showSpinner($buttonContainer, 'loadmore');

    $buttonContainer.addClass('process');

    sendSearchForm(data, function () {
        $spinner.hide();
        $buttonContainer.find('i').show();
        $buttonContainer.removeClass('process');

        updategridlayout(null, function () {
            $(document).find('.invisible').fadeIn().removeClass('invisible');
        });
        initializeExtractor();

        paginationNumber++;
        $('#page').val(paginationNumber);
        $('.load-more').attr('data-page', paginationNumber);
    });
});

  };
  
  function sendSearchForm(data,callback,isNew = false) {

    let url =`/dashboard/app/${data.mode}?page=${parseInt(data.page)}&searchterm=${data.searchterm}&nsfw=${data.nsfw}`
    if (data.fav) {
        url = `/dashboard/app/${data.mode}/fav?page=${parseInt(data.page)}&searchterm=${data.searchterm ? data.searchterm : ''}&nsfw=${data.nsfw ? data.nsfw : 'false'}`;
    }
    $.ajax({
        url: `/api/loadpage`,
        type: 'POST',
        data,
        success: function(response){
            if(isNew){
                window.location=url
                return
            }
            if($('#results').length > 0 ){
                const newResult = $(response);
                newResult.addClass('invisible');
                $('section#results').append(newResult);
            }else{
                window.location=url
            }
            if(callback){callback()}
        },
        error: function(){
            handleFormError()
            if(callback){callback()}
        },
        finally: function(){
            if(callback){callback()}
        }
        
    });
}
  const handleResetFormSubmission = () => {
    $('form#reset-form').on('submit', function(e) {
        e.preventDefault();
        const confirmation = confirm("Are you sure you want to reset? This action cannot be undone.");

        if (confirmation) {
            $.ajax({
                url: `/user/reset`,
                type: 'POST',
                data: {mode:$('#mode').val()},
                success: handleFormSuccess,
                error: handleFormError
            });
        }
    }); 
}
function handleResetServer() {
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, reset it!'
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: '/api/reboot-port',
                method: 'POST',
                success: function(response) {
                    Swal.fire(
                        'Reset!',
                        'Your server is being reset.',
                        'success'
                    );
                },
                error: function(xhr, status, error) {
                    Swal.fire(
                        'Error!',
                        'Failed to reset the server: ' + error,
                        'error'
                    );
                }
            });
        }
    });
}

function enableSubRedit(){
        // Listen for focus event on the input element with id "searchterm"
        $('#searchterm').on('focus', function() {
          // Check the value of the 'data-mode' attribute
          const dataMode = $(this).attr('data-mode');
          
          // Check if data-mode attribute is equal to "2"
          if(dataMode === '2' || dataMode === '9') {
            console.log('Input is focused and data-mode is 2.');
            searchSubreddits()
          }
        });
      
        // Listen for keyup event to capture when something is being typed
        $('#searchterm').on('keyup', function() {
          // Check the value of the 'data-mode' attribute
          const dataMode = $(this).attr('data-mode');
      
          // Check if data-mode attribute is equal to "2"
          if(dataMode === '2' || dataMode === '9') {
            console.log('Something is being typed and data-mode is 2.');
            searchSubreddits()
          }
        });
}
// Initialize the spinner and add it to #searchRes
$('#subRedditSearchRes').append(`
  <li id="loadingSpinner" class="list-group-item loading text-center p-3" style="display: none;">
    <div class="loader spinner-border">
      <span class="visually-hidden">Loading ...</span>
    </div>
  </li>
`);

let debounceTimeout; // To hold debounce timer

async function searchSubreddits() {
  const searchtermEl = $('#searchterm');
  const subRedditSearchResEl = $('#subRedditSearchRes');
  const loadingSpinnerEl = $('#loadingSpinner');

  clearTimeout(debounceTimeout); // Clear the existing timer if function is invoked again quickly

  debounceTimeout = setTimeout(async () => {
    // Checking if the element does not have a 'wait' class
    if (!searchtermEl.hasClass('wait')) {
      console.log('Search started.');
  
      // Adding 'wait' class to prevent multiple requests
      searchtermEl.addClass('wait');
  
      // Clearing previous results
      subRedditSearchResEl.empty();
  
      // Show loading spinner
      loadingSpinnerEl.show();
  
      // Getting the search term from the input
      const key = searchtermEl.val();
  
      // Forming the API URL
      const apiUrl = `/api/searchSubreddits?query=${key}`;
  
      if (!key || key.length <= 0) {
        console.log('Search term is empty or too short.');
  
        // Hide loading spinner
        loadingSpinnerEl.hide();
  
        // Remove wait class
        searchtermEl.removeClass('wait');
        return;
      }
  
      try {
        // Fetching data from the API
        const response = await $.get(apiUrl);
  
        // Hide loading spinner
        loadingSpinnerEl.hide();
  
        // Create content from API response
        const content = response.map(element => {
          const url = encodeURIComponent(`https://www.reddit.com${element['url']}new/.json?count=25&after=`);
          return `
            <li class="list-group-item btn text-start">
              <span data-title="${element['title']}" data-url="${url}" data-value="${element['url']}" onclick="searchFor(this)">
                ${element['title']}
              </span>
              <span class="bg-danger badge float-end r18 ${element.r18}">
                R18
              </span>
            </li>
          `;
        }).join('');
  
        // Append new content
        subRedditSearchResEl.append(content);
        console.log('Search completed.');
  
      } catch (error) {
        console.error('Error in API call:', error);
      } finally {
        // Remove the 'wait' class to allow new requests
        searchtermEl.removeClass('wait');
      }
    } else {
      console.log('Waiting for the previous request to complete.');
    }
  }, 300); // Wait for 300 ms before making the API request
}


function handleBookEditing(){
    $('#edit-book textarea').on('input', function() {
        $(this).css('height', 'auto');
        $(this).css('height', $(this).prop('scrollHeight') + 'px');
    });
    $('#edit-book textarea').each(function() {
        $(this).css('height', 'auto');
        $(this).css('height', $(this).prop('scrollHeight') + 'px');
    });
    $(document).on('change','#edit-book input, #edit-book  textarea',function(){
        const bookID = $('#edit-book').attr('data-id')
        const keyPath = $(this).attr('data-key');
        const newValue = $(this).val();
    
        handleBook({bookID, keyPath, newValue},'edit-book') 
    });
    let lastFocusedInput = null;  // This will store the last focused input or textarea

    $('#edit-book input, #edit-book textarea').on('focus', function() {
        lastFocusedInput = this;  // Save the focused input or textarea
    });
    
    $('#regen').on('click', function() {
        if (lastFocusedInput) {
            $('#regen i').addClass('rotate')
            const bookID = $('#edit-book').attr('data-id');
            const keyPath = $(lastFocusedInput).attr('data-key');
            const newValue = $(lastFocusedInput).val();
            handleBook({bookID, keyPath, newValue},'regen-ebook',function(response){
                console.log(response.data)
                $('#regen i').removeClass('rotate')
                // Assuming response.data contains the new value you want to insert
                $(lastFocusedInput).val(response.data);
            })
            console.log({bookID, keyPath, newValue});
        } else {
            console.log('No input or textarea has been selected.');
        }
    });
    
    
}

  async function handleBook(data,apiKey,callback) {

    $.ajax({
        type: "POST",
        url: "/api/openai/"+apiKey,  // Your API endpoint for updating book info
        data: JSON.stringify(data),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function(response) {
            // Handle success - maybe a notification to the user
            handleFormResult(true, 'Ebook updated')
            if(callback){
                callback(response)
            }
        },
        error: function(err) {
            // Handle error - notify the user that the update failed
        }
    });
}

  function searchFor(el){
    let url = $(el).data('url')
    let value = $(el).data('value')
    $('#searchterm').val(value)
    $('form#search').submit()
  }
  function getCurrentPageQueries() {
  // Get the URL parameters
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  // Create an empty object to store the queries
  const queries = {};

  // Loop through each query parameter and add it to the object
  for (const [key, value] of urlParams) {
    queries[key] = value;
  }

  // Return the queries object
  return queries;
}

function scrollToTop() {
    $('html, body').animate({
        scrollTop: 0
    }, 800); // 800 is the duration in milliseconds. You can adjust this value as needed.
}

// Function to handle the appearance of the sidebar menu based on the isSidebarMenuVisible value
function adjustSidebarAppearance(isVisible) {
    if (isVisible) {
        $('#sidebarMenu').find('.hide-text').hide()
        $('#sidebarMenu').find('.collapse').removeClass('fast').end()
        //iconAnimation();
        $('#sidebarMenu').animate({ width: '60px' }, 100, function() {
            //$('#sidebarMenu').find('.list-group-item').addClass('text-center');
            $('#sidebarMenu').css("animation", "");
            $('#sidebarMenu').removeClass('open')
            $('#sidebarMenu').hide()
        });
    } else {
        $('#sidebarMenu').show()
        $('#sidebarMenu').find('.list-group-item').removeClass('text-center').end()
        $('#sidebarMenu').animate({ width: '250px' }, 100, function() {
            $('#sidebarMenu').find('.hide-text').show();
            //iconAnimation();
            $('#sidebarMenu').addClass('open')
        });
    }

}

// Function to handle toggle click event
function toggleSidebarMenu() {
    adjustSidebarAppearance($('#sidebarMenu').hasClass('open'));
}

function handleSideBar() {
    var isSidebarMenuVisible = JSON.parse(localStorage.getItem('isSidebarMenuVisible') || 'false');

    //$('#sidebarMenuToggle').on('click', toggleSidebarMenu);
    $('#sidebarMenuToggleSmall').on('click', toggleSidebarMenu);
    $('#sidebarMenu').find('li.list-group-item').not('.toggler').on('click', function() {
        if($(this).find('ul').length){
            adjustSidebarAppearance(false);
        }    
        var nextElem = $(this).html();
        // Check if the next element is a link (a tag)
        if(nextElem.includes('<a')) {
            var linkHref = $(this).find('a').attr('href');

            // Redirect to the href of the link
            window.location.href = linkHref;
        }
    });
    //adjustSidebarAppearance(true);
    //iconAnimation();
    $('#sidebarMenu').hide();
    $('main#dashboard').show();
}

function adjustSidebarAppearance2(){

    if ($('#sidebarMenu').is(':visible')) {
        enableTrackScroll()
        $('#sidebarMenu').find('.collapse').removeClass('show').end()
        $('#sidebarMenu').animate({ 'max-height': '0' }, 500, function() {
            $('#sidebarMenu').find('.list-group-item').addClass('text-center');
            $('#sidebarMenu').fadeOut()
        });
    } else {
        disableTrackScroll()
        $('#sidebarMenu').fadeIn()
        $('#sidebarMenu').find('.list-group-item').removeClass('text-center').end()
        $('#sidebarMenu').find('.hide-text').show();
        $('#sidebarMenu').animate({ 'max-height': '50vh' }, 500, function() {
        });
    }
}
function handleSideBar2(){
    $('#sidebarMenu').hide()
    $('#sidebarMenu').css({ 'max-height': '0' ,width:"100%"})
    $('main#dashboard').show();
    $('#sidebarMenuToggleSmall').on('click', adjustSidebarAppearance2);
}
function handleMemo(){
$('button#memo').on('click', function() {
    let memo = $('[name="memo"]').val();
    if(memo.length == 0){
        alert('保存する前にメモを書いてください。')
        return
    }
    // Make the AJAX request
    $.ajax({
        url: '/api/user/memo',
        type: 'POST',
        data: {
            content: memo
        },
        success: function(response) {
            console.log('Memo saved successfully');
            location.reload()
            // Additional code to handle the response
        },
        error: function(error) {
            console.log('Error saving memo:', error);
            // Additional code to handle the error
        }
    });
});
// Listen for click events on buttons with the class .remove-memo
$(document).on('click','.remove-memo',  function(e) {
    e.preventDefault()
    const confirmation = confirm("削除してもよろしいでしょうか？");

    if (!confirmation) {
        return
    }
    // Extract the memo ID from the data-id attribute of the clicked button
    const $cardContainer = $(this).closest('.card')
    let memoId = $cardContainer.data('id');

    // Make the AJAX DELETE request
    $.ajax({
        url: '/api/user/memo/' + memoId, // Construct the URL with the memo ID
        type: 'DELETE',
        success: function(response) {
            console.log('Memo removed successfully');
            $cardContainer .remove()
            // Additional code to handle the response, e.g., remove the memo from the UI
        },
        error: function(error) {
            console.log('Error removing memo:', error);
            // Additional code to handle the error
        }
    });
});

}

function handleStream(response,callback,endCallback) {
    console.log(`Start streaming on : ${response.redirect}`);

    // Establish an EventSource connection for live streaming
    const source = new EventSource(response.redirect);

    source.onopen = function(event) {
        //console.log("EventSource connection opened:", event);
    };

    source.onmessage = function(event) {
        //console.log("Raw data received:", event.data);
        
        try {
            // Assuming data contains a 'message' field. Modify as needed.
            const message = JSON.parse(event.data).content;    
            // Update the content of the card with the insertedId
            callback(message)

        } catch (e) {
            console.error("Error parsing received data:", e);
        }
    };

    source.addEventListener('end', function(event) {

        const data = JSON.parse(event.data);

        if (endCallback) endCallback(data);

        handleCopyButtons();

        console.log("Stream has ended:", {data});

        source.close();

    });

    source.onerror = function(error) {
        console.error("EventSource failed:", error);
        if (endCallback) endCallback(data);
        source.close();
    };

    return source;
}

function stopStreams(sources) {
    if (sources instanceof EventSource) {
        // It's a single stream.
        sources.close();
        console.log("Single stream has been stopped.");
    } else if (typeof sources === 'object' && sources !== null) {
        // It's an object containing multiple streams.
        for (let key in sources) {
            if (sources[key] instanceof EventSource) {
                sources[key].close();
                console.log(`Stream ${key} has been stopped.`);
            }
        }
    } else {
        console.error("Invalid input provided to stopStreams.");
    }
}


function handleWebSocket(insertedId){
    const ws = new WebSocket('ws://localhost:3000');
    const index = $('#result').find('.card').length
    // Create an initial card with the insertedId as an identifier
    const initialCardHtml = '<div class="card mb-3" id="card-' + insertedId + index +'"><div class="card-body"></div></div>';
    $('#result').prepend(initialCardHtml);
    console.log(`Initial card created with id: card-${insertedId}`);

    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'openai_stream', id: insertedId }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.content) {
            const message = data.content
            // Update the content of the card with the insertedId
            $('#card-' + insertedId + index +' .card-body').append(message);
            console.log(`Updated card-${insertedId} with new message.`);
        } else if (data.error) {
            console.error(data.error);
        }
    };

    ws.onerror = (error) => {
        console.error(`WebSocket Error: ${error}`);
    };

    ws.onclose = (event) => {
        if (event.wasClean) {
            console.log(`Closed cleanly, code=${event.code}, reason=${event.reason}`);
        } else {
            console.error('Connection died');
        }
    };

}
function handleOpenaiForm(){

    handleCounterAndAddForm()
    // Check and set the initial state on page load
    handleCheckboxState();
    
    // On checkbox state change
    $('#aiCheckbox').change(handleCheckboxState);
    
    let initialFormData = new FormData($('form#ebook')[0]);
    
    $('form#summarizePDF').submit(function(e){

        e.preventDefault();

        let formData = new FormData(this);

        if (!checkFormChange(initialFormData, formData)) {
            alert('フォームに変更はありません。');
            return
        }
        
        const $buttonContainer = $(this).find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'summarizePDF')
        
        // simulate request
        $.ajax({
            url: '/api/openai/custom/summarizePDF', // replace with your endpoint
            method: 'POST',
            data: formData,
            processData: false, // Tell jQuery not to process data
            contentType: false, // Tell jQuery not to set contentType
            success: function(response) {
                if (response.insertedId) {
                    handleStream(response, function(message) {
                        const containerID = `card-${response.insertedId}`;
                        if($('#'+containerID).length == 0) {   
                            // Create an initial card with the insertedId as an identifier
                            const initialCardHtml = `<div class="card mb-3" id="${containerID}"><div class="card-body"></div></div>`;
                            $('#result').prepend(initialCardHtml);
                            console.log(`Initial card created with id: card-${containerID}`);
                        }   
                        $(`#${containerID} .card-body`).append(message);
                    });
                    
                } else {
                    const agent_message = response.completion;
                    console.log({ agent_message });

                    var cardsHtml = agent_message.map(function(message) {
                        return '<div class="card mb-3"><div class="card-body">' + message + '</div></div>';
                    }).join('');

                    $('#result').prepend(cardsHtml);
                }

                $spinner.hide();
                $buttonContainer.find('i').show();
            },
            error: function(error) {
                console.error(error);
                $spinner.hide();
                $buttonContainer.find('i').show();
            }
        });


    })
    $('form#snsContent').submit(function(e){

        e.preventDefault();

        let formData = new FormData(this);
        console.log(formData)

        if (!checkFormChange(initialFormData, formData)) {
            alert('フォームに変更はありません。');
            return
        }
        
        const snsChoice = $('#snsChoice').val()
        const language = $('#language').val()
        const message = $('#message').val() || ''
        const keywordsArray = formDataArray('keyword') ;
        const postCount = $('#postCount').val()
        const data = {snsChoice,language,message,keywordsArray,postCount}
        if(keywordsArray.length==0  || !message){
            alert('申し訳ありませんが、フォームを送信する前に全ての必須項目をご記入ください。')
            return
        }
        const $buttonContainer = $(this).find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'sns')


        // Constructing the GPT-3 prompt using the collected data
        const gpt3Prompt = `
        I am looking to craft an engaging post for ${snsChoice}. \nThe primary language of my audience is ${language}. Write the post in ${language}.\n${message!=''?`The core message I want to convey is: "${message}"`:''}. \n${keywordsArray.length>0?`To give you more context, here are some keywords related to my post: ${keywordsArray.join(', ')}. `:''}\n\nAnd, I'd like to possibly integrate hashtags.\n\nRespond with the post only, no coments,no translation if not asked !
        `;
        generateStream('sns',gpt3Prompt,data,function(response){
            for(let i = 1; i <= postCount; i++) {
                (function(index) {handleStream(response, function(message) {
                    const containerID = `card-${response.insertedId}-${index}`;
                    const item = message; // Replace with the appropriate value for "item"
                    const doc = response; // Replace with the appropriate value for "doc"
                  
                    if($('#' + containerID).length == 0) {
                      const initialCardHtml = `
                        <div class="card mb-3" id="${containerID}" data-id="${doc._id}">
                          <div class="card-top p-3 d-flex align-items-center justify-content-between">
                            <div class="tools d-flex align-items-center">
                              <a class="btn tool-button share mx-2" onclick="handleShareButton(this)" data-toggle="tooltip" title="Twitterでシェア">
                                <i class="fas fa-share-alt"></i>
                              </a>
                              <badge class="btn tool-button tool-button-copy mx-2" data-toggle="tooltip" title="コピー">
                                <i class="fas fa-copy"></i>
                              </badge>
                            </div>
                            <div class="text-end text-sm text-muted" style="font-size:12px">
                              <div class="custom-date" data-value="${new Date()}"></div>
                            </div>
                          </div>
                          <div class="card-body py-0">
                            <p>${item}</p>
                          </div>
                        </div>`;
                        
                      $('#result').prepend(initialCardHtml);
                      updateMoments();
                      console.log(`Initial card created with id: card-${containerID}`);
                    }
                  
                    $(`#${containerID} .card-body p`).append(message);
                  },function(data){
                  });
                  
                })(i);
            }

            $spinner.hide();
            $buttonContainer.find('i').show();

        },function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })

    })
    $('form#blogPost').submit(function(e){

        e.preventDefault();

        let formData = new FormData(this);
        console.log(formData)

        if (!checkFormChange(initialFormData, formData)) {
            alert('フォームに変更はありません。');
            return
        }
        
        const language = $('#language').val()
        const title = $('#title').val()
        const subtitle = $('#subtitle').val()
        const keywordsArray = formDataArray('keyword') ;
        const data = {language, title,subtitle,keywordsArray}
        if(keywordsArray.length==0  || !title || !subtitle){
            alert('申し訳ありませんが、フォームを送信する前に全ての必須項目をご記入ください。')
            return
        }
        const $buttonContainer = $(this).find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'article')


        // Constructing the GPT-3 prompt using the collected data
        const gpt3Prompt = `
        Write a chapter for the following blog post :
        Language:  ${language}. 
        Title: "${title}"
        Subtitle: "${subtitle}"
        Relevant keywords: ${keywordsArray.join(', ')}
        Note: Respond using markdown and provide the post content only—no comments, no translations unless explicitly requested.
        `;        
        generateStream('article',gpt3Prompt,data,function(response){
            handleStream(response, function(message) {
                const containerID = `card-${response.insertedId}`;
                if($('#'+containerID).length == 0) {   
                    // Create an initial card with the insertedId as an identifier
                    const initialCardHtml = `<div class="card mb-3"><div id="${containerID}" class="card-body"></div></div>`;
                    const initialCardHtmlOutput = `<div class="card mb-3"><div id="${containerID}-output" class="card-body"></div></div>`;
                    $('#result').prepend(initialCardHtml);
                    $('#htmlOutput').prepend(initialCardHtmlOutput);
                    console.log(`Initial card created with id: card-${containerID}`);
                }   
                watchAndConvertMarkdown(`#${containerID}`, `#${containerID}-output`); 
                $(`#${containerID}`).append(message);
            });

            $spinner.hide();
            $buttonContainer.find('i').show();

        },function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })

    })
    // On form submission
    $('form#ebook').submit(function(e) {
        e.preventDefault();

        let formData = new FormData(this);

        if (!checkFormChange(initialFormData, formData)) {
            alert('フォームに変更はありません。');
            return
        }

        const $buttonContainer = $(this).find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'ebook')

        const keywordsArray = formDataArray('keyword') ;

        const chaptersArray = formDataArray('chapters') ;

        const topic = $('#topic').val()
        const language = $('#language').val()
        const aiCheckbox = $('#aiCheckbox').prop('checked')
        const data = { topic, language, keywords:keywordsArray,  userChapters:chaptersArray, aiCheckbox }
        if(keywordsArray.length==0 || (chaptersArray.length==0 && !aiCheckbox) || !language || !topic){
            alert('申し訳ありませんが、フォームを送信する前に全ての必須項目をご記入ください。')
            return
        }
        const gpt3Prompt = `
        write the details for a book about "${topic}". 
        The book content and details must be in ${language}.
        The main keywords are : ${data.keywords.join(', ')}.
        ${aiCheckbox=='true'?'':`Use those chapters for the book : ${data.userChapters.join('\n - ')}`}
        Respond without comment, only using this JSON template : 
        {
            "book": {
                "language": "${language}",
                "title": "{{book_title}:{book_sub_title}}",
            },
            "tone": "{{book_tone}}",
            "chapters": [
                {
                    "title": "{{chapter_1_title}}",
                    "sub_chapters": [
                        {
                            "title": "{{sub_chapter_1_1}}"
                        },
                        {
                            "title": "{{sub_chapter_1_2}}"
                        }
                    ]
                },
                {
                    "title": "{{chapter_2_title}}",
                    "sub_chapters": [
                        {
                            "title": "{{sub_chapter_2_1}}"
                        },
                        {
                            "title": "{{sub_chapter_2_2}}"
                        }
                    ]
                }
            ]
        }    
        `; 
        generateStream('ebook',gpt3Prompt,data,function(response){
            const id = []
            handleStream(response, function(message) {
                const containerID = `card-${response.insertedId}`;
                if($('#'+containerID).length == 0) {   
                    id.push(containerID)
                    // Create an initial card with the insertedId as an identifier
                    const initialCardHtml = `<div class="card mb-3" id="${containerID}"><div class="card-body"></div></div>`;
                    $('#result').prepend(initialCardHtml);
                    console.log(`Initial card created with id: card-${containerID}`);
                }   
                $(`#${containerID} .card-body`).append(message);
            }, function(endMessage){
                console.log("End of stream:", endMessage);
                let bookDetails = $(`#${id[0]} .card-body`).text().trim();

                try {
                    bookDetails = JSON.parse(bookDetails);
                } catch (error) {
                    console.log(bookDetails)
                    console.log('Error parsing the returned JSON:', error);
                    return false;
                }
                
                bookDetails.topic = topic;
                bookDetails.book_content = [];
                bookDetails.date = new Date()

                console.log(bookDetails)
                $spinner.hide();
                $buttonContainer.find('i').show();
    
            });

 
        },function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })

    });
}
function formDataArray(type) {
    const resultArray = [];
    // Gather all the keywords from the input fields
    $(`[name="${type}[]"]`).each(function() {
        const data = $(this).val().trim();
        if (data) {
            resultArray.push(data);
        }
    });
    return resultArray
}
function handleCheckboxState() {
    var isChecked = $('#aiCheckbox').prop('checked');
    
    $('.chapters-inputs input').prop('disabled', isChecked);

    if (isChecked) {
        $('.add-chapters').hide();
    } else {
        $('.add-chapters').show();
    }
}

function handleCounterAndAddForm(){
    // Create an empty object to store the counters for each item type
let counters = {};

// Use a more generalized class for the event listener
$(document).on('click','.add-item', function() {
    // Get the type and label from data attributes
    const type = $(this).data('name');
    const label = $(this).data('label');

    // Check if counter for this type exists, if not initialize it
    if(!counters[type]) counters[type] = 1;

    if(counters[type] >= 5) {
        alert(`${label}の最大数に達しました。`);
        return;
    }

    let itemVal = $(`#${type}-${counters[type]}`).val();

    if(itemVal.length == 0){
        alert(`${label}を書いてください。`);
        return;
    }

    counters[type]++; // increment the counter

    const newInput = $(`
        <div class="col p-1">
            <input type="text" class="form-control" name="${type}[]" id="${type}-${counters[type]}" placeholder='20代' >
        </div>
    `);

    // Use a more generalized class for the container
    $(`.${type}-inputs`).append(newInput);
});

}

function onLargeScreen(callback){

    if (typeof callback !== 'function') {
        console.error("Provided argument is not a function.");
        return;
    }

    window.addEventListener('resize', function() {
        if (window.innerWidth >= YOUR_LARGE_SCREEN_BREAKPOINT) {
            //callback();
        }
    });
    
    // Initial check
    if (window.innerWidth >= YOUR_LARGE_SCREEN_BREAKPOINT) {
        callback();
    }
    
}
function onSmallScreen(callback){

    if (typeof callback !== 'function') {
        console.error("Provided argument is not a function.");
        return;
    }
    
    window.addEventListener('resize', function() {
        if (window.innerWidth < YOUR_LARGE_SCREEN_BREAKPOINT) {
            //callback();
        }
    });
    
    // Initial check
    if (window.innerWidth < YOUR_LARGE_SCREEN_BREAKPOINT) {
        callback();
    }
    
}
let lastScrollTop = 0;

function enableTrackScroll() {
    const threshold = 100;

    $(window).on("scroll.trackScroll", function() {
        let currentScrollTop = $(this).scrollTop();
        let scrollDifference = Math.abs(currentScrollTop - lastScrollTop);
        let atTopOfPage = currentScrollTop === 0;
        let atBottomOfPage = currentScrollTop + $(window).height() >= $(document).height();

        if (atTopOfPage || atBottomOfPage || scrollDifference >= threshold) {
            if (currentScrollTop > lastScrollTop && !atTopOfPage && !atBottomOfPage) { // Scrolling down
                $(".auto-hide").fadeOut();
            } else { // Scrolling up or at top/bottom of page
                $(".auto-hide").fadeIn();
            }
            lastScrollTop = currentScrollTop;
        }
    });
}
let lastScrollTop2 = 0; 

function enableReverseTrackScroll() {
    const threshold = 100; // Define the scroll threshold

    $(window).on("scroll.reverseTrackScroll", function() {
        let currentScrollTop = $(this).scrollTop();
        let scrollDifference = Math.abs(currentScrollTop - lastScrollTop2);
        let atTopOfPage = currentScrollTop === 0;
        let atBottomOfPage = currentScrollTop + $(window).height() >= $(document).height();

        if (atTopOfPage || atBottomOfPage || scrollDifference >= threshold) {
            if (!atTopOfPage ) { // Scrolling down
                $(".auto-show").fadeIn().addClass('d-flex'); // Show elements when scrolling down
            } else { // Scrolling up or at top/bottom of page
                $(".auto-show").hide().removeClass('d-flex'); // Hide elements when scrolling up
            }
            lastScrollTop2 = currentScrollTop; // Update the last scroll position
        }
    });
}

function disableTrackScroll() {
    $(window).off("scroll.trackScroll");
}


function iconAnimation(){
    var icon = $("#sidebarMenuToggle i");

    if(!icon.hasClass('init')){
        icon.addClass('init')
        return
    }
    // Toggle the class
    icon.toggleClass("rotate-180");

    // Check if the class is not present
    if (!icon.hasClass("rotate-180")) {
    icon.css("animation", "rotate0 1s forwards");

    } else {
    icon.css("animation", "rotate180 1s forwards");

    }
      
}
function showSpinner($buttonContainer,type) {
    $buttonContainer.find('i').hide();

    if (!$buttonContainer.find('.spinner-border.for-'+type).length) {
        var $spinner = $('<div>').addClass(`spinner-border for-${type} spinner-border-sm mx-2`).attr('role', 'status');
        var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
        $spinner.append($span);
        $buttonContainer.prepend($spinner);
    }

    // Show the spinner while the download is in progress
    var $spinner = $buttonContainer.find('.spinner-border');
    $spinner.show();

    return $spinner
}




function convertMarkdownToHTML(markdownContent) {
    return converter.makeHtml(markdownContent);
}
function ConvertMarkdown(sourceSelector, outputSelector){
    let markdownContent = $(sourceSelector).text();
    let htmlContent = convertMarkdownToHTML(markdownContent);
    $(outputSelector).html(htmlContent);
}
function watchAndConvertMarkdown(sourceSelector, outputSelector) {
    
    // Initialize MutationObserver to watch for changes in the source selector
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === "childList") {
                let markdownContent = $(sourceSelector).text();
                let htmlContent = convertMarkdownToHTML(markdownContent);
                $(outputSelector).html(htmlContent);
            }
        });
    });

    // Configuration of the observer
    const config = {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
    };

    // Start observing the target node for configured mutations
    observer.observe(document.querySelector(sourceSelector), config);
}
function generateStream(type,gpt3Prompt,data,callback,errorcallback){
    // simulate request
    $.ajax({
        url: '/api/openai/custom/'+type, // replace with your endpoint
        method: 'POST',
        data: { prompt: gpt3Prompt, time: new Date(), data },
        success: function(response) {
            callback(response)
        },
        error: function(error) {
            console.error(error);
            errorcallback()
        }
    }); 
}
       

function updateMoments(){
    $('.custom-date').each(function(){
        const dateValue = $(this).data('value');
        const date = new Date(dateValue);
        const now = new Date();
        const diffInSeconds = (now - date) / 1000;
        let displayText;

        if (diffInSeconds < 60) {
            displayText = Math.round(diffInSeconds) + ' 秒前';
        } else if (diffInSeconds < 3600) {
            displayText = Math.round(diffInSeconds / 60) + ' 分前';
        } else if (diffInSeconds < 86400) {
            displayText = Math.round(diffInSeconds / 3600) + ' 時間前';
        } else {
            displayText = Math.round(diffInSeconds / 86400) + ' 日前';
        }
        
    
        $(this).text(displayText);
    });
    
}
      
function handleCopyButtons() {
    $(document).on('click', '.tool-button-copy', function() {
      let content = $(this).closest('.card').find(".card-body p").text().trim();
      let tempTextArea = $("<textarea></textarea>");
      $("body").append(tempTextArea);
      tempTextArea.val(content);
      tempTextArea.select();
      document.execCommand("copy");
      tempTextArea.remove();
  
      // Update the tooltip title to "コピーしました" and show it
      $(this).attr('title', 'コピーしました').tooltip('_fixTitle').tooltip('show');
  
      // After 2 seconds, revert the tooltip title to "コピー"
      setTimeout(() => {
        $(this).attr('title', 'コピー').tooltip('_fixTitle');
      }, 2000);
    });
}

function handleShareButton(e) {
    const tweetText = $(e).closest('.card').find(`.card-body p`).text();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url`)
}
function handleAccordions(){
        $('.accordion-item').on('show.bs.collapse', function () {
          // Get the id of the accordion that is about to be shown
          const currentAccordionId = $(this).find('.accordion-collapse').attr('id');
      
          // Loop through all accordion items
          $('.accordion-item').each(function () {
            // Get the id of the current accordion item in the loop
            const accordionId = $(this).find('.accordion-collapse').attr('id');
      
            // If the current accordion item in the loop is not the one that's about to be shown, hide it
            if (accordionId !== currentAccordionId) {
              $('#' + accordionId).collapse('hide');
            }
          });
        });
      
}
function cancelSubscription(subscriptionID){

    const confirmation = confirm("メンバーシップを削除してもよろしいですか？");

    if (confirmation) {
        $.ajax({
            url: `/payment/subscription/cancel/`+subscriptionID,
            type: 'POST',
            success: handleFormSuccess,
            error: handleFormError
        });
    }
    
}

function handleIframe(){
    $(document).on('click','.iframe-button',function(event){
        event.stopPropagation();
        
        var targetURL = $(this).data('url')
        const itemID = $(this).data('id')
        const $thisCard = $(this).closest(`.card.info-container[data-id=${itemID}]`)
        const $spinner = generateSpinnerCard($thisCard)
        if(!$(this).hasClass('fav')){
            $(this).hide()
        }else{
            $(this).find('i').addClass('text-danger')
        }
        $spinner.show()
    // Show the spinner while the download is in progress
      $thisCard.find('.card-body-over').show();

    downloadFileFromURL(targetURL,itemID,function(response) {
        displayMedia(response.url,itemID)
        $spinner.hide()
    })

    })
}
function downloadFileFromURL(targetURL,itemID,callback){
    const mode = $('#range').data('mode')
    $.ajax({
        type: "POST",
        url: "/api/downloadFileFromURL",
        data: { url: targetURL, itemID, mode },
        success: function(response) {
            if(callback){ callback(response) }
        },
        error: function(error) {
            console.error("Error:", error);
        }
    });
}
function generateSpinnerCard($thisCard){
    // Check if the spinner is already present, if not, create and append it to the card
    if (!$thisCard.find('.spinner-border').length) {
        var $spinner = $('<div>').addClass('spinner-border for-strm position-absolute').css({inset:"0px", margin:"auto"}).attr('role', 'status');
        var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
        $spinner.append($span);
        $thisCard.find('.card-body-over').append($spinner);
    }
    return $thisCard.find('.spinner-border')
}

function initializeExtractor() {
    const extractors = listExtractors();
    showExtractors(extractors);
    attachExtractorSortEvent();
}

function attachExtractorSortEvent() {
    $(document).on('click', '#extractors .extractor', function() {
        if($(this).hasClass('done')){return}
        $(this).addClass('done')
        const baseExtractor = $(this).attr('data-extractor');
        filterByExtractor(baseExtractor);
    });
}

function filterByExtractor(baseExtractor) {
    const carouselContainer = $('.custom-carousel-container');
    const carouselItems = carouselContainer.find('.grid-item');
    
    carouselItems.hide();
    carouselItems.each(function() {
        const extractor = $(this).data('extractor');
        if (extractor === baseExtractor || baseExtractor == false) {
            $(this).show();
            // Move the element to the beginning of .custom-carousel-container
            $(this).prependTo(carouselContainer);
        }
    });

    // Update Masonry layout after changes
    updateMasonryLayout();
    
}


function showExtractors(extractors) {
    const extractorContainer = $('#extractors');
    extractorContainer.empty()
    extractors.forEach(extractor => {
        extractorContainer.append(`<button class="btn btn-primary extractor mx-2" data-extractor="${extractor}">${extractor}</button>`);
    });
}

function listExtractors() {
    const extractors = [];
    const carouselItems = $(document).find('.custom-carousel-container .grid-item');
    
    carouselItems.each(function() {
        const extractor = $(this).attr('data-extractor');
        if (extractor && !extractors.includes(extractor)) {
            extractors.push(extractor);
        }
    });

    return extractors;
}
function displaySrc(el) {
    const $card = $(el).closest('.card.info-container');
    const $over = $(el).closest('.card-body-over')
    const $img = $card.find('img.card-img-top');
    const $spinner = generateSpinnerCard($card);
    $spinner.show();
  
    // Check if the element has already been processed
    if ($img.attr('data-processed') === 'true') {
      console.log('Element already processed. Skipping.');
      $spinner.hide(); // Hide spinner if element is already processed
      return;
    }
  
    // Get the value of the data-src attribute
    const dataSrc = $img.attr('data-src');
  
    // Log the data-src value
    console.log(`data-src value: ${dataSrc}`);
  
    if (dataSrc) {
      // Set the src attribute to the value of data-src
      $img.attr('src', dataSrc);
  
      // Mark the element as processed
      $img.attr('data-processed', 'true');
  
      console.log('Successfully transferred data-src to src.');
      $spinner.hide(); // Hide spinner after processing
      $over.hide()
      $(el).hide()
    } else {
      console.log('data-src attribute not found.');
      $spinner.hide(); // Hide spinner if data-src not found
      $over.hide()
      $(el).hide()
    }
  }

  function updateUserFvoriteCountry(country) {
    $.post('/api/update-country',{country},function(response){
        handleFormResult(response.status,response.message)
    })
  }
  function selectCountry(){
    $('#select-country').toggle().toggleClass('d-flex')
  }
  function handleSelectCountry() {
    // Using jQuery to listen for changes on the f
    $('#countryDropdown').change(function() {
        const selectedCountry = $(this).val();
        updateUserFvoriteCountry(selectedCountry)
    });

    $('#select-country .close').on('click',function(){
        $('#select-country').hide().removeClass('d-flex')
    })
}

function activateClickOnVisibleButtons() {

    // Function to check if an element is in the viewport
    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    $(document).on('scroll', function() {
        showImage()

        function showImage() {
                    // Loop through each .card.info-container element
                    $('.displaysrc').each(function() {
                        // Check if the card is NOT in the viewport
                            const $img = $(this).find('.card-img-top');
                        if (isInViewport(this) && $img.attr('data-processed') != 'true') {
                            // Find the .card-img-top inside the card, remove its src and set its 'data-processed' attribute to true
                            $img.attr('data-processed', 'true');
                            $img.attr('src',$img.attr('data-src'));
                            console.log(".card-img-top's 'data-processed' attribute set to false as its parent .card.info-container is not in the viewport");
                        }
                    });
        }

        function hideImage() {
                    // Loop through each .card.info-container element
                    $('.card.info-container').each(function() {
                        // Check if the card is NOT in the viewport
                        if (!isInViewport(this)) {
                            // Find the .card-img-top inside the card, remove its src and set its 'data-processed' attribute to true
                            const $img = $(this).find('.card-img-top');
                            $img.attr('data-processed', 'false');
                            $img.removeAttr('src');
                            console.log(".card-img-top's 'data-processed' attribute set to false as its parent .card.info-container is not in the viewport");
                        }
                    });
        }
    });
}

//actress functions


function setPreview(id, event) {
    if($(`#${id}`).hasClass('done')){
        return
    }
    // Get the image and video elements based on the provided ID
    const imgElement = document.querySelector(`img[data-id="${id}"]`);
    const videoElement = document.querySelector(`video[data-id="${id}"]`);

    if (!imgElement || !videoElement) {
        console.error(`Elements not found for ID: ${id}`);
        return;
    }

    if (event.type === "mouseenter") {
        // Hide the image, display the video, and start playback
        imgElement.style.display = "none";
        videoElement.style.display = "block";
        videoElement.play();
    } else if (event.type === "mouseleave") {
        // Show the image, pause the video, reset its time, and hide it
        imgElement.style.display = "block";
        videoElement.pause();
        videoElement.currentTime = 0;  // Reset video playback
        videoElement.style.display = "none";
    }
}
function downloadVideo(itemID, actressName) {
    if($(`#${itemID}`).hasClass('done')){
        return
    }
    $(`#${itemID}`).addClass('done')

    // Prepare the payload to send in the request body
    const payload = {
        itemID: itemID,
        actressName: actressName
    };
    //handleIframeActress(itemID)
    
    // Make the AJAX POST request
    $.ajax({
        url: 'http://192.168.10.115:3100/api/downloadVideoSegments', // API endpoint
        type: 'POST', // HTTP Method
        contentType: 'application/json', // Content type being sent
        data: JSON.stringify(payload), // Convert payload object to JSON string
        success: function(response) {
        // Handle the success case
        console.log("Video segments downloaded successfully: ", response);
        $(`img[data-id="${itemID}"]`).hide()
        
        
        $((`video[data-id="${itemID}"]`)).attr({
            src: response.url,
            autoplay: true,
            controls: true,
            playsinline: true,
            loop:false
        }).show()
        },
        error: function(error) {
        // Handle the error case
        console.error("Error downloading video segments: ", error);
        }
    });

    
}
function isVideoStreaming(itemID) {
    return $(`#${itemID}`).hasClass('streaming');
}

function waitForBufferUpdateEnd(sourceBuffer) {
    return new Promise(resolve => {
        if (!sourceBuffer.updating) {
            resolve();
        } else {
            sourceBuffer.addEventListener('updateend', resolve, { once: true });
        }
    });
}

async function streamVideo(itemID, actressName) {
    if (isVideoStreaming(itemID)) {
        console.log(`Video with itemID: ${itemID} is already streaming.`);
        return;
    }

    const mediaSource = new MediaSource();
    const videoElement = $(`video[data-id="${itemID}"]`)[0];
    videoElement.src = URL.createObjectURL(mediaSource);
    let sourceBuffer;
    
    // This array will hold fetched buffers
    const bufferQueue = [];

    mediaSource.addEventListener('sourceopen', () => {
        if (mediaSource.readyState === 'open') {
            sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.64001E, mp4a.40.2"');
            
            sourceBuffer.addEventListener('updateend', async () => {
                console.log('Buffer updated. Buffered ranges: ', sourceBuffer.buffered);
                if (bufferQueue.length) {
                    // Remove the first buffer from the queue and append it to the sourceBuffer
                    const nextBuffer = bufferQueue.shift();
                    sourceBuffer.appendBuffer(new Uint8Array(nextBuffer));
                }
            });
            
            sourceBuffer.addEventListener('error', e => {
                console.log('SourceBuffer Error:', e);
            });
        } else {
            console.log(`Cannot append buffer, MediaSource readyState is ${mediaSource.readyState}`);
        }
    });

    const ws = new WebSocket('ws://localhost:3001');
    ws.addEventListener('message', async (event) => {
        const data = JSON.parse(event.data);
        if (data.type !== 'videoSegmentReady') return;

        console.log(`New segment ready to stream for item ${data.itemID}: ${data.pathToStream}`);
        try {
            const response = await fetch(data.pathToStream);
            const arrayBuffer = await response.arrayBuffer();
            
            console.log(`Fetched ${arrayBuffer.byteLength} bytes`);
            bufferQueue.push(arrayBuffer);

            if (!sourceBuffer.updating && bufferQueue.length === 1) {
                // If sourceBuffer is not updating and our bufferQueue has only one item (the one we just added), 
                // immediately append it to the sourceBuffer. 
                const nextBuffer = bufferQueue.shift();
                sourceBuffer.appendBuffer(new Uint8Array(nextBuffer));
            }
        } catch (error) {
            console.log('Error fetching segment:', error);
        }
    });

    $(videoElement).attr({
        autoplay: true,
        muted: true,
        controls: true,
        playsinline: true,
        loop: false
    });

    $(`img[data-id="${itemID}"]`).hide();
    $(videoElement).show();

    $(`#${itemID}`).addClass('streaming done');

    console.log(`Started streaming video for itemID: ${itemID}, actressName: ${actressName}`);
}
function handleAudio(){
    $(document).on('click','#toggleAudio',function(){
        // Toggle audio on all video elements
        $('video').each(function() {
        if (this.muted) {
            this.muted = false;
        } else {
            this.muted = true;
        }
        });
    
        // Toggle the icon visibility
        $('.fa-volume-up, .fa-volume-off').toggleClass('d-none');
    });
      
}
 
function handleIframeActress(itemID){
    const element = $(`.iframe-container[data-id="${itemID}"]`);
    const iframURL = element.attr('data-link')
    const iframeHTML = `<iframe src="${iframURL}" width="600" height="400"></iframe>`
    element.append(iframeHTML)
}
function handleInstantVideo() {
    $(document).on('click','.instant-play-button', function() {
        $(this).addClass('play')
        var dataId = $(this).attr('data-id');
        const $thisCard = $('.info-container[data-id="' + dataId + '"]')
        addCardToList($thisCard,true)
        instantPlay(dataId)
    });
}
async function instantPlay(dataId){
    const mode = parseInt($('.mode-container').data('mode'))
    if(mode == 7){
        directDownloadFileFromURL(dataId)
        return
    }
    const $thisCard = $('.info-container[data-id="' + dataId + '"]')
    $thisCard.find('.card-body-over').addClass('hover-hide').removeClass('d-flex');
    
    var videoElement = $('video[data-id="' + dataId + '"]');
    videoElement.attr('src', videoElement.attr('data-src'));
    
    videoElement.on('loadeddata', function() {
        $('img.card-img-top[data-id="' + dataId + '"]').hide();
        videoElement.show();
        updateMasonryLayout()
        $thisCard.find('.video-container').addClass('loaded')
    })
    directDownloadFileFromURL(dataId)
}
function directDownloadFileFromURL(dataId,callback){
    const mode = $('#range').data('mode')
    $.post('http://192.168.10.115:3100/api/dl', { video_id: dataId,mode }, function(response) {
        //console.log('Download API Response:', response);
        if(typeof callback == 'function'){callback(response)}
      })
}

function stringToID(str) {
    // First, trim the string to remove any leading or trailing spaces
    let trimmedStr = str.trim();
  
    // Replace spaces with underscores (or hyphens, if you prefer)
    let spaceReplacedStr = trimmedStr.replace(/\s+/g, '_');
  
    // Remove any characters that are not letters, digits, hyphens, or underscores
    let sanitizedStr = spaceReplacedStr.replace(/[^a-zA-Z0-9-_]/g, '');
  
    // Ensure the string starts with a letter. If not, prepend with a letter (e.g., 'id_')
    let id = sanitizedStr.match(/^[a-zA-Z]/) ? sanitizedStr : `id_${sanitizedStr}`;
  
    return id;
}
  

function reorderElementByTime(container) {
    // Retrieve and store the .item elements and their time data in an array
    var items = container.find('.item').map(function() {
        var timeData = $(this).data('time');
        var time = new Date(timeData);
        return {
            element: this,
            time: time,
            isValidDate: !isNaN(time.getTime()) // Check if the date is valid
        };
    }).get();

    // Sort the array based on the time, placing invalid dates at the end
    items.sort(function(a, b) {
        if (!a.isValidDate) return 1; // Push invalid a dates to the end
        if (!b.isValidDate) return -1; // Push invalid b dates to the end
        return a.time - b.time; // Sorts in ascending order of valid time
    });

    // Append the sorted elements back to the container
    $.each(items, function() {
        container.append(this.element);
    });
}

function getTopPageSB(callback){
    const mode = $('#display-history').data('mode');

 
    if($('#display-history').length == 0 || mode != 1){
        return
    }
    getUserNSFW(function(nsfw){
        if(nsfw != 'true'){
            return
        }
        $.post('/api/getSBtop', {mode, nsfw, extractor:'spankbang'}, function(result){
            if (callback) {callback(result.data)} 
        });
    })
}
function getTopPageMode(callback){
    const mode = $('#display-history').data('mode');
    if($('#display-history').length == 0){
        return
    }
    getUserNSFW(function(nsfw){
        if(nsfw != 'true'){
            return
        }
        $.post('/api/getTopPage', {mode, nsfw}, function(result){
            if (callback) {callback(result.data)} 
        });
    })
}

function backtothetop(){
    // Back to top button markup
    $("body").append('<a href="#" class="btn btn-dark btn-back-to-top" style="display: none; position: fixed; bottom: 20px; right: 20px;"><i class="fas fa-arrow-up"></i></a>');

    // Scroll event
    $(window).scroll(function() {
        if ($(this).scrollTop() > 50) {
            $('.btn-back-to-top').fadeIn();
        } else {
            $('.btn-back-to-top').fadeOut();
        }
    });

    // Click event
    $(document).on('click','.btn-back-to-top',function(){
        $('html, body').animate({scrollTop: 0}, 500);
        return false;
    });
}

function handleRoop() {
    $(document).on('click', '.handle-roop', function() {
        const itemId = $(this).data('id');
        
        // Check if the element has the 'global' class
        if ($(this).hasClass('global')) {
            // Trigger the function for each button without the 'global' class
            $('.handle-roop').not('.global').each(function() {
                downloadAndGenerate($(this).data('id'));
            });
        } else {
            downloadAndGenerate(itemId);
        }
    });
}

function downloadAndGenerate(itemId){
    instantPlay(itemId).then(()=>{
        const imgContainer = $('.video-container[data-id="' + itemId + '"]')
        const imgElement = imgContainer.find(`img[data-id=${itemId}]`)
        const originalSrc = imgElement.attr('data-src')

        if($(this).hasClass('done')){
            imgElement.attr('src',originalSrc)
            $(this).removeClass('done')
            return
        }
        if(imgContainer.data('roop')){
            $(`.video-container img[data-id=${itemId}]`).attr('src',imgContainer.data('roop'))
            return
        }
        const mode = $('.mode-container').data('mode')
        $.post('/api/intemInfo',{
            mode,
            itemId
        },function(response){
            if(response.status){
                const imagePath =  './public'+response.media.filePath
                const baseFace = `./public/downloads/downloaded_images/face_5.jpg`
                generateDiffusedImage({imagePath,aspectRatio:"2:3",isRoop:true,baseFace,itemId})
            }
        })
    })
}