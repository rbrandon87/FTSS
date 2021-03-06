/*global utils, FTSS, caches, _, Sifter, angular */

/**
 * FTSS.controller()
 *
 * Utility for page controllers to process SP REST data
 *
 * @param $scope
 * @param opts
 * @returns {{$scope: *, bind: 'bind', initialize: 'initialize', process: 'process', scheduledClass: 'scheduledClass', postProcess: 'postProcess'}}
 *
 */

FTSS.ng.service('controllerHelper', [

	'$modal',
	'SharePoint',
	'$timeout',
	'security',
	'utilities',
	'loading',

	function ($modal, SharePoint, $timeout, security, utilities, loading) {

		return function ($scope, opts) {

			// Cleanup our scope watchers
			$scope.$on("$destroy", function () {
				(FTSS.searchWatch || Function)();
				(FTSS.archiveWatch || Function)();
			});

			var model, process, _self;

			_self = {

				// Enable access to $scope externally
				'$scope': $scope,

				/**
				 * Creates a $scope.$watcher to perform _self on change.  This function will call sharePoint.read() and pass
				 * the returned data to a promise, then().
				 *
				 * @name controllerHelper#bind
				 * @param {String} watchTarget prop the $scope property to watch, "loaded" will be a bind-once watcher, "filter" will stay
				 * bound and add the filter to model.params.$filter before passing the promise.
				 *
				 * @returns {{then: 'then'}}
				 */
				'bind': function (watchTarget) {

					var page = $scope.ftss.viewTitle,

						last;

					// Copy the model to a local variable for reuse without affecting the original model
					model = FTSS.models(opts.model);

					// Bind archive() & edit() to the scope in case they are needed
					$scope.archive = _self.archive;
					$scope.edit = _self.edit(opts.edit);

					$scope.showHelp = (localStorage['FTSS_show_help_' + page] !== '');

					$scope.hideHelp = function (always) {

						$scope.showHelp = '';

						if (always) { localStorage['FTSS_show_help_' + page] = '' }

					};


					// Return the promise, then()
					return {
						'then': function (callback) {

							// If a watchTarget exists, and a $watch for it, otherwise, keeping on running (faster loads)
							watchTarget ? $scope.$watch(watchTarget, watchAction) : watchAction(true);

							function watchAction(watch) {

								// Only act if there is a valid change to our watch
								if (watch) {

									/**
									 * Re-request data from the server
									 */
									_self.reload = function () {

										loading(true);

										if (!opts.static) {

											// Clone the model so we don't corrupt our filters
											var modelClone = _.cloneDeep(model),

												filters = modelClone.params.$filter || [];

											opts.filter && filters.push(opts.filter);

											watchTarget && filters.push(watch);

											modelClone.params.$filter = filters.join(' and ');

											SharePoint.read(modelClone).then(finalize);

										} else {

											finalize(watch);

										}

										/**
										 * Pass to the async ops handler if there has been a change
										 *
										 * @param data
										 */
										function finalize(data) {

											// Only continue if the data has changed
											if (!_.isEqual(data, last)) {

												// Keep a reference for future update checks
												last = data;

												// Finally, do our tagHighlighting if this is a tagBox
												$scope.ftss.isTagBox && utilities.tagHighlight(data);

												// If a callback exists, add it to our async handler
												callback && utilities.addAsync(function () {
													callback(data);
												});

											}


										}

									};

									// Run our reload action now
									_self.reload();

									// For auto-refreshing pages
									(opts.refresh > 1) && window.setInterval(_self.reload, opts.refresh * 15000);

								}

							}
						}

					}

				},

				/**
				 * Initializes the received data and calls any extra init functions from the controller
				 *
				 * @name controllerHelper#initialize
				 * @param data
				 * @returns {{then: 'then'}}
				 */
				'initialize': function (data) {

					// Pass the response to _self.data for access externally
					_self.data = data;

					// If there was no data found pass the User Empty Message and abort the operation
					if (_.size(data) < 1) {

						utilities.setLoaded();

						// We must still pass a then() promise to prevent an error, we're just not executing the callback
						return {
							'then': angular.noop
						};

					} else {

						return {
							/**
							 * The success promise that takes a processCallback to pre-process received data.
							 * The pre-processor is stored internally and used by action.process().
							 *
							 * @param processCallback
							 */
							'then': function (processCallback) {

								// Add our pre-processor (optional), if undefined it just won't be called by _self.process.
								process = processCallback;

								// Call the internal pre-processor
								_self.process(data);

							}
						};

					}
				},

				/**
				 *
				 * @name controllerHelper#process
				 * @param data
				 */
				'process': function (data) {

					// Use data if valid, otherwise _self.data our cached dataset
					data = data || _self.data;

					// If there is a defined data processor, then execute it against the data as well
					process && _.each(data, process);

					// Finally, send our data off to the post-processor
					_self.postProcess(data);

				},

				/**
				 * Controller Post-Processor
				 * Here we setup sifter() for full-text searching
				 *
				 * @name controllerHelper#postProcess
				 * @param data
				 */
				'postProcess': function (data) {

					$timeout(function () {

						var doProcess = function (oldVal, newVal) {

							// Only post-process if we actually have data to work with
							if (data && oldVal !== newVal) {

								var sifter, watcher, exec;

								// Update our total data count
								$scope.ftss.itemCount.total = _.size(data);

								// Initialize sifter with the array of data after passing through some string sanitization
								sifter = _(data)

									// Wrap our dataset in an array with a search property (just a flattened version of the data)
									.map(function (d) {

										     try {
											     // Use our search prop if it already exists
											     d.search = (d.search ||
											                 JSON.stringify(d).replace(/([,{]"\w+":)|([{}"])/gi, ' '))
												     .toLowerCase();

										     } catch (e) {

											     // Prevent JSON circular
											     d.search = '';

										     }

										     return {
											     /* We're using JSON stringify to fast deep-read our data & then stripping out the JSON junk
											      * with a regex & then setting lowercase for faster text-processing
											      */
											     'search': d.search,

											     // Also, send the data to sifter for use later on
											     'data': d
										     };

									     })

									// Perform filtering for Archived so we can shrink our processing load down
									.filter(function (test) {

										        // Add if this object does not have an Archived property or if showArchive is enabled
										        return !test.data.Archived || !!$scope.ftss.showArchived;

									        })

									.value();

								// This will let us debounce our searches to speed up responsiveness
								watcher = function (newVal, oldVal) {

									// Make sure the array of watchers are really different before running exec
									!_.isEqual(newVal, oldVal) && $timeout(exec);

								};

								// The main limiting, filtering, grouping, sorting function our views
								exec = function () {

									// Cancel if not authorized or $scope is already destroyed
									if (!security.isAuthorized() || $scope.$$destroyed) {
										return false;
									}

									// reference for our searchText
									var counter = 0,

										query = _.map(($scope.ftss.searchText || '')

											              // Convert " or " to a regex or
											              .replace(/\sor\s/gi, '|')

											              // Convert " and " to our split and search
											              .replace(/\sand\s/gi, ' ')

											              .replace(/\*/gi, '[\\w-]+')

											              // Split by spaces
											              .split(' '),

										              function (q) {

											              // Create independent regex tests for each word/wordgroup
											              return new RegExp(q, 'i');

										              });

									// Reset groups, counter & count
									$scope.groups = false;
									$scope.ftss.itemCount.value = '-';
									$scope.ftss.itemCount.overload = false;
									$scope.ftss.itemCount.archived = _.countBy(sifter.data, 'Archived');

									// Create our sorted groups and put in our scope
									$scope.groups = _(sifter)

										// Perform our full text search
										.filter(function (test) {

											        // short-circuit for no search text
											        return !query[0] || _.all(query, function (q) {

													        return q.test(test.search);

												        });

										        })

										// Map the data back as the controllers expect it
										.map('data')

										// Run sortBy first on our mapped data (group + sort)
										.sortBy(function (srt) {
											        return utilities.deepRead(srt, opts.group || false) +
											               utilities.deepRead(srt, opts.sort || false);
										        })

										// Trim our results
										.take($scope.ftss.pageLimit)

										// Group the data by the given property
										.groupBy(function (gp) {

											         counter++;

											         return opts.group ?
											                utilities.deepRead(gp, opts.group) ||
											                (opts.noEmptyGroup ? counter : '') :
											                false;
										         })

										.value();

									opts.finalProcess && opts.finalProcess($scope.groups);

									// Update the scope counter + overload indicator
									$scope.ftss.itemCount.value = counter;
									$scope.ftss.itemCount.overload = (counter !== sifter.length);

									// Perform final loading
									utilities.setLoaded(function () {

										// De-register the watcher if it exists
										(FTSS.searchWatch || Function)();

										// Create a watcher that monitors our searchText for changes
										FTSS.searchWatch = $scope.$watch('ftss.searchText', watcher);

										// De-register the watcher if it exists
										(FTSS.archiveWatch || Function)();
										FTSS.archiveWatch = $scope.$watch('ftss.showArchived', doProcess);

									});

								};

								exec();

							}

						};

						doProcess(true);

					});

				},

				/**
				 * Modal Add/Edit Callback
				 * The main add/edit dialog for the entire app--this one is kinda important.  First, generate a new isolated
				 * scope then copy the row data to scope.data & launch the angular-strap modal dialog, also bind some close
				 * & update _self and fire an optional post-processor to do more fancy stuff with the data from the
				 * parent controller
				 *
				 * @name controllerHelper#edit
				 * @param callback Function acts as a data post-processor for the calling controller to manipulate modal data
				 * @returns {Function}
				 */
				'edit': function (callback) {

					// the isNew boolean determines if this is a create or update action
					return function (isNew, data) {

						// Create the angular-strap modal using this model's modal template
						var modal = $modal({
								'placement'      : opts.modalPlacement || 'top',
								'scope'          : $scope,
								'backdrop'       : 'static',
								'contentTemplate': '/partials/modal-' + (opts.modal || opts.model) + '.html'
							}),

							scope = modal.$scope;

						// We handle add vs edit within the modal templates for simplicity
						scope.createData = isNew || false;

						// Bind close to instance.destroy to remove this modal
						scope.close = modal.destroy;

						// Allow archiving within an edit modal
						scope.archive = _self.archive;

						// Bind the submit action with a destroy callback
						if (opts.submit) {

							scope.submit = function () {

								opts.submit(scope, isNew);

							};

						} else {

							scope.submit = _self.update(scope, scope.close, isNew);

						}

						// Pass action.update to the scope for our traverse directive
						scope.update = _self.update;

						// Copy the row data to our isolated scope
						scope.data = isNew ? {} : angular.copy(this.row);

						// If the callback (our post-processor exists, call it too)
						callback && callback(scope, isNew, data);

					};

				},

				/**
				 * Row archive function
				 *
				 * This is FTSS's version of a record deletion; the record Archived attribute is flipped with this function
				 * to mark as archived/deleted
				 *
				 * @name controllerHelper#archive
				 */
				'archive': function () {

					// Allow handling modal archives
					var close = this.close || false,

						data = this.row || this.data;

					// Double check that this model can actually perform this action
					if (data && data.hasOwnProperty('Archived')) {

						var send = {
							'Archived'  : !data.Archived,
							'__metadata': data.__metadata,
							'cache'     : true
						};

						data.Archived = !data.Archived;

						opts.beforeSubmit && opts.beforeSubmit(this);

						// Call sharePoint.update() with our data and handle the success/failure response
						SharePoint.update(send).then(function (resp) {

							// HTTP 204 is the status given for a successful update, there will be no body
							if (resp.status === 204) {

								// If this is a modal, lets close it too
								close && close();

								utilities.alert.update();

								// Update the etag so we can rewrite this data again during the session if we want
								data.__metadata.etag = resp.headers('etag');

								_.first(_self.data, function (row) {

									if (row.Id === data.Key || data.Id) {
										row.Archived = true;
										row.__metadata = data.__metadata;

										return true;
									}

								});

								// Copy the updated back to the original dataset
								_self.data[data.Key || data.Id] = angular.copy(data);

								// Call _self.process() to reprocess the data by our controllers
								_self.process();

							}

						}, utilities.alert.error);

					}

				},

				/**
				 * Low-level CRUD wrapper
				 *
				 * @name controllerHelper#_postCRUD
				 * @param data
				 * @param callback
				 * @param noProcess
				 */
				'_postCRUD': function (data, callback, noProcess) {

					// Mark the data as updated for the <updated> directive
					data.updated = true;

					// Copy the updated back to the original dataset
					_self.data[data.Key || data.Id] = angular.copy(data);

					// If there is a callback, then fire it
					callback && callback(data);

					// Call _self.process() to reprocess the data by our controllers
					!noProcess && $timeout(_self.process);

				},

				/**
				 * Low-level Create wrapper
				 *
				 * @name controllerHelper#_create
				 * @param send
				 * @param callback
				 * @param noProcess
				 */
				'_create': function (send, callback, noProcess) {

					SharePoint.create(send).then(function (resp) {

						if (resp.status === 201) {

							// Notify user of success
							utilities.alert.create();

							// Perform final CRUD operations
							_self._postCRUD(resp.data.d || resp.data, callback, noProcess);

						}

					}, utilities.alert.error);

				},

				/**
				 * Low-level Update wrapper
				 *
				 * @name controllerHelper#_update
				 * @param scope
				 * @param send
				 * @param callback
				 * @param noProcess
				 */
				'_update': function (scope, send, callback, noProcess) {

					var data = scope.data || scope;

					// Call sharePoint.update() with our data and handle the success/failure response
					SharePoint.update(send).then(function (resp) {

						scope.submitted = false;

						// HTTP 204 is the status given for a successful update, there will be no body
						if (resp.status === 204) {

							// Notify user of success
							utilities.alert.update();

							// Update the etag so we can rewrite this data again during the session if we want
							data.__metadata.etag = resp.headers('etag');

							// Perform final CRUD operations
							_self._postCRUD(data, callback, noProcess);

						} else {

							utilities.alert.error('unknown update failure');

						}

					}, utilities.alert.error);


				},

				/**
				 * Inline update wrapper for items that should be updated after a change automatically
				 *
				 * @name controllerHelper#inlineUpdate
				 * @param field
				 * @param callback
				 */
				'inlineUpdate': function (field, callback) {

					var scope = this.row || this.data || this,

						send = {
							'cache'     : true,
							'__metadata': scope.__metadata
						};

					send[field] = scope[field];

					_self._update(scope, send, callback, true);

				},

				/**
				 * Performs our update to the SP model.  Sends only changes to the server for efficiency and handles update response
				 *
				 * @name controllerHelper#update
				 * @param scope
				 * @returns {Function}
				 */
				'update': function (scope, callback, isNew) {

					callback = callback || function () {};

					return function (eventData) {

						var old, fields, send = {}, complete;

						opts.beforeSubmit && opts.beforeSubmit(scope, isNew);

						if ((scope.modal || scope.$$childTail.modal).$dirty) {

							// Used by modal.footer.html to disable the submit button
							scope.submitted = true;

							// Keep a copy of the original data for comparison
							old = _self.data[scope.data.Key || scope.data.Id] || {};

							// Reference l
							fields = FTSS.models(opts.model).params.$select;

							//  Compare each field from the list of fields to the old data
							_.each(fields, function (field) {

								var data = scope.data[field];

								// First check for valid fields as the model includes expanded and temporary that can not be sent
								if (scope.data.hasOwnProperty(field) && (isNew || !_.isEqual(data, old[field]))) {

									send[field] = data;

								}

							});

						}

						// If nothing was updated then fire the callback with false
						if (_.isEmpty(send)) {

							scope.submitted = false;
							callback(eventData, false);

						} else {

							// Use the model's cache setting & __metadata
							send.cache = model.cache;
							send.__metadata = scope.data.__metadata || model.source;

							complete = function () {
								callback(eventData, true);
							};

							if (isNew) {

								_self._create(send, complete);

							} else {

								_self._update(scope, send, complete);

							}

						}

					};

				}


			};

			return _self;

		};

	}
]);
