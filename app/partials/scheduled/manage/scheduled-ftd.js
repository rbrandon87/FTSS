/*global utils, FTSS, caches */

FTSS.ng.controller(
	'scheduled-ftdController',

	[
		'$scope',
		'$modal',
		'SharePoint',
		'$templateCache',
		function ($scope, $modal, SharePoint, $templateCache) {

			var self = FTSS.controller($scope, {

				    'sort'          : 'Start',
				    'group'         : 'Month',
				    'model'         : 'scheduled',
				    'modalPlacement': 'wide',

				    // We will be post-post-processing this data for the calendar (needs some special data)
				    'finalProcess'  : function (data) {

					    var events = [], min, max, months,

					        weekend = function (day) {
						        return (day.isoWeekday() > 5) ? 'weekend' : '';
					        };

					    _(data).each(function (group) {
						    events = events.concat(group);
					    });

					    min = moment(Math.min.apply(Math, _.pluck(events, 'sMoment'))).add(-3, 'days');
					    max = moment(Math.max.apply(Math, _.pluck(events, 'eMoment'))).add(3, 'days');

					    months = {};

					    $scope.resourceDays = '';
					    $scope.resourceEvents = [];

					    _(events).each(function (event) {

						    var filler = min.clone(),

						        first = true;

						    event.html = '';

						    while (filler < max) {

							    filler.add(1, 'days');

							    var text = '',

							        tdClass = weekend(filler);

							    if (filler >= event.sMoment && filler < event.eMoment) {

								    tdClass += ' mark';

								    if (first) {

									    text = _.template($templateCache.get('/partials/calendar-event.html'), event);

									    first = false

								    }

							    }

							    event.html += '<td class="' + tdClass + '">' + text + '</td>';

							    event.edit = function () {
								    $scope.edit.apply({'row': event});
							    };

						    }


					    });


					    while (min < max) {

						    var month = min.add(1, 'days').format('MMM YYYY');

						    if (!months[month]) {

							    months[month] = {
								    'month'  : month,
								    'sort'   : parseInt(min.format('YYYYMM')),
								    'colspan': 0
							    };

						    }

						    months[month].colspan++;

						    $scope.resourceDays += [

							    '<th class="',
							    weekend(min),
							    '">',
							    min.format('D'),
							    '<br>',
							    min.format('dd'),
							    '</th>'

						    ].join('');

					    }

					    $scope.resourceMonths = _.sortBy(months, 'sort');
					    $scope.events = events;

				    },

				    'edit': function (scope, isNew) {

					    // Only add valid date-ranges to FC
					    var getDates = function () {

						        return scope.data.Start && scope.data.End ?

						               {
							               'title'           : '***THIS COURSE***',
							               'start'           : scope.data.Start,
							               'end'             : scope.data.End,
							               'className'       : 'success',
							               'editable'        : true,
							               'durationEditable': true,
							               'allDay'          : true
						               }

							        : null;

					        },

					        update = function (event) {

						        var format = 'D MMM YYYY';

						        scope.data.Start = event.start.format(format);
						        scope.data.End = event.end.format(format);

						        scope.modal.$setDirty();

					        };

					    // If this is a new class, pre-fill the reserved seats with 0
					    if (isNew) {

						    scope.data.Host = 0;
						    scope.data.Other = 0;

					    }

					    // Some init settings for FullCalendar
					    scope.uiConfigInstructor = {

						    'weekends'     : false,
						    'allDayDefault': true,
						    'header'       : {
							    'left'  : 'title',
							    'center': '',
							    'right' : 'today prev,next'
						    },

						    'buttonText': {
							    today: 'Go to Today'
						    },

						    'eventResize': update,

						    'eventDrop': update,

						    'dayClick': function (start) {

							    if (scope.data.CourseId) {

								    var days = caches.MasterCourseList[scope.data.CourseId].Days,
								        end = start.clone();

								    while (days > 0) {

									    if (end.isoWeekday() < 6) {
										    days -= 1;
									    }

									    end.add(1, 'days');

								    }

								    scope.data.Start = start.toISOString();
								    scope.data.End = end.toISOString();

								    scope.modal.$setDirty();

								    scope.eventsInstructor[0] = [getDates()];

							    }

						    }
					    };

					    // Set the default calendar location if this is an existing class
					    if (scope.data.Start) {
						    scope.uiConfigInstructor.defaultDate = scope.data.Start;
					    }

					    // Setup uour empty calendar for FullCalendar
					    scope.eventsInstructor = [];

					    // Monitors the InstructorId to load their teaching schedule
					    scope.$watch('data.InstructorId', function (instructor) {

						    // If we have selected an instructor, try to get their teaching schedule
						    if (instructor) {

							    // Filter out only classes taught by this instructor
							    var schedule = _.filter($scope.rawSchedule, {'InstructorId': instructor}),

							        // Produce the array that FullCalendar expects
							        result = _.map(schedule, function (row) {

								        return {
									        'title'    : caches.MasterCourseList[row.CourseId].PDS,
									        'start'    : row.Start,
									        'end'      : row.End,
									        'className': 'info'
								        }

							        });

							    // Only add valid dates otherwise FullCalendar will just implode....
							    getDates() && result.push(getDates());

							    // update the event source for the calendar
							    scope.eventsInstructor[0] = result;

						    } else {

							    var thisClass = getDates();

							    // Make sure we remove any old events
							    scope.eventsInstructor[0] = thisClass ? [thisClass] : [];

						    }

					    });

					    /**
					     * Get Open Seats, performs live counting of remaining seat openings in modals
					     *
					     * @returns {string}
					     */
					    scope.getOpenSeats = function (countOnly) {

						    // Only attempt this if a CourseID exists
						    if (scope.data.CourseId) {

							    var requests = _(scope.data.Requests_JSON).reduce(function (count, request) {

								        // Only count seats pending (1) or approved (2) against total
								        return  (request[0] < 3) ? count + request[1].length : count;

							        }, 0),

							        open = (caches.MasterCourseList[scope.data.CourseId].Max -
							                (scope.data.Host || 0) -
							                (scope.data.Other || 0) -
							                requests);

							    if (countOnly) {
								    return open;
							    }

							    // Provide human-friendly seat availability counters
							    switch (true) {

								    case (open > 0):
									    return open + ' Open Seats';

								    case (open < 0):
									    return 'Overbooked by ' + Math.abs(open);

								    default:
									    return 'Class Full';

							    }

						    } else {

							    return '';

						    }

					    };

					    scope.data.requests = utils.requestDecode(scope.data.Requests_JSON);

				    }

			    })
				;

			// Bind the seat request function
			$scope.request = utils.requestSeats($scope, $modal, SharePoint);

			self

				.bind('filter')

				.then(function (data) {

					      $scope.rawSchedule = angular.copy(data);

					      // We can always request in this view
					      $scope.canRequest = true;

					      // Finish data binding and processing
					      self.initialize(data).then(utils.processScheduledRow);

				      });

		}
	])
;
