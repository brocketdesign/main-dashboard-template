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
    $('.delete-button').click(function(e) { 
        e.preventDefault()
        const confirmation = confirm("Are you sure you want to delete this ?");

        if (!confirmation) {
            return
        }

         handleHiding($(this).closest('.card').data('id'))  
    });
    $('.delete-button-history').click(function(e) {  
        e.preventDefault()
        const confirmation = confirm("Are you sure you want to delete this ?");

        if (!confirmation) {
            return
        }
        $(this).closest('a').remove()
        handleHidingHistory($(this).closest('.card').data('query'))  
    });

    $('.summarize-button').click(function(event) { 
        event.preventDefault(); // Prevents the default click behavior
        const confirmation = confirm("Are you sure you post this video summary ?");

        if (!confirmation) {
            return
        }
        const videoId = $(this).closest('.card').data('id');
          console.log('Download button clicked for:', {videoId});
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
          if (!$(this).find('.spinner-border.for-summary').length) {
              var $spinner = $('<div>').addClass('spinner-border for-summary spinner-border-sm text-white').attr('role', 'status');
              var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
              $spinner.append($span);
              $buttonContainer.prepend($spinner);
          }
    
          // Show the spinner while the download is in progress
          var $spinner = $(this).find('.spinner-border');
          $spinner.show();
          $.ajax({
            url: '/api/openai/summarize',
            method: 'POST',
            data: { videoId },
            success: function(response) {
                handleFormResult(true,response.message)
    
                $spinner.remove();
    
                if(!$buttonContainer.find('i').length){
                $buttonContainer.append(DLicon)
                }
                // Handle the success response
                console.log(response);
                },
            error: handleFormError
        });
    });
    $('.card img').on('error', function() { 
        var videoId = $(this).data('id');
        console.log('Image load error for: ',videoId)
        $(`.card[data-id=${videoId}]`).remove()
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

    handleBookEditing();
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
    handleResetFormSubmission();
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

    $(btnSelector).removeClass('btn-success').addClass(`btn-${btnColor}`);

    // Stop any ongoing animations and hide all alerts
    $("#front-alert .alert-success").stop().hide();
    $("#front-alert .alert-danger").stop().hide();

    $("#front-alert .alert-"+btnColor).text(message).fadeIn().delay(5000).fadeOut();

    setTimeout(() => $(btnSelector).removeClass(`btn-${btnColor}`).addClass('btn-success'), 5000);
}

// Handling of card clicking
const handleCardClickable = () => {
    $(`.card-clickable-1 img`)
    .click(function() {
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
      if (!$thisCard.find('.spinner-border .for-strm').length) {
          var $spinner = $('<div>').addClass('spinner-border for-strm position-absolute text-white bg-dark').css({inset:"0px", margin:"auto"}).attr('role', 'status');
          var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
          $spinner.append($span);
          $thisCard.find('.card-body-over').append($spinner);
      }

      // Show the spinner while the download is in progress
        $thisCard.find('.card-body-over').show();
      var $spinner = $thisCard.find('.spinner-border');
      $spinner.show();

      // Make a request to the server to get the highest quality video URL for the given ID
      $.get('/api/video', { id: id }, function(response) {
          console.log('API Response:', response);

        // Hide the spinner
        $spinner.hide();
          // Assuming the response from the API is a JSON object with a 'url' property
          if (response && response.url) {
              console.log('Received video URL:', response.url);

              // Replace the image with an autoplay video
              var $video = $('<video>').attr({
                  src: response.url,
                  autoplay: true,
                  controls: true,
                  width: "100%",
                  playsinline: true
              }).on('loadeddata', function() {
                // Code to be executed when the video is ready to play
                console.log('Video ready to play');
                handleMasonry()
            });;

              console.log('Video element created:', $video);
              //$thisCard.find('.card-img-top').remove()
              
              // Update the card body with the new video
              //$thisCard.prepend($video);
              $('#video-holder').html('')
              $('#video-holder').append($video)//.append($thisCard.find('.tool-bar').clone()).append($thisCard.find('.card-title').clone().show())

              console.log('Video added to card body.');

              //Add related
              if(response.related){
                $('#related').html('')
                $cardContainer = $('.card.card-clickable-1').clone()
                for(item in response.related){
                    $spinner = $cardContainer.find('.spinner-border');
                    $spinner.hide()
                    $cardContainer.addClass('item m-2').style('width','18rem')
                    $cardContainer.attr('data-id',item.video_id).attr('data-title',item.alt)
                    $cardContainer.find('src').attr('src',item.imageUrl)
                    $cardContainer.find('a.source').attr('href',item.href)
                    $cardContainer.find('p.card-title').text(item.alt)
                    
                    $('#related').append($cardContainer)
                }
                handleCardClickable()
              }

            if (isdl==false && response.url.includes('http')) {
                // Add the download button
                var $downloadButton = $thisCard.find('.download-button')
                $downloadButton.show()
                console.log('Download button added to card body.');
            }
                
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
  $(document).on('click', '.download-button', function(event) {
    event.preventDefault(); // Prevents the default click behavior
    var id = $(this).closest('.info-container').data('id');
    var title = $(this).closest('.card').data('title');
      console.log('Download button clicked for:', {id,title});
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
      $.post('/api/dl', { video_id: id ,title}, function(response) {
        console.log('Download API Response:', response);

        $spinner.remove();

        if(!$buttonContainer.find('i').length){
          $buttonContainer.append(DLicon)
        }
        console.log('download successful.');
        handleFormResult(true, 'ダウンロードされました')    
        
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

    handleNSFWlabel(switchState)

    // Save the state of the switch to a local variable when it's toggled
    $('#nsfw').change(function() {
        $('input#searchTerm').val('')
        localStorage.setItem('handleSwitchNSFW', $(this).is(':checked'));
        console.log('NSFW: ',$(this).is(':checked'))
        const nsfw = $(this).is(':checked')
        handleNSFWlabel(nsfw)
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
function handleNSFWlabel(nsfw){
    if(nsfw === true || nsfw === 'true'){
        $('label[for="nsfw"]').addClass('bg-danger').removeClass('bg-dark')
    }else{
        $('label[for="nsfw"]').removeClass('bg-danger').addClass('bg-dark')
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

const handleHidingHistory = (query) => {
    $.ajax({
        url: '/api/hideHistory',
        method: 'POST',
        data: { query: query },
        success: function(response) {
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

// Function to search subreddits
function searchSubreddits(el) {
    // Checking if the element does not have a 'wait' class
    if (!$(el).hasClass('wait')) {
  
      // Adding 'wait' class to the element
      $(el).addClass('wait')
  
      // Implementing a delay using setTimeout
      setTimeout(async () => {
  
        // Clearing the content of 'searchRes' and adding a loading indicator
        $('#searchRes').empty().append(`
          <li class="list-group-item loading text-center p-3">
            <div class="loader spinner-border">
              <span class="visually-hidden">Loading ...</span>
            </div>
          </li>
        `);
  
        // Getting the search key from the element's value
        const key = $(el).val();
  
        // Forming the API URL
        const apiUrl = `/api/searchSubreddits?query=${key}`;
  
        // Checking if key is not empty and is more than 0 characters long
        if (key && key.length > 0) {
  
          // Fetching data from the API
          try {
            const response = await $.get(apiUrl);
  
            // Mapping over the response data and forming the content
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
  console.log(content)
            // Removing the loading indicator and appending the content
            $('#subRedditSearchRes').append(content);
          } catch (error) {
            console.error(error);
          }
        } else {
          // If key is empty, clearing the content of 'searchRes'
          $('#subRedditSearchRes').empty();
        }
  
        // Removing the 'wait' class from the element
        $(el).removeClass('wait');
  
      }, 1000);
    }
  }
function handleBookEditing(){
    $('#edit-book textarea').on('input', function() {
        $(this).css('height', 'auto');
        $(this).css('height', $(this).prop('scrollHeight') + 'px');
    });
    $('textarea').each(function() {
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
    $('#searchTerm').val(value)
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

