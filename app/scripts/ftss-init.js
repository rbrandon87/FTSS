/*global angular, PRODUCTION, FTSS */
/**
 * FTSS Initializer
 *
 */

(function () {

	"use strict";

	// Prevent parallel execution (for fail over execution)
	if (FTSS.ng) { return }

	// Remove our slow load message
	clearTimeout(window.slowLoad);

	_TIMER.add('ftss');

	/**
	 * Create the Angular module & declare dependencies
	 *
	 * @type {module}
	 */
	FTSS.ng = angular.module(
		'FTSS',
		[
			'ngRoute',
			'ngSharePoint',
			'mgcrea.ngStrap',
			'partials',
			'ngAnimate',
			'ngSanitize',
			'ui.calendar',
			'n3-line-chart',
			'angular-loading-bar',
			'angularFileUpload'
		]);

	/*
	 * The AngularJS Router will be used to handle various page mappings and links to the HTML Partials for FTSS
	 */
	FTSS.ng.config(
		[
			'$routeProvider',
			'$modalProvider',
			'$locationProvider',
			'$compileProvider',
			'$sceDelegateProvider',
			'cfpLoadingBarProvider',
			'$popoverProvider',
			function ($routeProvider, $modalProvider, $locationProvider, $compileProvider, $sceDelegateProvider, cfpLoadingBarProvider, $popoverProvider) {

				// Disable angular debugging for production mode
				$compileProvider.debugInfoEnabled(!PRODUCTION);

				// Allow AF Portal iframe
				$sceDelegateProvider.resourceUrlWhitelist(['self', new RegExp('^https://www.my.af.mil/.+$')]);

				// Disable the spinner globally
				cfpLoadingBarProvider.includeSpinner = false;

				// Our route list for various pages/actions
				var routes = [
					'home',
					'requirements',
					'scheduled',
					'scheduled-ftd',
					'ttms',
					'requests',
					'catalog',
					'manage-ftd',
					'backlog',
					'admin',
					'admin-hosts',
					'admin-instructors',
					'reset',
					'production-ftd',
					'my-unit',
					'my-ftd'
				];

				while (routes.length) {

					// Remove the next item from the array
					var route = routes.shift();

					if (route !== 'reset') {

						// Route based on name / linker / search to a controller of nameController
						$routeProvider.when('/' + route + '/:link?/:search?', {

							'templateUrl'         : '/partials/' + route + '.html',
							'controller'          : route + 'Controller',
							'reloadOnSearch'      : false,
							'caseInsensitiveMatch': true,
							'routeName'           : route

						});

					} else {

						$routeProvider.when('/reset', {});

					}

				}

				// Send all other requests to our home page
				$routeProvider.otherwise({'redirectTo': '/home'});

				$locationProvider.html5Mode(false);

				// Defaults for angular-strop modal directive
				angular.extend($modalProvider.defaults, {
					'container': 'body',
					'animation': 'am-fade-and-scale',
					'templateUrl' : '/partials/modal-template.html'
				});

				angular.extend($popoverProvider.defaults, {
					'html'     : true,
					'trigger'  : 'hover',
					'container': 'body'
				});

			}
		]);

	// Set the base SP collection used by FTSS
	var base = 'https://cs1.eis.af.mil/sites/FTSS/';

	// Only bind the prefetch values in production mode
	if (PRODUCTION && FTSS.PREFETCH) {
		FTSS.ng.value('SP_PREFETCH', FTSS.PREFETCH);
	}

	// Flush to reduce memory burden
	delete  FTSS.PREFETCH;

	FTSS.ng.value('SP_CONFIG',

	              PRODUCTION ?

	              {

		              // These are the ng-sharepoint parameters for the PRODUCTION version of FTSS
		              'offline'     : false,
		              'baseURL'     : base + 'live/_vti_bin/ListData.svc/',
		              'user'        : {'url': base + 'live/_vti_bin/UserGroup.asmx'},
		              'people'      : {'url': 'https://cs1.eis.af.mil/_vti_bin/People.asmx'},
		              'cacheVersion': 29

	              } : {

		              // These are the ng-sharepoint parameters for the DEVELOPMENT version of FTSS
		              'offline'     : true,
		              'baseURL'     : base + 'dev/_vti_bin/ListData.svc/',
		              'user'        : {'url': base + 'dev/_vti_bin/UserGroup.asmx'},
		              'people'      : {'url': base + 'dev/_vti_bin/People.asmx'},
		              'cacheVersion': 29

	              });

	// Default template for lo-dash _.template() function
	_.templateSettings.interpolate = /{{([\s\S]+?)}}/g;

	// This probably doesn't belong here? :-D
	FTSS.supportEmail = '372trs.trg.ftss@us.af.mil';
	FTSS.J4Email = '982TRG.J4scheduling@us.af.mil';

	// Base path for bio photos
	FTSS.photoURL = base + 'media/photos/';

	// Let us handle course referrals from ETCA
	FTSS.captureETCA = decodeURIComponent((document.referrer || '').split('as_course_id=')[1] || '').toUpperCase().trim();

	// Just a quick reminder we are not in production mode
	!PRODUCTION && console.log('DEVELOPMENT ENVIRONMENT');

}());