
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

var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

feather.replace()

$(document).ready(function() {
  selectSingleTagPerCategory();
  initializeSelectedTagNames()
  autosize(document.querySelector('#prompt-input'));
  const promptInput = document.querySelector('#prompt-input');
  if(promptInput){
    promptInput.addEventListener('input', () => {
      autosize(promptInput);
    });
  }
  


  
  $(document).on('click','[data-id^="category-"]',function() {
    const subcategoryElement = $(`[data-id="subcategory-${$(this).data('id').split('-')[1]}"]`);
    //$('.categories').toggle()
    $(`.categories[data-id="${$(this).attr('data-id')}"]`).show()
    subcategoryElement.toggle();
  });

  $('[data-id^="subcategory-"]').click(function(event) {
    event.stopPropagation();

    $(this).closest('.col').toggleClass('col-12')
    const subcategoryElement = $(`[data-id="subcategory-${$(this).data('id').split('-')[1]}"]`);
    subcategoryElement.find('.card-body[data-id^="subcategory-"]').each(function(){$(this).closest('.col').toggle()})
    $(this).closest('.col').show()

    const tagElements = $(`[data-id^="tag-${$(this).data('id').split('-')[1]}-${$(this).data('id').split('-')[2]}"] .tags`);
    tagElements.click(function(event) {
      event.stopPropagation();
      $(this).toggleClass('selected');

      $(`.tag[data-id="category-${$(this).data('id').split('-')[0]}"]`).text('')
      if($(this).hasClass('selected')){
        $(`.tag[data-id="category-${$(this).data('id').split('-')[0]}"]`).text($(this).text())
      }
      initializeSelectedTagNames()
      updatePrompt()
      
      const data = {
        category_id: $(this).data('id').split('-')[0],
        subcategory_id: $(this).data('id').split('-')[1],
        tag_id: $(this).data('id').split('-')[2]
      };
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
    });
    const tagElement = $(`[data-id="tag-${$(this).data('id').split('-')[1]}-${$(this).data('id').split('-')[2]}"]`);
    tagElement.toggle();
  });
});
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
function initializeSelectedTagNames() {
  $('section.selected-tags').html('')
  $('.tags.selected').each(function() {
    const categoryID = $(this).data('id').split('-')[0];
    const tagName = $(this).text();
    $(`.tag[data-id="category-${categoryID}"]`).text(tagName);
    const badge = $('<button>').addClass('badge bg-primary m-2 p-3').addClass(`tag`).attr('data-id',`category-${categoryID}`).text(tagName);
    $('.selected-tags').append(badge);
  });

}
function togglePrompt(el){
  $(el).parent().find('.gallery-prompt').toggle()
}
function selectSingleTagPerCategory() {
  const selectedTags = {};
  $('.tags.selected').each(function() {
    const [categoryID, subcategoryID, tagID] = $(this).data('id').split('-');
    selectedTags[categoryID] = { subcategoryID, tagID };
  });

  $('.tags').click(function(event) {
    event.stopPropagation();
    const [categoryID, subcategoryID, tagID] = $(this).data('id').split('-');
    if (selectedTags[categoryID] && selectedTags[categoryID].subcategoryID !== subcategoryID) {
      $(`[data-id^="${categoryID}-"][class*="selected"]`).removeClass('selected');
    }
    if (selectedTags[categoryID] && selectedTags[categoryID].tagID !== tagID) {
      $(`[data-id="${categoryID}-${subcategoryID}-${selectedTags[categoryID].tagID}"]`).removeClass('selected');
    }
    selectedTags[categoryID] = { subcategoryID, tagID };
    
  });
}

function generateDiffusedImage() {
  $('.loader').addClass('d-flex').show();
  $('#generate-button').hide()
  const inputString = $('#prompt-input').val();

  console.log('Making request with input string:', inputString);

  fetch('/api/image', { // Update the URL to match the API endpoint on your Node.js server
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt: inputString, negative_prompt: '' }) // Modify the payload based on your requirements
  })
    .then(response => {
      console.log('Received response:', response);

      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status} ${response.statusText})`);
      }

      return response.json(); // Use response.json() to parse the JSON response
    })
    .then(data => {
      const base64Image = data.image; // Retrieve the base64 image data from the response
      $('#diffused-image-gallery').prepend('<div class="image-content col-12 col-sm-6 position-relative mb-3"></>')
      const container =  $('#diffused-image-gallery .image-content').first()
      const promptElement = `<div class="gallery-prompt bg-dark text-white position-absolute card" style="display:none;bottom:10px;right:20px;left:20px"><div class="card-body py-3"><h6>Prompt</h6><span class="gallery-prompt-text">${inputString}</span></div></div><span class="gallery-prompt-toggle position-absolute" type="button" style="bottom:20px;right:20px" data-feather="info" color="white" onclick="togglePrompt(this)">Toggle Prompt Visibility</span>`;
      container.prepend(promptElement);
      
      // Create an <img> element
      const img = document.createElement('img');
      img.setAttribute('src', `data:image/png;base64, ${base64Image}`);
      img.setAttribute('class', 'img-fluid');

      container.prepend(img);
    })
    .catch(error => {
      console.error('Error generating diffused image:', error);
    })
    .finally(() => {
      $('.loader').hide().removeClass('d-flex');
      $('#generate-button').show()
      feather.replace()
    });
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
    const categoryName = $(this).closest('[data-id^="category-"]').find('.card-title').eq(0).attr('data-name');
    const subcategoryName = $(this).closest('.card-body[data-id^="subcategory-"]').find('.card-title').eq(0).attr('data-name');
    const tagName = $(this).find('.card-title').attr('data-name');
    selectedTags.push(`${categoryName} ${subcategoryName} ${tagName}`);
  });
  const inputString = selectedTags.join(', ');  
  $('#prompt-input').val(inputString)
  console.log(inputString)
  //$('#prompt-input').val().length > 0 ? $('#prompt-input').val($('#prompt-input').val().replace(inputString,'')+','+inputString) : $('#prompt-input').val(inputString)
}
