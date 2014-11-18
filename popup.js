var background;

window.addEventListener("load", function() {
	opera.extension.onmessage = function(event) {
		background = event.source;
		if(event.data == "background") {
			console.log("from background");
			Start();
		} 
	};
}, false);

function Start() {
	opera.extension.onmessage = function(event){
		if(event.source == background) {
			switch(event.data.type){
				case "popup-request-re":
					console.log("Got popup-response");
					console.log(event.data);
			        render(event.data.threads);
				break;
				case "popup-markasread-re":
					render(event.data.threads);
				break;
				case "popup-update-re":
					render(event.data.threads);
				break;
			}
		}
	};

	background.postMessage({ type: "popup-request" });

    var div_default_content =  $('#links-div').html();

    function render(threads) {
        var sorted = _.sortBy(threads, function(thread) { return -thread.unread; });

        var content_div = $('#links-div');

        if(sorted.length  == 0) {
            content_div.html(div_default_content);

        } else {

            content_div.empty();

            renderLinks(sorted);

            $('.read-btn').on('click', function () {
                $(this).attr('src', 'ok_pending.png');
                markAsRead($(this).attr('thread-id'));
                return false;
            });

            $('.update-btn').on('click', function () {
                $(this).attr('src', 'reload_pending.png');
                updateThread($(this).attr('thread-id'));
                return false;
            });
        }

        $('.thread-link').on('click', function () {
            opera.extension.tabs.create({url: $(this).attr('href')});
            return false;
        });

    }

	function markAsRead(num) {
		console.log("markAsRead " + num);
       background.postMessage({ type: "popup-markasread", data: {num: num} });
	}

	function markAsReadAll() {
       background.postMessage({ type: "popup-markasread-all" });
	}

	function openAllUnread() {
		background.postMessage({ type: "popup-open-unread" });
	}

	function updateThread(num) {
       background.postMessage({ type: "popup-update", data: {num: num} });
	}

	function urlhtml(board, num) {
		return "http://2ch.hk/" + board + "/res/" + num + ".html";
	}

	function renderLinks(threads) {
		var sorted = _.sortBy(threads, function(thread) { return -thread.unreads; });
		var links = $('#links-div');

		for(key in sorted) {
			var thread = sorted[key];
			
			// console.log(key, thread);
			// var div_template = '<div> I am <span id="age"></span> years old!</div>';
			links.append(renderLinkRow(thread.board, thread.num, thread.unread, thread.title, thread.not_found_errors, thread.errors));

		}
	}

	function renderLinkRow(board, num, unreads, title, not_found_errors, errors) {
		var style = unreads > 0 ? "style='font-weight: bold'":"";


        var errors_status = vsprintf("%s%s", [not_found_errors > 0 ? " 404 ":"", errors > 0 ? " <span style='color:red'>err</span> ":""]);

		var markAsReadButton = unreads > 0 ? vsprintf(" <img src='images/ok.png' style='cursor:pointer;width: 12px; height: 12px' class=read-btn thread-id=%d>", [num]):"";

		var updateButton = vsprintf(" <img style='cursor: pointer;width: 12px; height: 12px' src='images/reload.png' class=update-btn thread-id=%d> ", [num]);
		
		return vsprintf("<div>(<span %s>%d</span>)%s%s%s<a class=thread-link href='%s' %s> /%s/%d - %s </a></div>",
            [style, unreads, markAsReadButton, updateButton, errors_status, urlhtml(board, num), style, board, num, title]);
	}
};
