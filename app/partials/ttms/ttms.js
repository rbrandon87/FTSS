/*global FTSS, angular, utils, moment, _ */
FTSS.ng.controller(
	'ttmsController',

	[
		'$scope',
		'notifier',
		'classProcessor',
		'controllerHelper',
		function ($scope, notifier, classProcessor, controllerHelper) {

			$scope.ftss.pageLimit = 999;

			$scope.ftss.searchPlaceholder =
				'Type "late" to just see classes starting within 10 days.  Other examples: MDS:F-15, PDS:RFV, Robins, UHHZ, wire, 2A5*.';

			$scope.ftss.hasArchiveOption = true;

			var self = controllerHelper($scope, {

					'sort' : 'startMoment',
					'group': 'course',
					'model': 'ttms'

				}),

				today = moment();

			$scope.inlineUpdate = function (field, setArchive) {

				self.inlineUpdate.call(this, field, function (data) {

					if (setArchive) {

						self.data[data.Id].Archived = true;

						self.process();

					} else {

						// J4-specific request for internal messaging, prefix with '#' to not send an email, issue #12
						(data.J4Notes[0] !== '#') && notifier.j4Update(data);

					}
				});

			};

			self.bind().then(function (data) {

				$scope.worksDone = _.isEmpty(data);

				self.initialize(data).then(function (row) {

					// Call cacheFiller to add extra cached data
					classProcessor.cacheFiller(row);

					// Track how many days until the class beings
					row.daysUntil = row.startMoment.diff(today, 'days');

					// Archive classes that have already started
					if (row.daysUntil < 0) {
						row.Archived = true;
					}

					// Fix our search for this view
					row.search = [
						row.ClassNotes,
						row.Course.text,
						row.Instructor.Name,
						row.FTD.text
					].join(' ');

					// This is the grouping header
					row.course = [
						row.Course.PDS,
						' - ',
						row.Course.Number,
						' (Max: ',
						row.Course.Max,
						')'
					].join('');

					// This will give visual cues if the class is starting soon
					if (-1 < row.daysUntil && row.daysUntil < 10) {

						// If very soon make it red, otherwise, make it yellow
						row.style = (row.daysUntil < 3) ? 'danger text-danger' : 'warning text-warning';

						// Add some extra search terms to filter by upcoming classes
						row.search += ' soon late upcoming attention action';

					}

				});

			});

		}
	]);