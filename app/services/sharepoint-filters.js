/*global _, FTSS, angular */


FTSS.ng.service('sharepointFilters', [

	'$location',

	function ($location) {

		"use strict";

		// @name sharepointFilters
		var _self = this,

			_filterMaps = {

				'scheduled'   : {
					'u': 'UnitId',
					'c': 'CourseId'
				},
				'requirements': {
					'h': 'HostId',
					'u': 'UnitId'
				}

			},

			_max = {
				'requirements': 1
			};


		/**
		 * @name sharepointFilters#map
		 * @returns {*}
		 */
		this.map = function () {

			return _filterMaps[$location.path().split('/')[1]];

		};

		/**
		 * When the view is updated, this will update the page-specific filters for tagBox or SearchBox
		 *
		 * @name sharepointFilters#refresh
		 */
		this.refresh = (function () {

			return function () {

				FTSS.search.clear(true);
				FTSS.search.clearOptions();

				var viewName = $location.path().split('/')[1],

					view = _filterMaps[viewName];

				if (_filterMaps[viewName]) {

					FTSS.search.addOption(_.filter(FTSS.tagBoxOpts, function (opt) {

						return view[opt.id.charAt(0)];

					}));

				}

				var settings = FTSS.search.settings;

				settings.maxItems = _max[viewName] || 20;
				settings.mode = (settings.maxItems === 1) ? 'single' : 'multi';

				// Need to redraw selectize with our updated options!
				FTSS.search.refreshOptions(false);

			};

		}());

		/**
		 * Filter Compile Function
		 *
		 * Converts user-selected tags{} into the SharePoint friendly filter query
		 *
		 * @name sharepointFilters#compile
		 * @param tags Object
		 * @returns {*}
		 */
		this.compile = function (tags) {

			var maps = _self.map();

			return _(tags)

				.map(function (tagSet, key) {

					     var result = _(tagSet).map(function (tag) {

						     return maps[key] + ' eq ' + tag;

					     });

					     return result && '(' + result.join(' or ') + ')';

				     })

				.filter()

				.join(' and ');

		};

	}

]);