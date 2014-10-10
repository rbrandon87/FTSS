/*global FTSS, angular, utils, _, caches */

FTSS.ng.controller(
	'requestsController',

	[
		'$scope',
		'SharePoint',
		function ($scope, SharePoint) {

			var self = FTSS.controller($scope, {

				'sort' : 'Start',
				'group': 'Course.Number',

				'grouping': {
					'Course.Number': 'Course'
				},

				'sorting': {

					'Start'                  : 'Start Date',
					'request.Students.length': '# Requested',
					'request.Host.Unit'      : 'Unit'

				},

				'model' : 'scheduled',

				// We only want classes with requests
				'filter': 'Requests_JSON ne null'

			});

			self

				.bind('filter')

				.then(function (data) {

					      $scope.edit = angular.noop;

					      var collection = [],

					          increment = 0;

					      _(data).each(function (group) {

						      _(group.Requests_JSON).each(function (request, index) {

							      var row = _.clone(group);

							      if (request[0] > 1) {

								      row.Archived = true;

							      }

							      row.Id = increment++;
							      row.Index = index;

							      row.request = _.zipObject(['Status',
							                                 'Students',
							                                 'Notes',
							                                 'HostId'
							                                ], request);

							      row.request.Host = caches.Hosts[row.request.HostId];

							      utils.cacheFiller(row);

							      row.search = [
								      row.ClassNotes,
								      row.Course.text,
								      row.Instructor.label,
								      row.TTMS,
								      row.request.Host.Text,
								      row.request.Notes,
								      row.request.Students.join(' ')
							      ].join(' ');

							      collection.push(row);

						      });
					      });

					      $scope.respond = function (status, response) {
						      debugger;
						      var row = this.row;

						      row.Requests_JSON[row.Index] = [
							      // Status
							      status,

							      // Students Array
							      row.request.Students,

							      // Notes
							      row.request.Notes,

							      // Host ID
							      row.request.HostId,

							      // Response
							      response
						      ];

						      // Call sharePoint.update() with our data and handle the success/failure response
						      SharePoint

							      .update({
								              'cache'        : true,
								              '__metadata'   : row.__metadata,
								              'Requests_JSON': row.Requests_JSON
							              })

							      .then(function (resp) {

								            // HTTP 204 is the status given for a successful update, there will be no body
								            if (resp.status === 204) {

									            utils.alert.update();

									            row.Archived = true;

									            self.process();

								            } else {

									            utils.alert.error('Please try again later.');

								            }

							            });

					      };


					      self.initialize(collection).then();

				      });

		}
	]);
