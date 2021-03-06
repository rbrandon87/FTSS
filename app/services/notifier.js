/*global FTSS */

FTSS.ng.service('notifier', [

	'SharePoint',

	/**
	 * @name notifier
	 * @param SharePoint
	 */
	function (SharePoint) {

		/**
		 * @name notifier#generic
		 * @type {sendEmail}
		 */
		this.generic = sendEmail;

		/**
		 * @name notifier#j4Update
		 * @param {Object} data
		 */
		this.j4Update = function (data) {

			emailWrapper('{{FTD.Email}}',
			             'J4 Scheduling Update for {{Course.PDS}} - {{Course.Number}}',
			             'The following notes were left by Sheppard for the {{dateRange}} {{Course.PDS}} class:\n\n{{J4Notes}}')

			(data);

		};

		/**
		 * @name notifier#autoApprove
		 * @param {Object} data
		 */
		this.autoApprove = function (data) {

			emailWrapper('{{recipients}}',
			             'Automatic Seat Approval for {{subject}}',
			             '{{seats}} seats were approved for the {{host}}.\n\nDates:  {{dates}}\n\nStudents:\n{{students}}\n\n{{notes}}')

			(data);

		};

		/**
		 * @name notifier#requestSeats
		 * @param {Object} data
		 */
		this.requestSeats = function (data) {

			emailWrapper(
				'{{recipients}}',
				'New Seat Request for {{subject}}',
				'The {{host}} has requested {{seats}} seats for the {{dates}} class:\n\n' +
				'{{students}}\n\n{{notes}}\n\n\nView this request: https://cs1.eis.af.mil/sites/ftss#requests')

			(data, true);

		};

		/**
		 * @name notifier#cancelClass
		 * @param {Object} data
		 */
		this.cancelClass = function (data) {

			var recipients = [
				FTSS.J4Email,
				data.FTD.Email,
				data.Instructor.Email
			].join(';');

			emailWrapper(
				recipients,
				'Scheduled Class Canceled',
				'The following class was canceled:\n\n{{Course.Number}}{{TTMS}} ({{dateRange}}) at {{FTD.LongName}} ({{FTD.LCode}})')

			(data);

		};

		/**
		 * @name notifier#updateClass
		 * @param {Object} data
		 */
		this.updateClass = function (data) {

			var recipients = [
				FTSS.J4Email,
				data.FTD.Email,
				data.Instructor.Email
			].join(';');

			emailWrapper(
				recipients,
				'Scheduled Class Change',
				'The following class dates were changed:\n\n{{Course.Number}}{{TTMS}} at {{FTD.LongName}} ({{FTD.LCode}})\n\n' +
				'Original: {{oldDateRange}}\nUpdated: {{dateRange}}')

			(data);

		};

		/**
		 * @name notifier#createClass
		 * @param {Object} data
		 */
		this.createClass = function (data) {

			var instructorEmail = caches.Instructors[data.InstructorId].Email;

			if (instructorEmail) {

				emailWrapper(
					instructorEmail,
					'{{Course.PDS}} Class Scheduled',
					'You are scheduled to teach the {{Course.Number}} class during the following dates:\n\n' +
					'{{dateRange}}\n\nYou can view your teaching schedule anytime by visiting http://go.usa.gov/3WhBE.')

				(data, true);

			}

		};

		/**
		 * @name notifier#respondToRequest
		 * @param {Object} data
		 */
		this.respondToRequest = function (data) {

			emailWrapper(
				'{{Class.HostUnit.Email}}',
				'FTD Seat Request Response for {{Class.Course.PDS}}',
				'Seat request for {{Class.Course.Number}} ({{Class.dateRange}}) {{Status}}.' +
				'\n\n{{students}}\n\nFTD Notes:{{Response}}\n\n\nView all your requests: https://cs1.eis.af.mil/sites/ftss#my-unit')

			(data, true);

		};


		/**
		 * Wraps/parses our email templates for sending to SharePoint
		 *
		 * @param to String
		 * @param subject String
		 * @param body String
		 * @param data Object
		 */
		function emailWrapper(to, subject, body) {

			return function (data, excludeLink) {
				sendEmail(
					{
						'to'     : _.template(to)(data),
						'subject': _.template(subject)(data),
						'body'   : _.template(body)(data)
					}, excludeLink);
			}

		}

		/**
		 * Send Email notification
		 *
		 * Use to send email notification to a user.  The requester is automatically CC'd.
		 * @param send Object Must have to, subject, body properties.
		 */
		function sendEmail(send, excludeLink) {

			var sendClean = {

				'__metadata': 'Notifier',
				'To'        : sanitize(send.to),
				'Subject'   : sanitize(send.subject),
				'Body'      : '\n' + sanitize(send.body) + (excludeLink ? '' : '\n\n\n\nhttps://cs1.eis.af.mil/sites/ftss')

			};

			// Only create this if this if it is valid and we are running in production mode
			if (PRODUCTION && send.to && send.subject && send.body) {

				SharePoint.create(sendClean);

			} else {

				console && console.log(sendClean);

			}

		}

		/**
		 * Santize any error before we send this data to SP
		 *
		 * @param field String
		 * @returns String
		 */
		function sanitize(field) {

			return field.replace(/(undefined|null|NaN)/gi, ' ');

		}

	}
]);