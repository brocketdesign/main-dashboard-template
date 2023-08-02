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
const handleMasonry = () => {
    if(document.querySelector('.masonry-container')){
        new Masonry('.masonry-container', {
            itemSelector: '.masonry-item',
            columnWidth: '.masonry-item',
            percentPosition: true
        });
    }
}
// Masonry setup
$(window).on('load', function() {
    handleMasonry()
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
    $('.delete-button').click(function() {  handleHiding($(this).data('id'))  });
    $('.card img').on('error', function() { 
        var videoId = $(this).data('id');
        console.log('Image load error for: ',videoId)
        handleHiding(videoId); 
        handleMasonry()
    });
    $('.card img').on('load', function() { 
        handleMasonry()
    });
    $(".card").on('mouseenter', function(){
        $(this).find('.hover').show();
    });

    $(".card").on('mouseleave', function(){
        $(this).find('.hover').hide();
    });

    $('input#searchTerm').on('change',function(){$('#page').val(1)})

    handleScrollDownButton();
    handleCardClickable();
    handleDownloadButton();
    handleCardButton();
    handleChat();
    handleCOmpare();
    handleCOmparePDF();
    handleSwitchNSFW();
    handleGridRange();
    handleLoadMore();
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
    console.log('予期せぬエラーが発生しました。')
    handleFormResult(false, '予期せぬエラーが発生しました。');
}

const handleFormResult = (isSuccess, message) => {
    let btnColor = isSuccess ? 'success' : 'danger';
    let btnSelector = `button[type="submit"]`;

    $(btnSelector).removeClass('btn-primary').addClass(`btn-${btnColor}`);

    // Stop any ongoing animations and hide all alerts
    $("#front-alert .alert-success").stop().hide();
    $("#front-alert .alert-danger").stop().hide();

    $("#front-alert .alert-"+btnColor).text(message).fadeIn().delay(5000).fadeOut();

    setTimeout(() => $(btnSelector).removeClass(`btn-${btnColor}`).addClass('btn-primary'), 5000);
}

// Handling of card clicking
const handleCardClickable = () => {
  $('.card-clickable-1 img').click(function() {
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
          var $spinner = $('<div>').addClass('spinner-border position-absolute text-white').css({inset:"0px", margin:"20% auto"}).attr('role', 'status');
          var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
          $spinner.append($span);
          $thisCard.find('.card-body-over').append($spinner);
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
              }).on('loadeddata', function() {
                // Code to be executed when the video is ready to play
                console.log('Video ready to play');
                handleMasonry()
            });;

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
        handleFormResult(false, '既にダウンロードされています') 
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
          var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
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
          $buttonContainer.append(DLicon).addClass("text-primary")
        }
        console.log('Video download successful.');
        handleFormResult(true, 'ビデオがダウンロードされました')         
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
            url: '/api/openai/compare', // replace with your endpoint
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

const handleSwitchNSFW= () => {
    // Check if the local variable exists
    var switchState = localStorage.getItem('handleSwitchNSFW');

    // Initialize the switch based on the local variable
    if (switchState !== null) {
        $('#nsfw').prop('checked', switchState === 'true');
    }

    // Save the state of the switch to a local variable when it's toggled
    $('#nsfw').change(function() {
        $('input#searchTerm').val('')
        localStorage.setItem('handleSwitchNSFW', $(this).is(':checked'));
        console.log('NSFW: ',$(this).is(':checked'))
        const nsfw = $(this).is(':checked')
        $.ajax({
            url: `/user/nsfw`,
            type: 'POST',
            data: {nsfw},
            success: (response) => {
                //handleFormResult(true, response.message);
                location.href = location.origin + location.pathname;

            },
            error: handleFormError
        });
    });
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
        $template.find('.userName').text('ユーザー');
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
                $agentTemplate.find('.userName').text('エージェント');
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
const handleHiding = (videoId) => {
    let $container = $(`.card[data-id=${videoId}]`)
    $.ajax({
        url: '/api/hide',
        method: 'POST',
        data: { id: videoId },
        success: function(response) {
            $container.remove()
            handleMasonry()
            handleFormResult(true,response.message)
            // Handle the success response
            console.log(response);
            },
        error: handleFormError
    });

}


function updategridlayout(value) {
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
    handleMasonry()
  }
  
  
  const handleGridRange = () => {
    // Check if the local variable exists
    var rangeState = localStorage.getItem('rangeState');
  
    // Initialize the range input based on the local variable
    if (rangeState !== null) {
      $('#grid-range').val(rangeState);
      updategridlayout(rangeState)
    }
  
    // Save the state of the range input to local storage when it's toggled
    $('#grid-range').change(function() {
      const value = $(this).val();
      localStorage.setItem('rangeState', value);
      updategridlayout(value); // Call the function to update the grid layout with the new value
    });
  };
  
  const handleLoadMore = () => {
    const currentPage = $('#page').val()
    if(currentPage==1){
        $('.load-more-previous').remove()
    }
    $('.load-more').on('click', function(){
        let nextPage
        if($(this).hasClass('load-more-next')){
            nextPage = parseInt(currentPage) + 1
        }else{
            nextPage = parseInt(currentPage) - 1
            nextPage < 0 ? 1 : nextPage
        }
        const currentPageQueries = getCurrentPageQueries();
        let query = currentPageQueries.searchTerm || null 

        console.log({currentPage,nextPage,query})

        $('#page').val(nextPage)
        $('input#searchTerm').val(query)
        setTimeout(() => {
            $('form#search').submit()
        }, 1000);
    })
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

