// ==UserScript==
// @include https://2ch.hk/*
// @include http://2ch.hk/*
// @include https://2ch.pm/*
// @include http://2ch.pm/*
// ==/UserScript==

var background;
var connected = false;

// TODO: add "script.js" to web_accessible_resources in manifest.json

window.addEventListener("load", function(event) {
	opera.extension.onmessage = function(event) {
		if(event.data == "background") {
			background = event.source;
			connected = true;
			console.log("from background");
		} 
	};
	
	
	console.log(window.thread.id);
	var fileObj = opera.extension.getFile("/hook.js");
	
	if (fileObj) {
	    var fr = new FileReader();
	    fr.onload = function() {              
	        var libScript = document.createElement("script");
	        libScript.onload = function() {
			    this.parentNode.removeChild(this);
			};
	        libScript.textContent = fr.result;
	        document.body.appendChild(libScript);
	    };
	    fr.readAsText(fileObj);
   }
   
   window.addEventListener("message", function(event) {

	if (event.source != window)
		return;
	
	if (event.data.type && (event.data.type == "thread-added")) {
		console.log("User added thread: " + event.data.data);
	}	
	
	if (event.data.type && (event.data.type == "thread-removed")) {
		console.log("User removed thread: " + event.data.data);
	}
	
	if(connected)
		background.postMessage(event.data);

	}, false);
});
