/*global FTSS, $alert */

FTSS.ng.service('utilities', [

	'loading',
	'$timeout',
	'$rootScope',
	'$route',
	'$location',
	'sharepointFilters',
	'$alert',
	'$modal',
	'$http',
	'dateTools',
	'security',

	function (loading, $timeout, $rootScope, $route, $location, sharepointFilters, $alert, $modal, $http, dateTools, security) {

		var _jobs = [],

			/**
			 * @name utilities
			 */
			_self = this,

			_completed = {
				'selectize': false,
				'security' : false
			};

		/**
		 * Collects async operations that are only executed once the page is initialized
		 *
		 * @name utilities#addAsync
		 * @param {Function} job
		 */
		this.addAsync = function (job) {

			// If already loaded, just execute immediately
			if (_.all(_completed)) {
				$timeout(job);
			} else {
				_jobs.push(job);
			}

		};

		/**
		 * Disables the page spinner/loading functions and marks everything as complete
		 *
		 * @name utilities#setLoaded
		 * @param {Function} callback
		 */
		this.setLoaded = function (callback) {

			_TIMER.add('loaded');

			callback && callback();

			$timeout(function () {
				$rootScope.loaded = true;
			});

			loading(false);

		};

		/**
		 * Used to create a permaLink for a given page for bookmarking/sharing
		 *
		 * @name utilities#setPermaLink
		 */
		this.setPermaLink = function () {

			var _originalRoute = $route.current,

				_once = $rootScope.$on('$locationChangeSuccess', function () {

					$route.current = _originalRoute;
					_once();

				});

			$location.path(
				[
					$rootScope.ftss.viewTitle,
					btoa(JSON.stringify($rootScope.ftss.tagMap) || ''),
					btoa($rootScope.ftss.searchText || '')

				].join('/'));

		};

		/**
		 * Performs our page navigation function
		 *
		 * @name utilities#navigate
		 * @param {String} page
		 */
		this.navigate = function (page) {

			// Only navigate for a different page
			if (page !== $rootScope.ftss.viewTitle) {

				loading(true);

				$rootScope.ftss.searchText = '';

				$location.path('/' + page);

			}

		};

		/**
		 * Modal dialog helper
		 *
		 * @name utilities#modal
		 * @param template
		 * @param $scope
		 */
		this.modal = function (template, $scope) {

			var modal = $modal(
					{
						'placement'      : $scope.modalPlacement || 'top',
						'contentTemplate': '/partials/' + template + '.html',
						'scope'          : $scope,
						'show'           : true
					}),

				scope = modal.$scope;

			scope.close = modal.destroy;

			return scope;

		};

		/**
		 * Our app-wide alert notification system
		 */
		window.$alert = this.alert = (function () {

			return {

				// @name utilities.alert.generic
				'generic': builder,

				// @name utilities.alert.create
				'create': function () {
					builder({'title': 'Record Created!'});
				},

				// @name utilities.alert.update
				'update': builder,

				// @name utilities.alert.error
				'error': function (err) {

					_self.errorHandler(err);

					builder({
						'type'    : 'danger',
						'title'   : 'Sorry, something went wrong!',
						'content' : "Please refresh the page and try again.",
						'duration': 20
					});
				}
			};

			/**
			 *
			 * @param {Object} opts
			 */
			function builder(opts) {

				$alert(_.defaults(opts || {}, {
					'title'    : 'Record Updated!',
					'content'  : 'Your changes were saved successfully.',
					'placement': 'top-right',
					'type'     : 'success',
					'duration' : 3,
					'show'     : true
				}));

			}

		}());

		/**
		 * Performs nested property lookups without eval or switch(e.length), removed try {} catch(){}
		 * due to performance considerations.  Uses a short-circuit for invalid properties & returns false.
		 *
		 * data = {
				 *   a1: { b1: "hello" },
				 *	 a2: { b2: { c2: "world" } }
				 *	}
		 *
		 * deepRead(data, "a1.b1") => "hello"
		 *
		 * deepRead(data, "a2.b2.c2") => "world"
		 *
		 * deepRead(data, "a1.b2") => false
		 *
		 * deepRead(data, "a1.b2.c2.any.random.number.of.non-existant.properties") => false
		 *
		 * @name utilities#deepRead
		 * @param {object} data - The collection to iterate over
		 * @param {string} expression - The string expression to evaluate
		 *
		 * @return {various | boolean} retVal - Returns the found property or false if not found
		 *
		 */
		this.deepRead = function (data, expression) {

			// Cache a copy of the split expression, then set to exp
			var exp = expression.join ? expression : (expression || '').split('.'), retVal;

			// Recursively read the object using a do-while loop, uses short-circuit for invalid properties
			do {
				retVal = (retVal || data || {})[exp.shift()] || false;
			} while (retVal !== false && exp.length);

			// Return our retVal or false if not found
			return retVal || false;

		};

		/**
		 *  Generates a date offset UUID for our photo
		 *  http://stackoverflow.com/a/8809472/467373
		 *
		 * @name utilities#generateUUID
		 */
		this.generateUUID = function () {
			var d = new Date().getTime();
			var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
				var r = (d + Math.random() * 16) % 16 | 0;
				d = Math.floor(d / 16);
				return (c === 'x' ? r : (r & 0x7 | 0x8)).toString(16);
			});
			return uuid;
		};

		/**
		 * Automatically uploads diagnostic info in the background when errors occur
		 *
		 * @name utilities#errorHandler
		 * @param err
		 */
		this.errorHandler = function (err) {

			console && console.log(err);

			if (PRODUCTION) {

				try {

					SharePoint.create(
						{

							'__metadata': 'ErrorLog',
							'Page'      : window.location.hash,
							'Stack'     : err.stack || (new Error()).stack || null,
							'Contents'  : JSON.stringify(err, null, 2)

						});

				} catch (e) {}

			}

		};

		/**
		 * Performs highlighting of matched search tags to allow users to see exactly what search terms had hits
		 *
		 * @name utilities#tagHighlight
		 * @param {Array} [data] - the data returned from SharePoint.read()
		 */
		this.tagHighlight = function (data) {

			try {

				var test = [],

					map = sharepointFilters.map(),

					matches = [];

				// First, generate the array of tags to test against
				_.each($rootScope.ftss.tagMap, function (tag, key) {

					_.each(tag, function (t) {

						if (map[key]) {

							test.push({
								id       : key + ':' + t,
								testField: map[key].split('/').join('.'),
								testValue: t
							});

						}

					});

				});

				// Perform tests against all data using the test[] already created,
				// _.all() stops once all tags are marked (if applicable)
				_.all(data, function (req) {

					// Must use _.each() in case a data item matches multiple tags
					_.each(test, function (t, k) {

						/**
						 *  If field and testValue match, add Matched class and delete test-- we shouldn't touch the DOM
						 *  from a controller but for performance reasons, this is much faster than relying on
						 *  AngularJS.
						 */
						if (!req.Archived && _self.deepRead(req, t.testField) === t.testValue) {

							matches.push(t.id);

						}

					});

					// Always test to ensure there are still tags to test against, otherwise exit the loop
					return (test.length > 0);

				});

				FTSS.search.$control.find('.item').addClass('processed');
				FTSS.search.$control.find('.matched').removeClass('matched');

				_.each(matches, function (match) {

					FTSS.search.$control.find('.item[data-value="' + match + '"]').addClass('matched');

				});

			} catch (e) {
			}

		};


		/**
		 * Delete old class data from the recordset before processing
		 *
		 * @name utilities#purgeOldClasses
		 * @param {Object} data
		 * @param {Number} daysToKeep
		 */
		this.purgeOldClasses = function (data, daysToKeep) {

			var limit = dateTools.startDayCreator(moment().add(0 - daysToKeep, 'days'));

			_.each(data, function (row, key) {

				((row.Start + row.Days) < limit) && delete data[key];

			});

		};

		/**
		 * IE's version of toLocaleString() is apparently stupid so we'll just do it manually using a regex courtesy of SO
		 *
		 * http://stackoverflow.com/a/2901298/467373
		 *
		 * @name utilities#prettyNumber
		 * @param x Number the number to chop up
		 * @returns {*} String the pretty version of our number
		 */
		this.prettyNumber = function (x) {

			var str = (x > 1000 ? Math.round(x / 100) : Math.round(x / 10) * 10).toString();

			return (x > 1000) ? (str[0] + '.' + str[1]).replace('.0', '') + 'K ' : str;
		};

		/**
		 * Performs the final page initialization.  This is called by multiple async operations so we must
		 * make several checks before running.
		 *
		 * @name utilities#initPage
		 *
		 * @param {String} action
		 * @param {boolean} pending
		 */
		this.initPage = function (action, pending) {

			_TIMER.add('init');

			_completed[action] = true;

			if (_.all(_completed)) {

				if (FTSS.captureETCA) {

					var tags = _.find(caches.MasterCourseList, {'Number': FTSS.captureETCA}).Id || '';

					FTSS.captureETCA = false;

					return $location.path('scheduled/' + btoa('{"c":[' + tags + ']}'));

				}

				// Handle unauthorized access
				if (!security.isAuthorized()) {
					return _self.navigate('home');
				}

				security.checkFTD();
				security.checkHost();

				if ($rootScope.host && $rootScope.host.Id) {

					var ftd = caches.Hosts[$rootScope.host.Id].FTD;

					$rootScope.ftd = $rootScope.ftd || caches.Units[ftd] || false;

				}

				if ($rootScope.ftss.isTagBox) {

					sharepointFilters.refresh();

					$rootScope.ftss.singleTag = FTSS.search.settings.maxItems < 2;

					var validFilters = sharepointFilters.map(),

						/**
						 * Handles pages with tagbox but no valid selected filters
						 */
						emptyFinish = function () {

							FTSS.search.focus();
							FTSS.search.$control_input.focus();

						};

					// eval our link portion of the URL or fall back to false
					pending = JSON.parse(atob($rootScope.ftss.$routeParams.link || 'ZmFsc2U'));

					if (pending) {

						var valMap = [],

							tagMap = {};

						_.each(pending, function (filterItems, filterGroup) {

							if (validFilters[filterGroup]) {

								_.each(filterItems, function (filter) {

									tagMap[filterGroup] = tagMap[filterGroup] || [];
									tagMap[filterGroup].push(filter);
									valMap.push(filterGroup + ':' + filter);

								});

							}

						});

						var filter = sharepointFilters.compile(tagMap);

						FTSS.search.setValue(valMap);

						if (filter) {

							$rootScope.ftss.tagMap = tagMap;
							$rootScope.ftss.filter = filter;

						} else {

							emptyFinish();

						}

					} else {

						emptyFinish();

					}

				}

				// Add setLoaded to async operations
				_jobs.push(_self.setLoaded);

				// Finally, run through all our async jobs
				while (_jobs.length) {
					$timeout(_jobs.shift());
				}

			}

		}


	}

]);