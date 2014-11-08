/*global FTSS, _ */

/**
 * The FTSS.security() function controls the role-based views and automatic redirectors for pages not authorized.
 * Obviously, in a client-side SPA this can be easily bypassed so the views serve only as a convenience to the user
 * as the security is in the list-based SharePoint security groups on the server.  We are reflecting the limitations
 * already placed on the server so as not to confuse or overwhelm the user.
 */
(function () {

	"use strict";

	var authorizationMatrix = {

		'requirements': ['mtf',
		                 'ftd'
		],

		'scheduled': [ 'approvers',
		               'ftd',
		               'curriculum',
		               'mtf',
		               'guest'
		],

		'requests'   : ['approvers',
		                'mtf',
		                'ftd'
		],
		'instructors': ['ftd'],
		'catalog'    : ['curriculum'],
		'manage-ftd' : ['ftd'],
		'backlog'    : ['approvers',
		                'mtf',
		                'ftd'
		],
		'hosts'      : ['mtf',
		                'ftd'
		]

	};

	FTSS.security = function (SharePoint, $scope, _fn) {

		// Setup a watch for the user.groups to wait for the SOAP callback of group memberships
		var groupWatch = $scope.$watch('user.groups', function (groups) {

			// Only act if we have group memberships
			if (groups) {

				// Extract the name of any groups the user is a member of
				groups = groups.name ? [groups.name] : _.pluck(groups, 'name');

				groups = groups.length ? groups : ['guest'];

				var isAdmin = groups.indexOf('admin') > -1;

				// Used to modify views based on roles
				$scope.roleClasses = groups.join(' ');

				// This is the text that is displayed in the top-left corner of the app
				$scope.roleText = groups.join(' • ')
					.replace('mtf', 'MTF User')
					.replace('ftd', 'FTD User')
					.replace('curriculum', 'Curriculum Manager')
					.replace('scheduling', 'J4 Scheduler')
					.replace('approvers', 'Approver')
					.replace('admin', 'Administrator')
					.replace('guest', 'Visitor');

				/**
				 * Test for a particular user role
				 *
				 * @param roles
				 * @returns {boolean}
				 */
				$scope.hasRole = function (roles) {

					return isAdmin || _(roles.map ? roles : [roles]).any(function (role) {

						return groups.indexOf(role) > -1;

					});

				};

				/**
				 * Performs page validation check, this is a private function to help keep things a little more protected
				 *
				 * @private
				 */
				$scope.isAuthorized = groups.indexOf('admin') > -1 ?

				                      function () {

					                      $scope.abort = false;
					                      return true;

				                      } :

				                      function () {

					                      var page = authorizationMatrix[_fn.getPage()] || groups;

					                      $scope.abort = _.intersection(page, groups).length < 1;

					                      return !$scope.abort;

				                      };

				// Unbind our watcher
				groupWatch();

				// Call doInitPage() as this might be the last item in the async chain to complete
				_fn.doInitPage();

			}

		});

		// Load our user data into FTSS
		SharePoint.user($scope);

	};

}());
