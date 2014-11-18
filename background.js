var popup;
var button;

var properties = {
  disabled: false,
  title: "Двачмонитор",
  icon: "images/icon_18.png",
  popup: {
    href: 'popup.html', 
    width: 600, 
    height: 200 
  },
  badge: {
    display: 'block',
    backgroundColor: '#5566ff',
    color: '#ffffff',
    textContent: '0'
  }
};	

// Create and add the button to the toolbar
button = opera.contexts.toolbar.createItem(properties);
opera.contexts.toolbar.addItem(button);

opera.extension.onconnect = function(event) {
	console.log("onconnect");
	popup = event.source;
	event.source.postMessage("background");
};

var Settings = {
	minimumDelay: 10,
	maximumPeriod: 600,
	factor: 1.5,
    domain: "2ch.hk",
    count_threads: true
};

var MonitorData = {
    threadsMap: Immutable.Map({}),
	debug: true
};

var Monitor = {
	log: function (msg) {
		if(MonitorData.debug)
			console.log(msg);
	}
};

var MyAlarm = {
	names: [],
	timers: [],
	addListener: function (listener) {
		this.functions.push(listener);
		document.addEventListener('testevent3', listener, false);
	},
	
	removeListener: function (listener) {
		document.removeEventListener('testevent3', listener, false);
	},
	
	clear: function (Name) {
		var index = this.names.indexOf(Name);
		clearInterval(this.timers[index]);
		delete this.names[index];
		delete this.timers[index];
	},
	
	create: function (Name, Delay) {
		if (this.names.indexOf(Name) > -1)
		{
			console.log("RETURN indexOf");
			return;
		}
		else
		{
			this.names.push(Name);
			this.timers.push(setInterval(function() {
				document.dispatchEvent( new CustomEvent('testevent3', { 'detail': Name }) );
				
			}, Delay));
			console.log("CREATE alarm");
		}
	}
};

function updateCounter() {
    var threads = Threads.getAllAsObjects();
    var totalUnreads = 0;

    for(var key in threads) {
        if(threads.hasOwnProperty(key)) {
            totalUnreads += Settings.count_threads ? (threads[key].unread > 0 ? 1 : 0) : threads[key].unread;
        }
    }
    button.badge.textContent = totalUnreads.toString();
}

var Threads = {
    /** @returns {Immutable.Map}*/
	getThread: function (num) {
		return MonitorData.threadsMap.get(num.toString());
	},

	deleteThread: function (num) {
        MonitorData.threadsMap = MonitorData.threadsMap.delete(num.toString());
        Storage.saveThreads();
	},

    /**
     * Возвращает треды в виде Immutable.Map
     * @returns {Immutable.Map}*/
	getAll: function() {
		return MonitorData.threadsMap;
	},

    /** Возвращает треды в виде js-объекта
     * @returns {Object}*/
    getAllAsObjects: function() {
        return MonitorData.threadsMap.map(function(threadMap) { return threadMap.toObject(); }).toObject();
    },

    /**
     * Сохраняет и возвращает тред. Единственная функция, сохраняющая тред
     * @returns {Immutable.Map}
     * @param {Immutable.Map} thread
     * */
	pushThread: function(thread) {

        if(_.isUndefined(thread)) {
            throw new Error("Pushing undefined");
        }

        MonitorData.threadsMap = MonitorData.threadsMap.set(thread.get("num").toString(), thread);

        Storage.saveThreads();

        return thread;
	},

    /** @returns {Boolean}*/
	has: function(num) {
		// return (num in MonitorData.threads);
		return MonitorData.threadsMap.has(num.toString());
	},

	loadFromObjects: function(threadsObject) {
		MonitorData.threadsMap = Immutable.fromJS(threadsObject);
        updateCounter();
	},

    /**
     * Создает тред в виде Immutable.Map
     * @returns {Immutable.Map}*/
    createThread: function (num, board, title, last_post) {

        var thread = Immutable.Map({
            num: num.toString(),            // id треда
            board: board,                   // доска
            title: title,
            last_post: last_post,           // последний пост в треде
            last_update: currentTime(),
            unread: 0,                      // количество непрочитанных постов
            delay: Settings.minimumDelay,   // предыдущая задержка
            not_found_errors: 0,            // количество ошибок 404
            errors: 0                       // количество ошибок соединения
        });

        Monitor.log("a new data received " + JSON.stringify(thread));

        return thread;
    },

    /**
     * Возвращает тред помеченным как прочитанный
     * @param {Immutable.Map} threadMap
     * @param {number=} last_post
     * @returns {Immutable.Map}
     * */
    markThreadAsRead: function (threadMap, last_post) {

        if(_.isUndefined(threadMap))
            throw new Error("Got undefined in undefined undefined");

        if(threadMap.get("errors") == 0 && threadMap.get("not_found_errors") == 0)
            if(_.isUndefined(last_post))
                return threadMap.set("unread", 0);
            else
                return threadMap.set("unread", 0).set("last_post", last_post);
        else
            return threadMap;
    }
};

var Storage = {
	saveThreads: function() {
		widget.preferences.settings = JSON.stringify(Settings);
		widget.preferences.threads = JSON.stringify(Threads.getAllAsObjects());
		Monitor.log("saved to the storage");
	},

	load: function( func ) {
		console.log("load");  
        if (widget.preferences.settings)
        	Settings = JSON.parse(widget.preferences.settings);
        
		if (widget.preferences.threads)
			Threads.loadFromObjects(JSON.parse(widget.preferences.threads));
		else
			Threads.loadFromObjects({});
		
		console.log("Threads.getAll "+JSON.stringify(Threads.getAll()));
        func(Threads.getAll());
	}
};

var Scheduler = {

    listeners: [],

    addListener: function(num, listener) {
        if (_.isUndefined(this.listeners[num])) {
            this.listeners[num] = [];
        }
		console.log("addListener");
        this.listeners[num].push(listener);

        document.addEventListener('testevent3', listener, false);
    },

    clearListeners: function(num) {
        if(_.isUndefined(this.listeners[num])) {
            this.listeners[num] = [];
        } else {
            for (var i = 0; i < this.listeners[num].length; i++) {
                Monitor.log("removing " + num + " listener " + i);
                
                document.removeEventListener('testevent3', this.listeners[num][i], false);
            }
			MyAlarm.clear(num.toString());
            this.listeners[num] = [];
        }
    },

	unscheduleTask: function (num) {
        Monitor.log("Unscheduling " + num);
        this.clearListeners(num);
		MyAlarm.clear(num.toString());
		Monitor.log("Unscheduling **********" + num);
	},

	scheduleTask: function (num, func, delaySecs) {
		Monitor.log("a task for " + num + " scheduled after " + secsToMins(delaySecs) + "minutes");

		MyAlarm.create(num.toString(), delaySecs*1000);

        var self = this;

		var listener = function(event) {
			console.log("listener ++++++++++++ event.detail: "+event.detail);
			
		    if (event.detail == num.toString()) {
		    	console.log("alarm.detail "+event.detail);
                self.clearListeners(num);
		        func();
		    }
		};

        this.addListener(num, listener);
	}
};

/**
 * Занимается проверкой обновлений
 * */
var Updater = {

    /**
     * Возвращает задержку перед следующей проверкой
     * @param {number} previousDelay предыдущая задержка */
    getUpdateDelay: function(previousDelay) {

        if(_.isNaN(previousDelay))
            throw new Error("This wonderful javascript world");

        var d = previousDelay * Settings.factor;

        if(d < Settings.minimumDelay)
            return Settings.minimumDelay;
        else if(d > Settings.maximumPeriod)
            return Settings.maximumPeriod;
        else
            return d;
    },

    /**
     * проверяет обновления для треда, возвращает объект result
     * @returns {Object}
     * @param {Immutable.Map} threadMap
     * */
	getUpdates: function(threadMap) {

        assert(!_.isUndefined(threadMap), "welcome to undefined world");

        var thread = threadMap.toObject();

        var resp = httpGet(url(Settings.domain, thread.board, thread.num));

        if(resp == "CONNECTION_ERROR" || _.isUndefined(resp)) {
            return {unread: -1, last_post: -1, not_found: false, error: true};
        } else if (resp == "NOT_FOUND") {
            return {unread: -1, last_post: -1, not_found: true, error: false};
        } else {

            var newData = JSON.parse(resp);

            var newPostsCount = 0;

            if (newData.max_num != thread.last_post) {
                newPostsCount = _.filter(
                    newData.threads[0].posts,
                    function (post) {
                        return (post.num > thread.last_post);
                    }).length;
            }

            return {unread: newPostsCount, last_post: newData.max_num, not_found: false, error: false};
        }
	},

    /**
     * запускает рекурсивный цикл обновлений
     * Цикл отменяется при помочи Scheduler.unscheduleTask(num)
     * @param {Immutable.Map} threadMap
     * @param {number=} delay задержка перед проверкой, по умолчанию Settings.minimumDelay
     * */
    runMonitoring: function(threadMap, delay) {
        var self = this;

        //Monitor.log("scheduling " + threadMap.get('num') + " after " + delay);

        Scheduler.scheduleTask(
            threadMap.get('num'),
            function() {
				console.log("scheduleTask func tttttttt+");
                var checkResult = self.getUpdates(threadMap);
                var applied = self.applyResultToThread(threadMap, checkResult);

                if(checkResult.unread > 0) {
                    self.runMonitoring(
                        Threads.pushThread (
                            applied.set("delay", Settings.minimumDelay)
                        ), Settings.minimumDelay);

                    updateCounter();

                } else {    // иначе запускаем с увеличенной задержкой

                    var newDelay = self.getUpdateDelay(_.isUndefined(delay) ? Settings.minimumDelay : delay);

                    assert(!_.isNaN(newDelay), "ebal ruka");

                    self.runMonitoring(
                        Threads.pushThread(applied.set("delay", newDelay)),
                        newDelay
                    );
                }

            },
            _.isUndefined(delay) ? Settings.minimumDelay : delay
        );},

    /**
     * применяет результат функции getUpdates к треду
     * @return {Immutable.Map}
     * @param {Immutable.Map} threadMap
     * @param {object} result
     * @param {number} result.unread
     * @param {number} result.last_post
     * */
    applyResultToThread: function (threadMap, result) {

        if(result.not_found) {
            return threadMap.set("not_found_errors", threadMap.get("not_found_errors") + 1);
        } else if(result.error) {
            return threadMap.set("errors", threadMap.get("errors") + 1);
        } else if(result.unread > 0) {
            return threadMap.
                    set("unread", threadMap.get("unread") + result.unread).
                    set("last_update", currentTime()).
                    set("errors", 0).
                    set("not_found_errors", 0).
                    set("last_post", result.last_post);
        } else {
            return threadMap.set("errors", 0).set("not_found_errors", 0);
        }
    },

    getUpdatedThread: function(threadMap) {
        return this.applyResultToThread(
            threadMap,
            this.getUpdates(threadMap)
        );
    }
};

(function(){
    Monitor.log("started");
    button.badge.textContent = "0";
    
    //console.log("Threads.getAllAsObjects() "+Threads.getAllAsObjects()[0]);

    Storage.load(function(threads){
        Monitor.log("Data loaded from local storage " + threads);

        var stupidFuckingJavascript = threads.toObject();

        for(var k in stupidFuckingJavascript){
            if(stupidFuckingJavascript.hasOwnProperty(k))
                Updater.runMonitoring(Threads.getThread(k), 0);
        }

        initListener();
    });
   
   //initListener();
})();

/**
 * Обработчик сообщений
 * */
function initListener() {
	opera.extension.onmessage = function(event) {
		//var sender = event.source;
		var request = event.data;
  	    switch(request.type) {
            case "thread-added":

			    var threadData = request.data;

                var thread = Threads.pushThread(
                    Threads.createThread(
                        threadData.num,
                        threadData.board,
                        threadData.title,
                        threadData.last_post
                    )
                );

                // если добавлено с главной, то начинаем мониторить
                // иначе юзер сидит в треде и мониторить его смысла нет
                if(threadData.from_main)
                    Updater.runMonitoring(thread);
            break;

            case "thread-removed":

                Monitor.log("removed");
                if(Threads.has(request.data.num)) {
                    Monitor.log("removing " + request.data.num);
                    Scheduler.unscheduleTask(request.data.num);
                    Threads.deleteThread(request.data.num);
                    updateCounter();
                }

            break;

            /**
             * Если битард вернулся во вкладку, то отмечаем ее как прочитанную и перестаем мониторить
             * */

            case "window-focused":
                Monitor.log("focused");
                if(Threads.has(request.data.threadId)) {
                    Scheduler.unscheduleTask(request.data.threadId);

                    Threads.pushThread(
                        Threads.markThreadAsRead(
                            Threads.getThread(request.data.threadId),
                            request.data.last_post)
                    );
                    updateCounter();
                }
            break;

            /**
             * Если битард свернул вкладку, то отмечаем ее как прочитанную и начинаем мониторить
             * */

            case "window-blured":
                Monitor.log("unfocused");
                Monitor.log("unfocused + request.data "+request.data.type+request.data.threadId);
                if(Threads.has(request.data.threadId)) {
                    Scheduler.unscheduleTask(request.data.threadId);
                    Updater.runMonitoring(
                        Threads.pushThread(
                            Threads.markThreadAsRead(
                                Threads.getThread(request.data.threadId),
                                request.data.last_post
                            )
                        )
                    );

                }
            break;

            /**
             * Если битард открыл страницу, то отмечаем ее как прочитанную и перестаем мониторить
             * */
            case "thread-loaded":
                Monitor.log("loaded");

                if(Threads.has(request.data.threadId)) {
                    Scheduler.unscheduleTask(request.data.threadId);

                    Threads.pushThread(
                        Threads.markThreadAsRead(
                            Threads.getThread(request.data.threadId),
                            request.data.last_post)
                    );
                    updateCounter();
                }
            break;

            /**
             * Если битард закрыл страницу, то отмечаем ее как прочитанную и начинаем мониторить этот тред
             * */
            case "window-unload":
                Monitor.log("unloaded");
                if(Threads.has(request.data.threadId)) {
                    Scheduler.unscheduleTask(request.data.threadId);
                    Updater.runMonitoring(
                        Threads.pushThread(
                            Threads.markThreadAsRead(
                                Threads.getThread(request.data.threadId),
                                request.data.last_post)
                        )
                    );

                }
            break;

            /**
             * Подгружает избранное с двоща. Добавляет только то, чего еще нет в Threads
             * */
            case "storage-favorites":
                Monitor.log("storage-favorites");
                Monitor.log(request.data);

                var favs = request.data;

                var newFavsNums = _.filter(
                    Object.keys(favs),
                    function(key) {
                        return !Threads.has(key) && !(favs[key].title == undefined);
                    });

                _.forEach(newFavsNums, function(num){
                    var fav = favs[num];
                    Updater.runMonitoring(
                        Threads.pushThread(
                            Threads.createThread(num, fav.board, fav.title, fav.last_post)
                        ),
                        0
                    );
                });

                Monitor.log(newFavsNums);
            break;

            /**
             * реквесты из popup.html
             * */
            case "popup-request":
                Monitor.log("Got popup-request");
                //sendResponse({threads: Threads.getAllAsObjects()});
                event.source.postMessage({type: "popup-request-re", threads: Threads.getAllAsObjects()});
            break;

            case "popup-markasread":

                Monitor.log("Got popup-markasread");
                var num = request.data.num;

                if(Threads.has(num)) {
                    Scheduler.unscheduleTask(num);

                    Updater.runMonitoring(
                        Threads.pushThread(
                            Threads.markThreadAsRead(
                                Updater.getUpdatedThread(
                                    Threads.getThread(num)
                                ))),
                        Threads.getThread(num).get("delay")
                    );

                    updateCounter();
                    //sendResponse({threads: Threads.getAllAsObjects()});
                    event.source.postMessage({type: "popup-markasread-re", threads: Threads.getAllAsObjects()});
                }


            break;

            case "popup-update":

                Monitor.log("popup-update");
                var num = request.data.num;

                if(Threads.has(num)) {
                    Scheduler.unscheduleTask(num);
                    Updater.runMonitoring(
                        Threads.pushThread(
                                Updater.getUpdatedThread(
                                    Threads.getThread(num)
                                )),
                        Threads.getThread(num).get("delay")
                    );
                    //sendResponse({threads: Threads.getAllAsObjects()});
                    event.source.postMessage({type: "popup-update-re", threads: Threads.getAllAsObjects()});
                }

            break;
        }
	};
};
