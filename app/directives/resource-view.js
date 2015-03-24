/*global FTSS, angular */

/**
 *
 */
(function () {

	"use strict";

	FTSS.ng.directive(
		'resourceView',

		[
			'$timeout',
			'$templateCache',
			'dateTools',
			'loading',

			function ($timeout, $templateCache, dateTools, loading) {

				return {
					'restrict'   : 'E',
					'templateUrl': '/partials/resource-view-layout.html',
					'replace'    : true,
					'scope'      : {},
					'link'       : function (scope, $el, $attr) {

						var templateEvent = _.template($templateCache.get($attr.template ||
						                                                  '/partials/resource-view-event.html')),

						    templateMonth = _.template('<td colspan="{{colspan}}">{{month}}</td>'),

						    watch = '$parent.' + ($attr.bind || 'groups'),

						    tbody = $el.find('tbody')[0],

						    last;

						scope.$watch(watch, function (groups) {

							if (!groups || _.isEqual(groups, last)) {return}

							tbody.innerHTML = '';

							loading(true);

							setTimeout(function () {

								var html = {}, events = [], min, max, dayBase;

								last = groups;

								// Make a flat copy of our data for date range detection
								_.each(groups, function (group) {
									events = events.concat(group);
								});

								// Get the earliest start date, minus one day
								min = moment(Math.min.apply(Math, _.pluck(events, 'startMoment'))).add(-1, 'days');

								// Get the latest end date, plus one day
								max = moment(Math.max.apply(Math, _.pluck(events, 'endMoment'))).add(1, 'days');

								scope.resourceEvents = [];

								buildHeaders();

								_.each(groups, function (instructor) {

									instructor.html = '';

									var count = 0,

									    bioPhoto = instructor[0].bioPhoto ? '<div class="mask-img circle">' +
									                       '<img src="' + instructor[0].bioPhoto+ '" /></div>' : '';

									// Iterate over each event
									_.each(instructor, function (event) {

										// We subtract one to include the date the class starts
										var start = event.startMoment.diff(min, 'days') - 1;

										createTDs(start);

										if (event.NA) {

											// This creates the HTML for our unavailable blocks
											instructor.html += '<td hover="' +
											                   event.Instructor.InstructorName +
											                   ' not available for teaching." class="unavailable" colspan="' +
											                   event.Days +
											                   '" id="' +
											                   event.Id +
											                   '"><div class="details italics">' +
											                   (event.ClassNotes || '') +
											                   '</div></td>';

										} else {

											// Attempt to use cached bioPhoto
											event.photoHTML = bioPhoto;

											// Trim the PDS if days are less than 2
											event.pds = event.Days > 2 ? event.Course.PDS : '';

											// Trim the instructor name if days are shorter than 12
											event.name = event.Days > 12 ? event.Instructor.InstructorName : '';

											event.className =

											// Match MTT classes
											event.className = event.MTT ? 'mtt' :

												// Add trainingSession class if TTMS contains TS
												              event.TS ? 'trainingSession' :

													              // Id short classes
												              (event.allocatedSeats < event.Course.Min) ? 'short' :

												              event.className;

											// Add our html to the event
											instructor.html += templateEvent(event);

										}

										// Increment the day counter
										count += event.Days;

									});

									// map our instructor's name
									instructor.name = instructor[0].Instructor.InstructorName;

									createTDs(max.diff(min, 'days'));

									html.instructors.push(instructor);

									/**
									 * Appends TD elements to our TR HTML until the specified end
									 *
									 * @param end
									 */
									function createTDs(end) {

										while (count < end) {

											instructor.html += '<td class="' + dayBase[count++] + '"></td>';

										}

									}

								});

								// Bind the edit function (single click in this case)
								scope.doClick = function () {

									if (scope.$parent.canEdit) {

										// Dirty hack to get the current class without a million extra data binds
										var row = _.find(events, {Id: parseInt($('td:hover').attr('id'))});

										// complete binding to the edit action with our data
										row && scope.$parent.edit.call({'row': row}, false);

									}

								};

								html.render = '';

								html.spacer = '<tr class="spacer"><td></td></tr>';

								_(html.instructors).sortBy('name').each(function (instructor, index) {

									// For extra large groups,
									if (index % 10 < 1 &&
									    (html.instructors.length < 5 || (html.instructors.length - index) > 5)) {
										html.render += html.monthHeader + html.dayHeader + html.spacer;
									}

									html.render += '<tr class="event">' +
									               instructor.html +
									               '</tr>' +
									               html.spacer;

								}).value();

								if (html.instructors.length > 9) {
									html.render +=
									(html.dayHeader + html.monthHeader).replace(/header/g, 'header footer');
								}

								tbody.innerHTML = html.render;

								loading(false);

								function buildHeaders() {

									// Initialize our variables
									var minClone = min.clone();

									html.months = {};
									html.days = [];
									html.instructors = [];

									// Array of days to reference for classNames later on
									dayBase = [];

									// Create the list of days and months
									while (minClone < max) {

										// Add day to minClone and get the month
										var month = minClone.add(1, 'days').format('MMM YYYY'),

										    // Added classes for weekend or holidays
										    className = dateTools.isWeekend(minClone) ? 'weekend' :

										                dateTools.isDownDay(minClone) ? 'downDay' : '';

										// Create the month if it doesn't exist
										html.months[month] = html.months[month] || {
											'month'  : month,
											'sort'   : parseInt(minClone.format('YYYYMM'), 10),
											'colspan': 0
										};

										// Increase the colspan by one to match days of month
										html.months[month].colspan++;

										// Add the class (weekend/downDay) to our the day array for later use
										dayBase.push(className);

										// Add our html to the html.days array (will be joined at the end)
										html.days.push('<td class="', className, '">', minClone.format('D'),
										               '<br>', minClone.format('dd'), '</td>')

									}

									/**
									 * The reusable html header (months/days)
									 *
									 * @type {string}
									 */
									html.monthHeader = '<tr class="header months">';

									_(html.months).sortBy('sort').each(function (month) {

										html.monthHeader += templateMonth(month);

									}).value();

									html.monthHeader += '</tr>';

									html.dayHeader = '<tr class="header days">' + html.days.join('') + '</tr>';

								}

							});

						}, 25);
					}

				};

			}
		]
	);

}());
