document.addEventListener('DOMContentLoaded', (event) => {
    // Ensure the DOM is fully loaded
    const chatInput = document.querySelector('#chat-input-section input'); // Adjust the selector if your input has a more specific identifier
    const submitButton = document.querySelector('#chat-input-section button[type="submit"]');
  
    // Check if both the input and the button are found
    if(chatInput && submitButton) {
      chatInput.addEventListener('keypress', function(e) {
        // Check if Enter is pressed without the Shift key
        if(e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault(); // Prevent the default action to avoid submitting the form or adding a new line
          submitButton.click(); // Trigger the button click
        }
      });
    }
  });

  $(document).ready(function(){
    handleChat();
    handleChatHistory();
  })


const handleScrollDownButton = () => {
    if ($('#chat-input-section').length && $('.floating-chat').length == 0) {
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

          // Calculate the distance from the bottom
            var scrollPosition = $(this).scrollTop() + $(this).innerHeight();
            var nearBottom = $(this)[0].scrollHeight; // Adjust '100' based on your needs

            allowAutoScroll = scrollPosition >= nearBottom;

    });
    $('.scroll-down').on('click', function() {
        scrollChatDown(true)
        return false;
    });
}
let allowAutoScroll = true; // Global flag to control auto-scroll behavior

function scrollChatDown(forceScroll = false) {
    if(forceScroll){
        $('.chat-window').stop().animate({ scrollTop: $('.chat-window')[0].scrollHeight }, 'slow');
        return
    }
    if (allowAutoScroll) {
        $('.chat-window').stop().animate({ scrollTop: $('.chat-window')[0].scrollHeight }, 'slow');
    }
}

function toggleFloatingChat(){
    $('.floating-chat').toggle()
    scrollChatDown(true);
}

function handleChatHistory(){
    $.get('/api/openai/chat',function(data){
        data.forEach(function(item){
            const $messages = $('#messages');
            const $template = $('.template').clone().removeAttr('style class');
            
            // Add user message
            $template.addClass('p-4 bg-white');
            $template.find('.userName').text('ユーザー');
            $template.find('.message').addClass('user bg-white').text(item.prompt);
            $template.find('.time').text(new Date(item.prompt_time).toLocaleTimeString('ja-JP'));
            $messages.append($template);

            const $agentTemplate = $('.template').clone().removeAttr('style class');
            
            $agentTemplate.addClass('p-4 text-end bg-dark text-white');
            $agentTemplate.find('.userName').text('エージェント');
            $agentTemplate.find('.time').text(new Date(item.completion_time).toLocaleTimeString('ja-JP'));
            $agentTemplate.find('.message').addClass('agent text-start').attr('id',item._id).text(item.completion ? item.completion[0] : '')
            $messages.append($agentTemplate);
        });
        $(document).find('.chat-message.agent').each(function(){
            const text = $(this).text()
            const HTML = convertMarkdownToHTML(text)
            $(this).html(HTML)
        })
    })
}


const handleChat = () => {

    //Convert all message to HTML
    $('.chat-message.agent').each(function(){
        const text = $(this).text()
        const HTML = convertMarkdownToHTML(text)
        $(this).html(HTML)
    })

    $('.close-chat').on('click',function(){
        $('.floating-chat').hide()
    })

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
                prompt:prompt,
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
                    }
                    
                    $(`#temp-${response.insertedId}`).append(message);
                    ConvertMarkdown(`#temp-${response.insertedId}`, `#${response.insertedId}`); 
                    scrollChatDown();
                });
     
                $this.find('.spinner-border').remove(); // remove spinner
                $this.find('i').show(); // show plane icon

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
   