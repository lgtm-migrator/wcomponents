define(["wc/dom/attribute",
	"wc/loader/prefetch",
	"wc/dom/event",
	"wc/dom/initialise",
	"wc/dom/uid",
	"wc/ajax/Trigger",
	"wc/has",
	"wc/file/clearSelector",
	"wc/file/validate",
	"wc/i18n/i18n",
	"wc/dom/Widget",
	"wc/dom/formUpdateManager",
	"wc/file/filedrop",
	"wc/ajax/ajax",
	"wc/ui/prompt",
	"wc/dom/focus",
	"wc/isNumeric",
	"wc/ui/ajaxRegion",
	"wc/config",
	"wc/debounce",
	"wc/dom/toDocFragment",
	"wc/ui/feedback",
	"wc/ui/icon",
	"wc/ui/fieldset"],
function (attribute, prefetch, event, initialise, uid, Trigger, has, clearSelector, validate, i18n, Widget, formUpdateManager,
	filedrop, ajax, prompt, focus, isNumeric, ajaxRegion, wcconfig, debounce, toDocFragment, feedback, icon) {
	"use strict";

	// Note `wc/ui/fieldset` is implicitly required to handle various aspects of managing the wrapper element.

	var
		/**
		 * Provides functionality associated with uploading multiple files using a WMultiFileWidget.
		 *
		 * @module
		 * @requires wc/dom/attribute
		 * @requires wc/loader/prefetch
		 * @requires wc/dom/event
		 * @requires wc/dom/initialise
		 * @requires wc/dom/uid
		 * @requires wc/ajax/Trigger
		 * @requires wc/has
		 * @requires wc/file/clearSelector
		 * @requires wc/file/validate
		 * @requires wc/i18n/i18n
		 * @requires wc/dom/Widget
		 * @requires wc/file/formUpdateManager
		 * @requires wc/file/filedrop
		 * @requires wc/ajax/ajax
		 * @requires wc/ui/prompt
		 * @requires wc/dom/focus
		 * @requires wc/isNumeric
		 * @requires wc/ui/ajaxRegion
		 * @requires wc/config
		 * @requires wc/debounce
		 * @requires wc/dom/toDocFragment
		 * @requires wc/ui/feedback
		 * @requires wc/ui/icon
		 * @requires wc/ui/fieldset
		 */
		instance = new MultiFileUploader(),
		changed = {},
		CLASS_NAME = "wc-multifileupload",
		COL_ATTR = "data-wc-cols",
		MAX_FILES_ATTR = "data-wc-maxfiles",
		CLASS_NO_BULLET = "wc_list_nb",
		CLASS_WRAPPER = "wc_files",
		CLASS_FILE_INFO = "wc-file",
		CLASS_FILE_LIST = "wc_filelist",
		CLASS_AJAX_UPLOADER = "wc-ajax",
		containerWd = new Widget("", CLASS_NAME),
		inputElementWd = new Widget("INPUT", "", {type: "file"}),
		fileInfoContainerWd = new Widget("UL", CLASS_FILE_LIST),
		fileInfoWd = new Widget("LI", CLASS_FILE_INFO),
		itemActivationWd = new Widget("A"),
		BUTTON = new Widget("button"),
		removeButtonWd = new Widget("BUTTON"),
		filesWrapperWd = new Widget("div", CLASS_WRAPPER),
		cameraButtonWd = new Widget("BUTTON", "wc_btn_camera"),
		inflightXhrs = {},
		progressWd = new Widget("progress");

	inputElementWd.descendFrom(containerWd);  // This is important in legacy IE - yes, you don't see why, but it is!
	fileInfoWd.descendFrom(containerWd);
	removeButtonWd.descendFrom(fileInfoWd);
	progressWd.descendFrom(fileInfoWd);
	cameraButtonWd.descendFrom(containerWd);

	/**
	 * @typedef {Object} module:wc/file/MultiFileUploader~fileInfo
	 * @param {string} url The URL to upload the file to.
	 * @param {Element} element The name of the file input.
	 * @param {Element} container The multiFileWidget wrapper element.
	 * @param {Function} callback The function to call with the response of each file upload.
	 * @param {Function} complete The function to call when all files have been uploaded.
	 * @property {File[]} files A collection of files where each file implements the File interface http://www.w3.org/TR/FileAPI/#dfn-file.
	 */

	/*
	 * An asynchronous file uploader which allows multiple file selection via file selector or
	 * drag and drop (some features are NOT polyfilled but we offer anyone a new browser free of charge).
	 *
	 * Once the upload is complete the server should place the file in a temporary location
	 * until the page is submitted.  The user may have deselected some (or all) of the files
	 * uploaded - the server must check and honor these selections.
	 */

	/**
	 * @constructor
	 * @alias module:wc/ui/multiFileUpload~MultiFileUploader
	 * @private
	 */
	function MultiFileUploader() {
		var INITED_KEY = "wc/ui/multiFileUploader.inited",
			uploader;

		prefetch.jsModule("wc/ui/imageEdit");

		/**
		 * Change event on the file input.
		 * Somebody wants to upload a file...
		 * @function
		 * @private
		 * @param {Event} $event The change event.
		 */
		function changeEvent($event) {
			var element = $event.target;
			if (!$event.defaultPrevented && inputElementWd.isOneOfMe(element)) {
				checkDoUpload(element, null);
			}
		}

		/**
		 * Call when files are added or removed as this is the definition of a change for this component.
		 * @param {string} id The id of a multiFileWidget.
		 */
		function filesChanged(id) {
			var element = document.getElementById(id);
			if (element && ajaxRegion.getTrigger(element, true)) {
				ajaxRegion.requestLoad(element, null, true);
			}
		}

		/**
		 * Click event in the fileupload widget.
		 * Handle things like removing an attachment.
		 * @function
		 * @private
		 * @param {Event} $event The click event.
		 */
		function clickEvent($event) {
			var fileInfo, container, trigger, proceed, element;
			if (!$event.defaultPrevented) {
				element = BUTTON.findAncestor($event.target) || $event.target;
				initialiseFileInput(element);
				fileInfo = fileInfoWd.findAncestor(element);
				if (fileInfo) {
					if (removeButtonWd.isOneOfMe(element)) {
						proceed = prompt.confirm(i18n.get("file_confirmdelete"));
						if (proceed) {
							removeFileItem(fileInfo);
						}
					} else if ((container = containerWd.findAncestor(fileInfo)) && container.classList.contains(CLASS_AJAX_UPLOADER)) {
						trigger = itemActivationWd.isOneOfMe(element) ? element : itemActivationWd.findAncestor(element);
						if (trigger) {
							// trigger.removeAttribute("target");
							trigger.setAttribute("data-wc-params", "wc_fileid=" + window.encodeURIComponent(fileInfo.id));
							console.log("wc_fileid", fileInfo.id);
						}
					}
				} else if (cameraButtonWd.isOneOfMe(element)) {
					require(["wc/ui/imageEdit"], function (imageEdit) {
						if (imageEdit.upload !== instance.upload) {
							imageEdit.upload = instance.upload;
						}
					});
				}
			} else {
				bootStrap($event);  // increasingly browsers do not focus some elements when they are clicked (traditionally webkit only did this) - I'm looking at you FireFox.
			}
		}

		function removeFileItem(fileInfo) {
			var xhr,
				container = containerWd.findAncestor(fileInfo);
			if (container) {
				fileInfo.parentNode.removeChild(fileInfo);
				if (inflightXhrs.hasOwnProperty(fileInfo.id) && (xhr = inflightXhrs[fileInfo.id])) {
					if (xhr.abort) {
						xhr.abort();
					}
				}
				changed[container.id] = changed[container.id] || debounce(function(id) {
					filesChanged(id);
					reflowFileItemsAfterRemove(id);
					delete changed[id];
				}, 300);
				changed[container.id](container.id);
			}
		}

		function reflowFileItemsAfterRemove(id) {
			var container = document.getElementById(id),
				itemContainer, itemContainers, i, items, itemContainerCount, cols;
			if (container && container.hasAttribute(COL_ATTR) && (cols = container.getAttribute(COL_ATTR)) && isNumeric(cols) && cols > 1) {
				// cols 0 and cols 1 are handled as a single list
				itemContainers = getColumns(container);
				itemContainerCount = itemContainers.length;
				if (itemContainerCount > 1) {
					// We only care if there is more than one UL therefore testing "greater than one"
					items = fileInfoWd.findDescendants(container);
					for (i = 0; i < items.length; i++) {
						itemContainer = itemContainers[i % cols];
						itemContainer.appendChild(items[i]);
					}
				}
			}
		}

		/**
		 * This allows other code to request an async file upload using a WMultiFileWidget.
		 * For example file dropzones.
		 * @param {Element} element A file input or an element that contains a file input.
		 * @param {File[]} files Binary file data.
		 * @param {boolean} [suppressEdit] true if image editing should be bypassed regardless of whether it is configured or not.
		 */
		this.upload = function (element, files, suppressEdit) {
			var input = inputElementWd.isOneOfMe(element) ? element : inputElementWd.findDescendant(element);
			if (input) {
				focus.setFocusRequest(input, function () {
					/*
					 * The focus is primarily necessary to bootstrap the file widget.
					 * This is critical if the file widget is needs to be wired up by
					 * other controllers such as ajax trigger.
					 */
					checkDoUpload(input, files, suppressEdit);
				});
			}
		};

		/**
		 * Validate the file chosen and commence the asynchronous upload if all is well.
		 * @function
		 * @private
		 * @param {Element} element A file input element.
		 * @param {File[]} [files] A collection of File items to use instead of element.files.
		 * @param {boolean} [suppressEdit] true if image editing should be bypassed regardless of whether it is configured or not.
		 */
		function checkDoUpload(element, files, suppressEdit) {
			var testObj, maxFileInfo, filesToAdd,
				useFilesArg = (!element.value && (files && files.length > 0)),
				done = function () {
					instance.clearInput(element);
				};
			getUploader(function (theUploader) { // this wraps the possible async wait for the fauxjax module to load, otherwise clearInput has been called before the upload begins
				var checkAndUpload = function (useTheseFiles) {
						validate.check({
							selector: element,
							files: useTheseFiles,
							notify: true,
							callback: function(selector) {
								try {
									if (inputElementWd.isOneOfMe(selector)) {
										commenceUpload({
											uploader: theUploader,
											element: selector,
											files: useTheseFiles
										});
									}
								} finally {
									done();
								}
							},
							errback: done
						});
					},
					upload = function(obj) {
						var editorId = element.getAttribute("data-wc-editor"),
							skipEdit = suppressEdit || (has("ie") > 0 && has("ie") < 10);
						if (!skipEdit && editorId) {
							require(["wc/ui/imageEdit"], function (imageEdit) {
								obj.editorId = editorId;
								if (imageEdit.upload !== instance.upload) {
									imageEdit.upload = instance.upload;
								}
								imageEdit.editFiles(obj, checkAndUpload, done);
							});
						} else {
							checkAndUpload(obj.files);
						}
					};
				if (element.value || useFilesArg) {
					testObj = useFilesArg ? {files: files, name: element.name, value: element.value, accept: element.accept} : element;
					filesToAdd = (testObj.files ? testObj.files.length : 1);
					maxFileInfo = checkMaxFiles(element, filesToAdd);
					if (maxFileInfo.valid) {
						upload(testObj);
					} else {
						done();
						prompt.alert(i18n.get("file_toomany", filesToAdd, maxFileInfo.max, maxFileInfo.before));
					}
				}
			});
		}

		/**
		 * Checks if the maxFiles count will be exceeded if we proceed with the upload
		 * @param {Element} element The DOM element responsible for the upload
		 * @param {Number} newFileCount The number of files being added
		 * @returns {Object} the property 'valid' will be false if the maxFiles count will be exceeded
		 */
		function checkMaxFiles(element, newFileCount) {
			var message,
				config = wcconfig.get("wc/ui/multiFileUploader", {
					overwrite: false
				}),
				currentFiles,
				container,
				result = {
					valid: true,
					max: 0,
					before: 0,
					after: 0,
					removed: 0
				},
				fix = function(resObj) {
					/*
						This function implements some pretty dangerous behavior: it will enforce the max file limit
						by removing already uploaded files to make way for new ones.
					 */
					var i, removeCount = resObj.after - resObj.max;  // this is how many we need to remove
					for (i = 0; i < removeCount; i++) {
						removeFileItem(currentFiles[i]);
						resObj.removed++;
					}
					resObj.after -= resObj.removed;
				};
			if (newFileCount) {
				result.max = getMaxFiles(element);
				if (result.max) {
					container = containerWd.findAncestor(element);
					if (container) {
						currentFiles = fileInfoWd.findDescendants(container);
						result.before = currentFiles.length;
						result.after = result.before + newFileCount;
						if (result.after > result.max) {
							if (config.overwrite && newFileCount <= result.max) {
								message = i18n.get("file_confirmoverwrite", newFileCount, result.max, result.before);
								if (message) {
									if (prompt.confirm(message)) {
										fix(result);
									}
								} else {
									fix(result);
								}
							}
							result.valid = (result.after <= result.max);
						}
					}
				}
			}
			return result;
		}

		/**
		 * Gets the "max files" constraint for this file input.
		 * Sets a limit for the number of files this file selector should allow.
		 * @param {Element} element A file input.
		 * @returns {Number} The max files constraint if set, otherwise 0.
		 */
		function getMaxFiles(element) {
			var maxFiles;
			if (element) {
				if (element.hasAttribute(MAX_FILES_ATTR)) {
					maxFiles = element.getAttribute(MAX_FILES_ATTR);
					if (isNumeric(maxFiles)) {
						maxFiles *= 1;
						return Math.max(maxFiles, 0);
					}
				}
			}
			return 0;
		}

		/**
		 * Upload the file asynchronously now.
		 * @function
		 * @private
		 * @param {Object} config an object with the following properties:
		 *    {Element} element A file input element.
		 *    {Function} callback A function that will be called if and when all of the files are uploaded correctly
		 *    {File[]} [files] A collection of File items to use instead of element.files.
		 */
		function commenceUpload(config) {
			var element = config.element,
				files = (config.files || element.files || []),
				container = containerWd.findAncestor(element),
				url = getUploadUrl(element),
				request = {
					container: container,
					callback: processResponse,
					complete: filesChanged,
					element: element,
					files: files,
					url: url
				};
			if (container) {
				config.uploader.request(request);
			}
		}

		function getUploader(callback) {
			if (!uploader) {
				if (has("formdata")) {
					uploader = new TrueAjax();
					callback(uploader);
				} else {
					require(["wc/file/FauxJax"], function (FauxJax) {
						uploader = new FauxJax(instance.createFileInfo, getUploadUrl);
						callback(uploader);
					});
				}
			} else {
				callback(uploader);
			}

		}

		/**
		 * Callback which will be invoked when the server responds to an asynchronous file upload.
		 * Note that this is called for EACH uploaded file.
		 * @function
		 * @private
		 * @param {Element} response An HTML element which contains the content to display in the list of uploaded files.
		 */
		function processResponse(response) {
			var i, newFiles = response.getElementsByTagName(fileInfoWd.tagName);
			if (newFiles && newFiles.length > 0) {
				for (i = 0; i < newFiles.length; i++) {
					updateFileInfo(newFiles[i]);
				}
			} else {
				throw new Error("Unexpected fileupload response");
			}
		}

		function updateFileInfo(newFile) {
			var container, containerId, fileId = newFile.getAttribute("id"),
				oldFile = document.getElementById(fileId);
			delete inflightXhrs[fileId];
			if (oldFile) {

				oldFile.innerHTML = newFile.innerHTML;
				// oldFile.parentNode.replaceChild(newFile, oldFile);  // Problems with importing node
			} else if ((containerId = newFile.getAttribute("data-wc-containerid")) && (container = document.getElementById(containerId))) {
				// This is an extreme edge case - if the fileWidget UI has been replaced during upload attempt to recover
				container.insertAdjacentHTML("beforeend", newFile.outerHTML);
			} else {
				console.warn("Could not find", fileId);
			}
		}

		/**
		 * Handles the event/s that trigger bootstrapping of this widget.
		 * @param {Event} $event The event that triggers bootstrapping.
		 */
		function bootStrap($event) {
			var element = $event.target;
			initialiseFileInput(element);
		}

		/**
		 * Set up a file selector on first use.
		 * @param {Element} element A file input.
		 */
		function initialiseFileInput(element) {
			var inited;
			if (inputElementWd.isOneOfMe(element)) {
				inited = attribute.get(element, INITED_KEY);
				if (!inited) {
					console.log("Initialising on first use", element.name);
					attribute.set(element, INITED_KEY, true);
					if (has("ie") < 9) {
						/*
						 * IE8 and earlier do not implement the change event properly
						 * it should bubble but doesn't. This is fixed in IE9 no matter
						 * how you attach the event (attachEvent or addEventListener)
						 */
						event.add(element, "change", changeEvent);
					}
					initialiseForm(element.form);
				}
			}
		}

		/**
		 * Initialise the form that contains the multifile widget.
		 * @function
		 * @private
		 * @param {Element} form The form to initialise.
		 */
		function initialiseForm(form) {
			var inited = attribute.get(form, INITED_KEY);
			if (!inited) {
				attribute.set(form, INITED_KEY, true);
				if (!form.classList.contains(CLASS_NAME)) {
					event.add(form, "submit", submitEvent, -50);
					if (!has("ie") || has("ie") > 8) {
						event.add(form, "change", changeEvent);
					}
				}
			}
		}

		/**
		 * Listen to submit events on the page that contains the file widgets.
		 * If the user tries to submit the form while there are uploads pending we should warn them
		 * that it will cancel their uploads.
		 * @param {Event} $event The submit event.
		 */
		function submitEvent($event) {
			var proceed;
			if (!$event.defaultPrevented && uploader && uploader.getUploading() > 0) {
				proceed = prompt.confirm(i18n.get("file_confirmnav"));
				if (!proceed) {
					$event.preventDefault();
				}
			}
		}

		/**
		 * Register the dropzone for this multiFileWidget.
		 * It only makes sense to call this if the multiFileWidget in question has a dropzone associated with it.
		 * @param {string} id The id of a mutliFileWidget (i.e. the top level container).
		 */
		function registerDropzone(id) {
			var dropzoneId, input, element = document.getElementById(id);
			if (element && (input = inputElementWd.findDescendant(element))) {
				dropzoneId = input.getAttribute("data-dropzone");
				if (dropzoneId) {
					input = null;
					filedrop.register(dropzoneId, function (type, files) {
						var className = "wc_dragging";
						if (type === "drop") {
							instance.upload(element, files);
							element.classList.remove(className);
						} else if (type === "dragstart") {
							element.classList.add(className);
						} else if (type === "dragstop") {
							element.classList.remove(className);
						}
					});
				}
			}
		}

		/*
		 * Registration processor
		 * @param {String[]} idArr An array of element ids.
		 */
		function processNow(idArr) {
			var id;
			while ((id = idArr.shift())) {
				registerDropzone(id);
			}
		}

		/**
		 * Register filewidgets - dropzones cannot be lazily initialized.
		 * @function
		 * @public
		 * @param {String[]} idArr An array of mutliFileWidget ids.
		 */
		this.register = function (idArr) {
			if (idArr && idArr.length) {
				initialise.addCallback(function () {
					processNow(idArr);
				});
			}
		};

		this.writeState = function (form, container) {
			var multiFileWidgets = containerWd.findDescendants(form);
			Array.prototype.forEach.call(multiFileWidgets, function (multiFileWidget) {
				var i, next, stateField, fileInfos = fileInfoWd.findDescendants(multiFileWidget);
				for (i = 0; i < fileInfos.length; i++) {
					next = fileInfos[i];
					stateField = formUpdateManager.writeStateField(container, multiFileWidget.id + ".selected", next.id);
					stateField.checked = true;
					container.appendChild(stateField);
				}
			});
		};

		/**
		 * Initialise file upload functionality by adding a focus listener.
		 * @function module:wc/ui/multiFileUpload.initialise
		 * @param {Element} element The element being initialised - usually document.body.
		 */
		this.initialise = function (element) {
			formUpdateManager.subscribe(this);
			if (event.canCapture) {
				event.add(element, { type: "focus", listener: bootStrap, capture: true });
			} else {
				event.add(element, "focusin", bootStrap);
			}
			event.add(element, "click", clickEvent);
			if (has("rtc-gum") || has("flash")) {
				element.classList.add("wc-rtc-gum");
			}
		};

		/**
		 * Get the {@link module:wc/dom/Widget} descriptor of the multi file upload component.
		 * @function module:wc/ui/multiFileUpload.getWidget
		 * @returns {module:wc/dom/Widget} The widget descriptor.
		 */
		this.getWidget = function () {
			return containerWd;
		};

		/**
		 * Get the {@link module:wc/dom/Widget} descriptor of the file input element associated with a file upload.
		 * Note WMultiFileWidget may also output a load of checkbox elements - one for each file currently uploaded.
		 *
		 * @function module:wc/ui/multiFileUpload.getInputWidget
		 * @returns {module:wc/dom/Widget} The widget descriptor.
		 */
		this.getInputWidget = function () {
			return inputElementWd;
		};

		function getColumns(container) {
			var cols = container.getAttribute(COL_ATTR) || 1, i,
				itemContainers = fileInfoContainerWd.findDescendants(container),
				filesWrapper,
				col;
			// cols 0 and cols 1 are handled as a single list

			if (itemContainers.length < cols) {
				if (cols > 1) {
					filesWrapper = filesWrapperWd.findDescendant(container);
					if (!filesWrapper) {
						filesWrapper = document.createElement(filesWrapperWd.tagName);
						filesWrapper.className = CLASS_WRAPPER;
						container.appendChild(filesWrapper);
					}
				}
				for (i = itemContainers.length; i < cols; i++) {
					col = document.createElement(fileInfoContainerWd.tagName);
					col.className = CLASS_NO_BULLET + " " + CLASS_FILE_LIST;
					if (filesWrapper) {
						filesWrapper.appendChild(col);
					} else {
						container.appendChild(col);
					}
				}
				itemContainers = fileInfoContainerWd.findDescendants(container);
			} else if (cols === "0" && !itemContainers.length) {
				col = document.createElement(fileInfoContainerWd.tagName);
				col.className = CLASS_NO_BULLET + " wc-listlayout-type-flat " + CLASS_FILE_LIST;
				container.appendChild(col);
				itemContainers = fileInfoContainerWd.findDescendants(container);
			}
			return itemContainers;
		}

		function getNextColumn(container) {
			var i, next, items, smallest = {
					idx: 0,
					count: -1
				},
				columns = getColumns(container);
			for (i = 0; i < columns.length; i++) {
				next = columns[i];
				items = fileInfoWd.findDescendants(next);
				if (smallest.count < 0 || items.length < smallest.count) {
					smallest.idx = i;
					smallest.count = items.length;
					if (smallest.count === 0) {
						break;
					}
				}
			}
			return columns[smallest.idx];
		}

		/**
		 * Creates the UI widget presented to the user while a file is uploading.
		 * It will be created and added to the DOM.
		 * @param {Element} container The multiFileUploader top level element.
		 * @param {string} fileName The name of the file being uploaded.
		 * @returns {string} The ID of the newly created UI widget.
		 */
		this.createFileInfo = function (container, fileName) {
			var id = uid(),
				removeButton,
				progress,
				itemContainer = getNextColumn(container),
				item = document.createElement(fileInfoWd.tagName);
			item.className = CLASS_FILE_INFO;
			removeButton = document.createElement(removeButtonWd.tagName);
			removeButton.setAttribute("type", "button");  // .type causes issues in legacy IE
			removeButton.className = "wc_btn_icon wc_btn_abort";
			removeButton.value = i18n.get("file_abort", fileName);
			icon.add(removeButton, "fa-ban");
			item.appendChild(removeButton);
			item.appendChild(document.createTextNode(fileName));
			progress = item.appendChild(document.createElement("progress"));
			progress.setAttribute("min", 0);
			progress.setAttribute("max", 100);
			progress.setAttribute("value", 0);
			item.setAttribute("id", id);
			itemContainer.appendChild(item);
			return id;
		};

		/**
		 * Tests if an element is a file upload.
		 * @function module:wc/ui/multiFileUpload.isOneOfMe
		 * @param {Element} element The DOM element to test
		 * @param {Boolean} input If true test the input element, not the container
		 * @returns {Boolean} true if element is the Widget type rewuested
		 */
		this.isOneOfMe = function (element, input) {
			var result = false;
			if (element) {
				if (input) {
					result = inputElementWd.isOneOfMe(element);
				} else {
					result = containerWd.isOneOfMe(element);
				}
			}
			return result;
		};

		/**
		 * Sets a file selector to an empty value.
		 * As usual this apparently simple task is made complex due to Internet Explorer.
		 * @param {Element} element A file input.
		 */
		this.clearInput = function (element) {
			clearSelector(element, function (selector, cloned) {
				if (cloned) {
					initialiseFileInput(selector);
				}
			});
		};
	}

	/**
	 *
	 * @param {Element} element A file selector
	 * @returns {string} The file upload URL for this fileselector
	 */
	function getUploadUrl(element) {
		var result = Trigger.getUrl(element);
		if (!result && element.form) {
			result = element.form.action;
			console.log("File upload URL not set, attempting to use original form action instead", result);
		}
		return result;
	}

	/**
	 * Handles progress events and updates the DOM accordingly.
	 * @param {string} fileInfoId The ID of the widget tracking the upload in the DOM.
	 */
	function progressEventFactory(fileInfoId) {
		return function (e) {
			var progress, fileInfo = document.getElementById(fileInfoId);
			if (e.lengthComputable && fileInfo) {
				progress = fileInfo.querySelector("progress");
				if (progress) {
					progress.value = (e.loaded / e.total) * 100;
					console.log(fileInfoId, "loaded:", e.loaded, "total:", e.total);
				}
			}
		};
	}

	/**
	 * If something goes wrong with the upload then tell the user about it and do some cleanup.
	 * @param {string} fileInfoId The ID of the widget tracking the upload in the DOM.
	 */
	function errorHandlerFactory(fileInfoId) {
		return function (errorMessage) {
			var fileInfo = document.getElementById(fileInfoId);
			delete inflightXhrs[fileInfoId];
			if (fileInfo) {
				feedback.flagError({
					element: fileInfo,
					message: errorMessage
				});
			}
			console.log("Error in file upload:", fileInfoId);
		};
	}

	/**
	 * Handle the case where the user aborts the upload.
	 * @param {string} fileInfoId The ID of the widget tracking the upload in the DOM.
	 */
	function abortHandlerFactory(fileInfoId) {
		return function () {
			delete inflightXhrs[fileInfoId];
			console.log("Aborted file upload:", fileInfoId);
		};
	}

	/**
	 * Asynchronously upload files to the server using XMLHTTPRequest.
	 * This replaces an older implementation using hidden iframe + hidden form.
	 * @constructor module:wc/ui/multiFileUpload~TrueAjax
	 * @private
	 */
	function TrueAjax() {

		/**
		 * @returns {Number} The total number of uploads in progress.
		 */
		this.getUploading = function () {
			var progress = progressWd.findDescendants(document.body);
			return progress ? progress.length : 0;
		};

		/**
		 * Upload the files reference in the dto.
		 * @param {module:wc/file/MultiFileUploader~fileInfo} dto
		 */
		this.request = function (dto) {
			var i, uploadName = dto.element.name, id, file,
				container = dto.container;
			try {
				for (i = 0; i < dto.files.length; i++) {
					file = dto.files[i];
					id = instance.createFileInfo(container, file.name);
					sendFile(dto.url, uploadName, id, file, callbackWrapper(dto, id));
				}
			} finally {
				instance.clearInput(dto.element);
			}
		};

		/**
		 * Returns a callback for sendFile.
		 * @param {module:wc/file/MultiFileUploader~fileInfo} dto
		 * @param {string} fileId A unique ID by which to track this particular file upload.
		 * @returns {Function} The callback wrapper.
		 */
		function callbackWrapper(dto, fileId) {
			return function (srcTree) {
				processResponse({
					dto: dto,
					srcTree: srcTree,
					xhr: this
				}, fileId);
			};
		}

		function processResponse(response, fileId) {
			var onError = function () {
					errorHandlerFactory(fileId).call(response.xhr);
				},
				df = toDocFragment(response.xhr.responseText),
				dto = response.dto,
				inflight,
				container = document.createElement(fileInfoContainerWd.tagName);

			if (df) {
				if (df.NodeType === Node.DOCUMENT_NODE) {
					df = df.firstElementChild;
				}
				container.appendChild(df);
				dto.callback(container);
				inflight = Object.keys(inflightXhrs);
				if (inflight.length === 0) {
					dto.complete(dto.container.id);
				}
				if (!container.innerHTML) {
					onError();
				}
			}
		}

		/**
		 * Upload this file to the server.
		 * @param {string} uri The URL to upload the file to.
		 * @param {string} uploadName The name of the file selector, i.e. the parameter name expected by the server.
		 * @param {string} fileId A unique ID by which to track this particular file upload.
		 * @param {File} file The file to upload.
		 * @param {Function} callback The function to call on success.
		 */
		function sendFile(uri, uploadName, fileId, file, callback) {
			var request, xhr, formData = new FormData(),
				onProgress = progressEventFactory(fileId),
				onError = errorHandlerFactory(fileId),
				onAbort = abortHandlerFactory(fileId);
			formData.append("wc_ajax", uploadName);
			formData.append("wc_ajax_int", "x");
			formData.append("wc_fileuploadid", fileId);
			/*
			 * On the line below we specify the file name because some browsers do not support the File constructor.
			 * In this case the file object is actually a Blob with the same duck type as a File.
			 * The name, however, is a readonly property of blob and while we may appear to have overridden the value we probably haven't.
			 */
			formData.append(uploadName, file, file.name);

			request = {
				url: uri,
				callback: callback,
				onProgress: onProgress,
				onError: onError,
				onAbort: onAbort,
				cache: false,
				responseType: ajax.responseType.XML,
				postData: formData
			};
			xhr = ajax.simpleRequest(request);
			inflightXhrs[fileId] = xhr;
		}
	}

	initialise.register(instance);
	return instance;
});
