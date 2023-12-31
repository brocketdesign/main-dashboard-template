$(document).ready(function() {
    $('#video-summarize').submit(function(event) {
        event.preventDefault();

        const formData = new FormData(this);
        console.log(formData)

        const videoId = $('#video-holder').data('id')
        console.log(videoId)

        const $buttonContainer = $(this).find('button[type="submit"]')
        if (shouldPreventSubmission($buttonContainer)) { return; }

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

                let containerID
                const sourceInstance = handleStream(response, function(message) {

                    containerID = `card-${response.insertedId}`;
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
                    $(`#${containerID} .card-body p`).append(message);

                },function(endMessage){
                    console.log(endMessage)
                    watchAndConvertMarkdown(`#result-summarize-temp`, `#${containerID} .card-body p`); 
                    resetButton($spinner,$buttonContainer)
                    $('#result-summarize-temp').remove()
                });

                handleGenerationStop(sourceInstance,$spinner,$buttonContainer)
            },
            error: function(error) {
                console.error(error);
                resetButton($spinner,$buttonContainer)
            },
            finally: function(error) {
                console.error(error);
                resetButton($spinner,$buttonContainer)
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
        if (shouldPreventSubmission($buttonContainer)) { return; }

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
                let sourceInstances = {};
                let containerID

                for(let i = 1; i <= postCount; i++) {
                    (function(index) {
                        let source =  handleStream(response, function(message) {
                            containerID = `card-${response.insertedId}-${index}`;
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
                                resetButton($spinner,$buttonContainer)
                            });
                                
                        // Store the source instance for this generation
                        sourceInstances[`source-${index}`] = source;
                    })(i);

                }

                handleGenerationStop(sourceInstances,$spinner, $buttonContainer)
            },
            error: function(error) {
                console.error(error);
                resetButton($spinner,$buttonContainer)
            },
            finally: function(error) {
                console.error(error);
                resetButton($spinner,$buttonContainer)
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
        if (shouldPreventSubmission($buttonContainer)) { return; }

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
                let containerID
               const sourceInstance = handleStream(response, function(message) {

                    containerID = `card-${response.insertedId}`;
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
                    $(`#${containerID} .card-body p`).append(message);

                },function(endMessage){
                    console.log(endMessage)
                    watchAndConvertMarkdown(`#result-qa-temp`, `#${containerID} .card-body p`); 
                    resetButton($spinner,$buttonContainer)
                    $('#result-qa-temp').remove()
                });

                handleGenerationStop(sourceInstance,$spinner,$buttonContainer)
            },
            error: function(error) {
                console.error(error);
                resetButton($spinner,$buttonContainer)
            },
            finally: function(error) {
                console.error(error);
                resetButton($spinner,$buttonContainer)
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
            if (shouldPreventSubmission($buttonContainer)) { return; }

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
                    let containerID
                    const sourceInstance = handleStream(response, function(message) {
    
                        containerID = `card-${response.insertedId}`;
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
                        $(`#${containerID} .card-body p`).append(message);
    
                    },function(endMessage){
                        console.log(endMessage)
                        watchAndConvertMarkdown(`#result-important-temp`, `#${containerID} .card-body p`); 
                        resetButton($spinner,$buttonContainer)
                        $('#result-important-temp').remove()
                    });
                    handleGenerationStop(sourceInstance,$spinner,$buttonContainer)

                },
                error: function(error) {
                    console.error(error);
                    resetButton($spinner,$buttonContainer)
                },
                finally: function(error) {
                    console.error(error);
                    resetButton($spinner,$buttonContainer)
                }
            });
    });  
});

function handleGenerationStop(sourceInstance,$spinner,$buttonContainer){
    $($buttonContainer).on('click',function(){
        handleFormResult(false, 'AI 生成停止 ') 
        stopStreams(sourceInstance)
        resetButton($spinner,$buttonContainer)
        $buttonContainer.addClass('stop')
    })
}
function resetButton($spinner,$buttonContainer){
    $spinner.hide()
    $buttonContainer.find('i').show();
    $buttonContainer.removeClass('done bg-danger').text('生成する')
}
function shouldPreventSubmission($buttonContainer) {
    $buttonContainer.addClass('bg-danger').text('AI生成を停止')
    if ($buttonContainer.hasClass('stop')) {
        console.log("Form submission prevented due to 'stop' class.");
        $buttonContainer.removeClass('stop')
        return true;
    }
    return false;
}
function designCard(containerID,doc,item){
return `<div class="card mb-3" id="${containerID}" data-id="${doc._id}"><div class="card-top p-3 d-flex align-items-center justify-content-between"><div class="tools d-flex align-items-center"><a class="btn tool-button share mx-2" onclick="handleShareButton(this)" data-toggle="tooltip" title="Twitterでシェア"><i class="fas fa-share-alt"></i></a><badge class="btn tool-button tool-button-copy mx-2" data-toggle="tooltip" title="コピー"><i class="fas fa-copy"></i></badge></div><div class="text-end text-sm text-muted" style="font-size:12px"><div class="custom-date" data-value="${new Date()}"></div></div></div><div class="card-body py-0"><p>${item}</p></div></div>`;
}