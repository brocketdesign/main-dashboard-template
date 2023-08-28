$(document).ready(function() {
    $('#video-summarize').submit(function(event) {
        event.preventDefault();

        const formData = new FormData(this);
        console.log(formData)

        const videoId = $('#video-holder').data('id')
        console.log(videoId)

        const $buttonContainer = $(this).find('button[type="submit"]')
        // Check if the card has already been processed
        if ($buttonContainer.hasClass('done')) {
            handleFormResult(false, 'I am working here') 
            console.log('Card is beeing processed.');
            return;
        }

        // Mark the card as done to avoid processing it again
        $buttonContainer.addClass('done');
        const $spinner = showSpinner($buttonContainer,'summary')

        $.ajax({
            url: '/api/openai-video/summarize?videoId='+videoId, // replace with your endpoint
            method: 'POST',
            data: formData,
            processData: false, // Tell jQuery not to process data
            contentType: false, // Tell jQuery not to set contentType
            success: function(response) {
                handleStream(response, function(message) {

                    const containerID = `card-${response.insertedId}`;
                    const item = message; // Replace with the appropriate value for "item"
                    const doc = response; // Replace with the appropriate value for "doc"
                
                    if($('#' + containerID).length == 0) {
                        const initialCardHtml = designCard(containerID,doc,item)
                        
                        $('#result-summarize').prepend(initialCardHtml);
                        
                        if($('#result-summarize-temp').length == 0){
                            $('#result-summarize').after('<div id="result-summarize-temp" class="d-none"></div>')
                        }

                        updateMoments();
                        console.log(`Initial card created with id: card-${containerID}`);
                    }
                
                    $(`#result-summarize-temp`).append(message);

                    watchAndConvertMarkdown(`#result-summarize-temp`, `#${containerID} .card-body p`); 
                },function(endMessage){
                    console.log(endMessage)
                    $spinner.hide()
                    $buttonContainer.find('i').show();
                    $buttonContainer.removeClass('done');
                    $('#result-summarize-temp').remove()
                });
            },
            error: function(error) {
                console.error(error);
                $spinner.hide()
                $buttonContainer.find('i').show();
                $buttonContainer.removeClass('done');
            },
            finally: function(error) {
                console.error(error);
                $spinner.hide()
                $buttonContainer.find('i').show();
                $buttonContainer.removeClass('done');
            }
        });
    });
  
    $('#video-snsContent').submit(function(event) {
        event.preventDefault();

        const formData = new FormData(this);
        console.log(formData)

        const videoId = $('#video-holder').data('id')
        console.log(videoId)

        const $buttonContainer = $(this).find('button[type="submit"]')
        // Check if the card has already been processed
        if ($buttonContainer.hasClass('done')) {
            handleFormResult(false, 'I am working here') 
            console.log('Card is beeing processed.');
            return;
        }

        // Mark the card as done to avoid processing it again
        $buttonContainer.addClass('done');
        const $spinner = showSpinner($buttonContainer,'summary')

        const postCount = parseInt(formData.get('postCount'));
        console.log(`Generating ${postCount} post(s)`)

        $.ajax({
            url: '/api/openai-video/snsContent?videoId='+videoId, // replace with your endpoint
            method: 'POST',
            data: formData,
            processData: false, // Tell jQuery not to process data
            contentType: false, // Tell jQuery not to set contentType
            success: function(response) {
                for(let i = 1; i <= postCount; i++) {
                    (function(index) {handleStream(response, function(message) {
                        const containerID = `card-${response.insertedId}-${index}`;
                        const item = message; // Replace with the appropriate value for "item"
                        const doc = response; // Replace with the appropriate value for "doc"
                    
                        if($('#' + containerID).length == 0) {
                            const initialCardHtml = designCard(containerID,doc,item)
                            
                        $('#result-snsContent').prepend(initialCardHtml);
                        updateMoments();
                        console.log(`Initial card created with id: card-${containerID}`);
                        }
                    
                        $(`#${containerID} .card-body p`).append(message);
                        },function(endMessage){
                            console.log(endMessage)
                            $spinner.hide()
                            $buttonContainer.find('i').show();
                            $buttonContainer.removeClass('done');
                        });
                  
                    })(i);

                }
            },
            error: function(error) {
                console.error(error);
                $spinner.hide()
                $buttonContainer.find('i').show();
                $buttonContainer.removeClass('done');
            },
            finally: function(error) {
                console.error(error);
                $spinner.hide()
                $buttonContainer.find('i').show();
                $buttonContainer.removeClass('done');
            }
        });
    });
  
    
    $('#video-qa').submit(function(event) {
        event.preventDefault();

        const formData = new FormData(this);
        console.log(formData)

        const videoId = $('#video-holder').data('id')
        console.log(videoId)

        const $buttonContainer = $(this).find('button[type="submit"]')
        // Check if the card has already been processed
        if ($buttonContainer.hasClass('done')) {
            handleFormResult(false, 'I am working here') 
            console.log('Card is beeing processed.');
            return;
        }

        // Mark the card as done to avoid processing it again
        $buttonContainer.addClass('done');
        const $spinner = showSpinner($buttonContainer,'qa')

        $.ajax({
            url: '/api/openai-video/qa?videoId='+videoId, // replace with your endpoint
            method: 'POST',
            data: formData,
            processData: false, // Tell jQuery not to process data
            contentType: false, // Tell jQuery not to set contentType
            success: function(response) {
                handleStream(response, function(message) {

                    const containerID = `card-${response.insertedId}`;
                    const item = message; // Replace with the appropriate value for "item"
                    const doc = response; // Replace with the appropriate value for "doc"
                
                    if($('#' + containerID).length == 0) {
                    const initialCardHtml = designCard(containerID,doc,item)
                        
                        $('#result-qa').prepend(initialCardHtml);
                        
                        if($('#result-qa-temp').length == 0){
                            $('#result-qa').after('<div id="result-qa-temp" class="d-none"></div>')
                        }

                        updateMoments();
                        console.log(`Initial card created with id: card-${containerID}`);
                    }
                
                    $(`#result-qa-temp`).append(message);

                    watchAndConvertMarkdown(`#result-qa-temp`, `#${containerID} .card-body p`); 
                },function(endMessage){
                    console.log(endMessage)
                    $spinner.hide()
                    $buttonContainer.find('i').show();
                    $buttonContainer.removeClass('done');
                    $('#result-qa-temp').remove()
                });
            },
            error: function(error) {
                console.error(error);
                $spinner.hide()
                $buttonContainer.find('i').show();
                $buttonContainer.removeClass('done');
            },
            finally: function(error) {
                console.error(error);
                $spinner.hide()
                $buttonContainer.find('i').show();
                $buttonContainer.removeClass('done');
            }
        });
    });
    $('#video-important').submit(function(event) {
            event.preventDefault();
    
            const formData = new FormData(this);
            console.log(formData)
    
            const videoId = $('#video-holder').data('id')
            console.log(videoId)
    
            const $buttonContainer = $(this).find('button[type="submit"]')
            // Check if the card has already been processed
            if ($buttonContainer.hasClass('done')) {
                handleFormResult(false, 'I am working here') 
                console.log('Card is beeing processed.');
                return;
            }
    
            // Mark the card as done to avoid processing it again
            $buttonContainer.addClass('done');
            const $spinner = showSpinner($buttonContainer,'important')
    
            $.ajax({
                url: '/api/openai-video/important?videoId='+videoId, // replace with your endpoint
                method: 'POST',
                data: formData,
                processData: false, // Tell jQuery not to process data
                contentType: false, // Tell jQuery not to set contentType
                success: function(response) {
                    handleStream(response, function(message) {
    
                        const containerID = `card-${response.insertedId}`;
                        const item = message; // Replace with the appropriate value for "item"
                        const doc = response; // Replace with the appropriate value for "doc"
                    
                        if($('#' + containerID).length == 0) {
                        const initialCardHtml = designCard(containerID,doc,item)
                            
                            $('#result-important').prepend(initialCardHtml);
                            
                            if($('#result-important-temp').length == 0){
                                $('#result-important').after('<div id="result-important-temp" class="d-none"></div>')
                            }
    
                            updateMoments();
                            console.log(`Initial card created with id: card-${containerID}`);
                        }
                    
                        $(`#result-important-temp`).append(message);
    
                        watchAndConvertMarkdown(`#result-important-temp`, `#${containerID} .card-body p`); 
                    },function(endMessage){
                        console.log(endMessage)
                        $spinner.hide()
                        $buttonContainer.find('i').show();
                        $buttonContainer.removeClass('done');
                        $('#result-important-temp').remove()
                    });
                },
                error: function(error) {
                    console.error(error);
                    $spinner.hide()
                    $buttonContainer.find('i').show();
                    $buttonContainer.removeClass('done');
                },
                finally: function(error) {
                    console.error(error);
                    $spinner.hide()
                    $buttonContainer.find('i').show();
                    $buttonContainer.removeClass('done');
                }
            });
    });  
});

  function designCard(containerID,doc,item){
    return `<div class="card mb-3" id="${containerID}" data-id="${doc._id}"><div class="card-top p-3 d-flex align-items-center justify-content-between"><div class="tools d-flex align-items-center"><a class="btn tool-button share mx-2" onclick="handleShareButton(this)" data-toggle="tooltip" title="Twitterでシェア"><i class="fas fa-share-alt"></i></a><badge class="btn tool-button tool-button-copy mx-2" data-toggle="tooltip" title="コピー"><i class="fas fa-copy"></i></badge></div><div class="text-end text-sm text-muted" style="font-size:12px"><div class="custom-date" data-value="${new Date()}"></div></div></div><div class="card-body py-0"><p>${item}</p></div></div>`;
   }