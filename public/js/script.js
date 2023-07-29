// Utility functions
const logout = () => window.location.href = '/user/logout';

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

// Masonry setup
$(window).on('load', function() {
    if(document.querySelector('.masonry-container')){
        new Masonry('.masonry-container', {
            itemSelector: '.masonry-item',
            columnWidth: '.masonry-item',
            percentPosition: true
        });
    }
});

$(document).ready(function() {
    let formChanged = false;
    let form = $('#updateProfile form');
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
            alert('No changes have been made to the form.');
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

    // Other event listeners
    $(document).on('click', '.alert-container', function() { $(this).fadeOut();  });
    $(".card.pricing").hover(() => $(this).addClass('border-primary'), () => $(this).removeClass('border-primary'));
    
    // Card Clickable
    handleScrollDownButton();
    handleCardClickable();
    handleDownloadButton();
    handleCardButton();
    handleChat();
    feather.replace()
});

const handleScrollDownButton = () => {

    // Detect scroll event on the chat window
    $('.chat-window').on('scroll', function() {
        // If scrolled to bottom of the chat window, fade out the scroll down button
        if ($('.chat-window').scrollTop() + $('.chat-window').innerHeight() >= $('.chat-window')[0].scrollHeight) {
            $('.scroll-down').fadeOut();
        } else {
            // If not at the bottom, fade in the scroll down button
            $('.scroll-down').fadeIn();
        }
    });
    $('.scroll-down').on('click', function() {
        $('.chat-window').animate({ scrollTop: $('.chat-window')[0].scrollHeight }, 'slow');
        return false;
    });
}


const handleCardButton = () => {
    $('.info-button').on('click',function(){
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
            return 'Old password is incorrect';
        }
    }

    if (newPassword && newPasswordVerification) {
        if (!areNewPasswordsSame(newPassword, newPasswordVerification)) {
            return 'New password and password verification do not match';
        }
    } else if (newPassword || newPasswordVerification) {
        // Only check if both fields are filled if one of them is filled
        return 'Please fill out all password fields';
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
    handleFormResult(false, 'An unexpected error occurred.');
}

const handleFormResult = (isSuccess, message) => {
    let btnColor = isSuccess ? 'success' : 'danger';
    let btnSelector = `button[type="submit"]`;
    $(btnSelector).removeClass('btn-primary').addClass(`btn-${btnColor}`);
    // Stop any ongoing animations and hide the alert
    $("#front-alert .alert-"+btnColor).stop().hide();
    $("#front-alert .alert-"+btnColor).text(message).fadeIn().delay(5000).fadeOut();
    setTimeout(() => $(btnSelector).removeClass(`btn-${btnColor}`).addClass('btn-primary'), 5000);
}

// Handling of card clicking
const handleCardClickable = () => {
  $('.card-clickable img').click(function() {
    const $thisCard = $(this).parent()
    var id = $thisCard.data('id');
    var isdl = $thisCard.data('isdl');

    console.log('Clicked card ID:', id);
    console.log('isdl: ',isdl)

      // Check if the card has already been processed
      if ($thisCard.hasClass('done')) {
          console.log('Card has already been processed.');
          return;
      }

      // Mark the card as done to avoid processing it again
      $thisCard.addClass('done');

      // Check if the spinner is already present, if not, create and append it to the card
      if (!$thisCard.find('.spinner-border').length) {
          var $spinner = $('<div>').addClass('spinner-border position-absolute text-white').css({inset:"0px", margin:"25% auto"}).attr('role', 'status');
          var $span = $('<span>').addClass('visually-hidden').text('Loading...');
          $spinner.append($span);
          $thisCard.find('.card-body').append($spinner);
      }

      // Show the spinner while the download is in progress
      var $spinner = $thisCard.find('.spinner-border');
      $spinner.show();

      // Make a request to the server to get the highest quality video URL for the given ID
      $.get('/api/video', { id: id }, function(response) {
          console.log('API Response:', response);

          // Assuming the response from the API is a JSON object with a 'url' property
          if (response && response.url) {
              console.log('Received video URL:', response.url);

              // Replace the image with an autoplay video
              var $video = $('<video>').attr({
                  src: response.url,
                  autoplay: false,
                  controls: true,
                  width: "100%"
              });

              console.log('Video element created:', $video);
              $thisCard.find('.card-img-top').remove()
              // Update the card body with the new video
              $thisCard.prepend($video);

              console.log('Video added to card body.');

            if (isdl==false && response.url.includes('http')) {
                // Add the download button
                var $downloadButton = $thisCard.find('.download-button')
                $downloadButton.show()
                console.log('Download button added to card body.');
            }

              // Hide the spinner
              $spinner.hide();
          } else {
              // If the response does not contain a URL, show an error message or handle it as needed
              console.error('Error: Video URL not available.');

              // Hide the spinner if there's an error
              $spinner.hide();
          }
      });
  });
}

// Handling of download button clicking
const handleDownloadButton = () => {
  $(document).on('click', '.download-button', function() {
      var id = $(this).data('id');
      console.log('Download button clicked for card ID:', id);
      var $buttonContainer = $(this);

      // Check if the card has already been processed
      if ($buttonContainer.hasClass('done')) {
            handleFormResult(false, 'Video has already been Downloaded') 
          console.log('Card has already been processed.');
          return;
      }

      // Mark the card as done to avoid processing it again
      $buttonContainer.addClass('done');

      const DLicon = $buttonContainer.find('i').clone();
      $buttonContainer.html('');

      // Check if the spinner is already present, if not, create and append it to the card
      if (!$(this).find('.spinner-border').length) {
          var $spinner = $('<div>').addClass('spinner-border spinner-border-sm text-dark').attr('role', 'status');
          var $span = $('<span>').addClass('visually-hidden').text('Loading...');
          $spinner.append($span);
          $(this).prepend($spinner);
      }

      // Show the spinner while the download is in progress
      var $spinner = $(this).find('.spinner-border');
      $spinner.show();

      // Make a request to download the video
      $.post('/api/dl', { video_id: id }, function(response) {
        console.log('Download API Response:', response);

        $spinner.remove();

        if(!$buttonContainer.find('i').length){
          $buttonContainer.append(DLicon)
        }
        console.log('Video download successful.');
        handleFormResult(true, 'Video Downloaded')         
        // Hide the spinner when the download finishes
        $spinner.hide();
      }).fail(function() {

        $spinner.remove();

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

 const handleChat = () => {
    $('#chat-input-section button').on('click', function(e) {
        e.preventDefault();

        const $this = $(this);
        const $input = $('#chat-input-section input');
        const prompt = $input.val();

        console.log(prompt);

        if (!prompt) {
            return;
        }

        $input.val(''); // clear input field
        $this.find('i').hide(); // hide plane icon
        $this.append('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'); // add spinner

        // update chat window
        const $messages = $('#messages');
        const $template = $('.template').clone().removeAttr('style class');
        
        // Add user message
        $template.addClass('my-4');
        $template.find('.userName').text('User');
        $template.find('.message').addClass('user').text(prompt);
        $template.find('.time').text(new Date().toLocaleTimeString());
        $messages.append($template);

        $('.chat-window').scrollTop($('.chat-window').prop('scrollHeight'));

        // simulate request
        $.ajax({
            url: '/api/openai/send-prompt', // replace with your endpoint
            method: 'POST',
            data: { prompt,time:new Date() },
            success: function(response) {

                // Add agent message
                const $agentTemplate = $('.template').clone().removeAttr('style class');
                $agentTemplate.addClass('my-4 text-end');
                $agentTemplate.find('.userName').text('Agent');
                $agentTemplate.find('.message').addClass('agent').text(response.dataUpdate.completion);
                $agentTemplate.find('.time').text(new Date(response.dataUpdate.response_time).toLocaleTimeString());
                $messages.append($agentTemplate);

                console.log(response);
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon

                $('.chat-window').scrollTop($('.chat-window').prop('scrollHeight'));
            },
            error: function(error) {
                console.error(error);
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon
            },
            finally: function(error) {
                console.error(error);
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon
            }
        });
    });
 }