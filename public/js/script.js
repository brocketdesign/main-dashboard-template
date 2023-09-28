// Utility functions
const logout = () => window.location.href = '/user/logout';
const YOUR_LARGE_SCREEN_BREAKPOINT = 992

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
const handleMasonry = () => {
    
    if(
        document.querySelector('.masonry-container')
        && window.innerWidth >= YOUR_LARGE_SCREEN_BREAKPOINT
    ){
        msnry = new Masonry('.masonry-container', {
            itemSelector: '.masonry-item:not([style*="display: none"])', 
            columnWidth: '.masonry-item',
            percentPosition: true
        });
    }
}
const updateMasonryLayout = () => {
    if (msnry) {
        msnry.layout();
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
    $('.delete-button').click(function(e) { 
        e.preventDefault()

         handleHiding($(this).closest('.card').data('id'))  
    });
    $('.delete-button-history').click(function(e) {  
        e.preventDefault()
        $(this).closest('a').remove()
        handleHidingHistory($(this).closest('.card').data('query'))  
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

    $('input#searchTerm').on('change',function(){$('#page').val(1)})
      
      
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
    handleCopyButtons()
    updateMoments();
    enableTrackScroll();
    handleOpenaiForm();
    handleMemo();

    enableSubRedit()

    //Handle SideBAR
    onLargeScreen(handleSideBar)
    onSmallScreen(handleSideBar2)
    
    handleAccordions()
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
    handleIframe()
    
    initializeExtractor();
});
function scrollBottomWindow(){
    $('html, body').animate({ scrollTop: $(document).height() }, 'fast', function() {
        // After the animation is complete, disable scrolling
        $('body').css('overflow', 'hidden');
    });
}
const handleScrollDownButton = () => {
    if ($('#chat-input-section').length) {
        scrollBottomWindow()
        $('.chat-window').animate({ scrollTop: $('.chat-window')[0].scrollHeight }, 'slow');
        disableTrackScroll()
    }
    
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
    console.log('予期せぬエラーが発生しました。')
    handleFormResult(false, '予期せぬエラーが発生しました。');
}

const handleFormResult = (isSuccess, message) => {
    let btnColor = isSuccess ? 'success' : 'danger';
    let btnSelector = `button[type="submit"]`;

    //$(btnSelector).removeClass('btn-success').addClass(`btn-${btnColor}`);

    $("#front-alert .alert-success").stop().hide();
    $("#front-alert .alert-danger").stop().hide();

    $("#front-alert .alert-"+btnColor).text(message).fadeIn().delay(5000).fadeOut();

    //setTimeout(() => $(btnSelector).removeClass(`btn-${btnColor}`).addClass('btn-success'), 5000);
}

// Handling of card clicking
const handleCardClickable = () => {
    $(`.play-button`)
    .click(function(event) {
    event.stopPropagation();
    const $thisCard = $(this).closest('.card.info-container')
    var id = $thisCard.data('id');
    var isdl = $thisCard.data('isdl');
    console.log('Clicked card ID:', id);
    console.log('isdl: ',isdl)

      // Check if the card has already been processed
      if ($thisCard.hasClass('done')) {
          console.log('Card has already been processed.');
          return;
      }

      //Reset all the other cards
      $(`.card.info-container`).each(function(){
        $(this).removeClass('done')
      })
      $(this).hide()
      // Mark the card as done to avoid processing it again
      $thisCard.addClass('done');
      // Check if the spinner is already present, if not, create and append it to the card
      if (!$thisCard.find('.spinner-border .for-strm').length) {
          var $spinner = $('<div>').addClass('spinner-border for-strm position-absolute bg-dark').css({inset:"0px", margin:"auto"}).attr('role', 'status');
          var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
          $spinner.append($span);
          $thisCard.find('.card-body-over').append($spinner);
      }

      // Show the spinner while the download is in progress
        $thisCard.find('.card-body-over').show();
      var $spinner = $thisCard.find('.spinner-border');
      $spinner.show();

      // Make a request to the server to get the highest quality video URL for the given ID
      $.get('/api/video?videoId='+id, function(response) {
          console.log('API Response:', response);

        // Hide the spinner

        $spinner.hide();
        $thisCard.find('.card-body-over').remove()
          // Assuming the response from the API is a JSON object with a 'url' property
          if (response && response.url) {
              // Replace the image with an autoplay video
              var $video = $('<video>').attr({
                  src: response.url,
                  autoplay: true,
                  width:"100%",
                  controls: true,
                  playsinline: true
              }).on('loadeddata', function() {
                updateMasonryLayout()
            });

            $thisCard.find(`img.card-img-top`).before($video)
            $thisCard.find(`img.card-img-top`).hide()
            // Update the card body with the new video
            //$thisCard.prepend($video);
            $('#video-holder').html('')
            $('#video-holder').data('id',id)
        

            if (isdl==false && response.url.includes('http')) {
                // Add the download button
                var $downloadButton = $thisCard.find('.download-button')
                $downloadButton.show()
                console.log('Download button added to card body.');
            }
                
          } else {
              // If the response does not contain a URL, show an error message or handle it as needed
              console.error('Error: Video URL not available.');

              $thisCard.find('.card-body-over').hide();
              // Hide the spinner if there's an error
              $spinner.hide();
          }
      });
  });
}
function displayMedia(url,id){
    $thisCard = $(`.card.info-container[data-id=${id}]`)

    if((url.includes('.mp4') || url.includes('.webm')) && $thisCard.find('video').length == 0){
        console.log('displayvideo',{url,id})
        $thisCard.find('.card-body-over').remove()
        var $video = $('<video>').attr({
            src: url,
            autoplay: true,
            width:"100%",
            controls: true,
            playsinline: true
        }).on('loadeddata', function() {
          updateMasonryLayout()
      });
      $thisCard.find(`img.card-img-top`).before($video)
      $thisCard.find(`img.card-img-top`).hide()
      $thisCard.find(`.play-button`).hide()
    }
    $thisCard.find(`img.card-img-top`).attr('src',url)
    $thisCard.find(`.play-button`).hide()
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
          var $spinner = $('<div>').addClass('spinner-border for-dl spinner-border-sm').attr('role', 'status');
          var $span = $('<span>').addClass('visually-hidden').text('読み込み中...');
          $spinner.append($span);
          $(this).prepend($spinner);
      }

      // Show the spinner while the download is in progress
      var $spinner = $(this).find('.spinner-border');
      $spinner.show();

      // Make a request to download the video
      $.post('http://192.168.10.115:3100/api/dl', { video_id: id ,title}, function(response) {
        console.log('Download API Response:', response);
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

const handleSwitchNSFW= () => {
    // Check if the local variable exists
    var switchState = localStorage.getItem('handleSwitchNSFW');

    // Initialize the switch based on the local variable
    if (switchState !== null) {
        $('#nsfw').prop('checked', switchState === 'true');
    }
    if ($('#nsfw').length > 0) {
        handleNSFWlabel(switchState === 'true')
        
        nsfwUpdateData({nsfw:switchState === 'true'})
    }
    // Save the state of the switch to a local variable when it's toggled
    $('#nsfw').change(function() {
        $('input#searchTerm').val('')
        localStorage.setItem('handleSwitchNSFW', $(this).is(':checked'));
        console.log('NSFW: ',$(this).is(':checked'))
        const nsfw = $(this).is(':checked')
        handleNSFWlabel(nsfw)
        nsfwUpdateData({nsfw},function(){
            //handleFormResult(true, response.message);
            location.href = location.origin + location.pathname;
        })
    });
}
function nsfwUpdateData(nsfw,callback) {
    console.log('Update NSFW to: ',nsfw)
    $.ajax({
        url: `/user/nsfw`,
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

 const handleChat = () => {
    $('#chat-input-section button').on('click', function(e) {
        e.preventDefault();

        const $this = $(this);
        const $input = $('#chat-input-section input');
        const prompt = $input.val() ;

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
        $template.addClass('p-4 bg-white');
        $template.find('.userName').text('ユーザー');
        $template.find('.message').addClass('user bg-white').text(prompt);
        $template.find('.time').text(new Date().toLocaleTimeString());
        $messages.append($template);

        $('.chat-window').scrollTop($('.chat-window').prop('scrollHeight'));

        // simulate request
        $.ajax({
            url: '/api/openai/custom/chat', // replace with your endpoint
            method: 'POST',
            data: { 
                prompt:prompt+ `\n\nNote: Respond using markdown`,
                time:new Date() },
            success: function(response) {
                $('#temporary').html('')
                handleStream(response, function(message) {

                    if($(`#${response.insertedId}`).length==0){
                        const $agentTemplate = $('.template').clone().removeAttr('style class');
                        
                        $agentTemplate.addClass('p-4 text-end bg-dark text-white');
                        $agentTemplate.find('.userName').text('エージェント');
                        $agentTemplate.find('.time').text(new Date().toLocaleTimeString('ja-JP'));
                        $agentTemplate.find('.message').addClass('agent text-start').attr('id',response.insertedId)
                        $agentTemplate.append(`<div id="temp-${response.insertedId}" class="d-none"></div>`)
                        $messages.append($agentTemplate);
                        watchAndConvertMarkdown(`#temp-${response.insertedId}`, `#${response.insertedId}`); 
                    }
                    
                    $(`#temp-${response.insertedId}`).append(message);
                });
     
                scrollBottomWindow()
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
        data: { element_id: videoId },
        success: function(response) {
            $container.remove()
            updateMasonryLayout()
            handleFormResult(true,response.message)
            // Handle the success response
            console.log(response);
            },
        error: handleFormError
    });

}

const handleHidingHistory = (query) => {
    console.log(`Hide this query : ${query}`)
    $.ajax({
        url: '/api/hideHistory',
        method: 'POST',
        data: { query: query },
        success: function(response) {
            updateMasonryLayout()
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
    updateMasonryLayout()
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
    $('form#search').on('submit',function(e){
        e.preventDefault()
        
        const formData = new FormData(this);
        const searchdata = $('form#search').data();
        
        // Convert FormData to a plain object
        let formDataObject = {};
        for (let [key, value] of formData.entries()) {
          formDataObject[key] = value;
        }
        
        // Combine searchdata and formDataObject
        const data = Object.assign(searchdata, formDataObject);

        const $buttonContainer = $('form#search').find('button[type="submit"]')
        const $spinner = showSpinner($buttonContainer,'loadmore')

        sendSearchForm(data,function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })
    })
    $('.load-more').on('click', function(){
        const data = $(this).data()

        const $buttonContainer = $(this)
        const $spinner = showSpinner($buttonContainer,'loadmore')

        sendSearchForm(data,function(){
            $spinner.hide();
            $buttonContainer.find('i').show();
        })
    })
  }
  function sendSearchForm(data,callback) {
    $.ajax({
        url: `/api/loadpage`,
        type: 'POST',
        data,
        success: function(response){
            const url =`/dashboard/app/${data.mode}?page=${parseInt(data.page)}&searchTerm=${data.searchterm?data.searchterm:data.searchTerm}&nsfw=${data.nsfw}`
            console.log(url)
            if(callback){callback()}
           window.location=url
        },
        error: handleFormError
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
function enableSubRedit(){
        // Listen for focus event on the input element with id "searchTerm"
        $('#searchTerm').on('focus', function() {
          // Check the value of the 'data-mode' attribute
          const dataMode = $(this).attr('data-mode');
          
          // Log the focus event and the value of the 'data-mode' attribute
          console.log('Input is focused.');
          console.log(`data-mode attribute value: ${dataMode}`);
          
          // Check if data-mode attribute is equal to "2"
          if(dataMode === '2') {
            console.log('Input is focused and data-mode is 2.');
            searchSubreddits()
          }
        });
      
        // Listen for keyup event to capture when something is being typed
        $('#searchTerm').on('keyup', function() {
          // Check the value of the 'data-mode' attribute
          const dataMode = $(this).attr('data-mode');
      
          // Log that something is being typed and the value of the 'data-mode' attribute
          console.log('Something is being typed.');
          console.log(`data-mode attribute value: ${dataMode}`);
      
          // Check if data-mode attribute is equal to "2"
          if(dataMode === '2') {
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
  const searchTermEl = $('#searchTerm');
  const subRedditSearchResEl = $('#subRedditSearchRes');
  const loadingSpinnerEl = $('#loadingSpinner');

  clearTimeout(debounceTimeout); // Clear the existing timer if function is invoked again quickly

  debounceTimeout = setTimeout(async () => {
    // Checking if the element does not have a 'wait' class
    if (!searchTermEl.hasClass('wait')) {
      console.log('Search started.');
  
      // Adding 'wait' class to prevent multiple requests
      searchTermEl.addClass('wait');
  
      // Clearing previous results
      subRedditSearchResEl.empty();
  
      // Show loading spinner
      loadingSpinnerEl.show();
  
      // Getting the search term from the input
      const key = searchTermEl.val();
  
      // Forming the API URL
      const apiUrl = `/api/searchSubreddits?query=${key}`;
  
      if (!key || key.length <= 0) {
        console.log('Search term is empty or too short.');
  
        // Hide loading spinner
        loadingSpinnerEl.hide();
  
        // Remove wait class
        searchTermEl.removeClass('wait');
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
        searchTermEl.removeClass('wait');
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

function scrollToTop() {
    $('html, body').animate({
        scrollTop: 0
    }, 800); // 800 is the duration in milliseconds. You can adjust this value as needed.
}

// Function to handle the appearance of the sidebar menu based on the isSidebarMenuVisible value
function adjustSidebarAppearance(isVisible) {
    if (isVisible) {
        $('#sidebarMenu').find('.hide-text').hide()
        $('#sidebarMenu').find('.collapse').removeClass('show').end()
        //iconAnimation();
        $('#sidebarMenu').animate({ width: '60px' }, 500, function() {
            //$('#sidebarMenu').find('.list-group-item').addClass('text-center');
            $('#sidebarMenu').css("animation", "");
            $('#sidebarMenu').removeClass('open')
            $('#sidebarMenu').fadeOut()
        });
    } else {
        $('#sidebarMenu').fadeIn()
        $('#sidebarMenu').find('.list-group-item').removeClass('text-center').end()
        $('#sidebarMenu').animate({ width: '250px' }, 500, function() {
            $('#sidebarMenu').find('.hide-text').fadeIn();
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
        $('#sidebarMenu').animate({ 'max-height': '100vh' }, 500, function() {
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
$('.remove-memo').on('click', function(e) {
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
$('.add-item').click(function() {
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
    const threshold = 50;

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
function watchAndConvertMarkdown(sourceSelector, outputSelector) {
    // Use showdown library to convert markdown to HTML
    const converter = new showdown.Converter();
    
    function convertMarkdownToHTML(markdownContent) {
        return converter.makeHtml(markdownContent);
    }

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
        const $thisCard = $(`.card.info-container[data-id=${itemID}]`)
        const $spinner = generateSpinnerCard($thisCard)
        if(!$(this).hasClass('fav')){
            $(this).hide()
        }else{
            $(this).find('i').addClass('text-danger')
        }
        $spinner.show()
    // Show the spinner while the download is in progress
      $thisCard.find('.card-body-over').show();
        $.ajax({
            type: "POST",
            url: "/api/downloadFileFromURL",
            data: { url: targetURL,itemID },
            success: function(response) {
                console.log("Success:", response);
                var $video = $('<video>').attr({
                    src: response.url,
                    autoplay: true,
                    muted:true,
                    width:"100%",
                    controls: true,
                    loop:true,
                    playsinline: true
                }).on('loadeddata', function() {
                  // Code to be executed when the video is ready to play
                  console.log('Video ready to play');
                  $thisCard.find('.card-body-over').removeClass('d-flex').hide()
                  //updateMasonryLayout()
              });
                $(`img.card-img-top[data-id=${itemID}]`).before($video)
                $(`img.card-img-top[data-id=${itemID}]`).hide()
                $spinner.hide()
            },
            error: function(error) {
                console.error("Error:", error);
            }
        });

    })
}
function generateSpinnerCard($thisCard){
    // Check if the spinner is already present, if not, create and append it to the card
    if (!$thisCard.find('.spinner-border').length) {
        var $spinner = $('<div>').addClass('spinner-border for-strm position-absolute bg-dark').css({inset:"0px", margin:"auto"}).attr('role', 'status');
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
        const baseExtractor = $(this).data('extractor');
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
    
    extractors.forEach(extractor => {
        extractorContainer.append(`<button class="btn btn-primary extractor mx-2" data-extractor="${extractor}">${extractor}</button>`);
    });
}

function listExtractors() {
    const extractors = [];
    const carouselItems = $('.custom-carousel-container .grid-item');
    
    carouselItems.each(function() {
        const extractor = $(this).data('extractor');
        if (extractor && !extractors.includes(extractor)) {
            extractors.push(extractor);
        }
    });

    console.log({ extractors });
    return extractors;
}
