define(["wc/render/utils",
	"wc/has",
	"wc/i18n/i18n",
	"wc/dom/shed",
	"wc/dom/dateFieldUtils",
	"wc/mixin"],
	function(renderUtils, has, i18n, shed, dfUtils, mixin) {

		var inputAttributeMap = {
				"data-wc-tooltip": "title",
				"data-wc-required": "required",
				"data-wc-disabled": "disabled",
				"data-wc-accessibletext": "aria-label",
				"data-wc-buttonid": "data-wc-submit",
				"data-wc-placeholder": "placeholder",
				"data-wc-min": "min",
				"data-wc-max": "max",
				"aria-busy": null,
				"aria-describedby": null,
				"aria-invalid": null
			},
			widgets = dfUtils.getWidgets();

		function renderAsync(element) {
			var messageKeys = ["datefield_title_default", "datefield_partial_switcher_label"],
				bundle = {};
			return i18n.translate(messageKeys).then(function(messages) {
				var i;
				for (i = 0; i < messageKeys.length; i++) {
					bundle[messageKeys[i]] = messages[i];
				}
				renderDateField(element, bundle);
			});
		}

		function getId(element) {
			return element.id || element.getAttribute("data-wc-id");
		}

		function gatherFieldIndicators(element, target) {
			// TODO how will this work with client side validation messages?
			var result= target,
				container = element.querySelector("wc-fieldindicator");
			if (container) {
				renderUtils.importKids(container, result);
			}
			return result;
		}

		function renderDateField(element, i18nBundle) {
			var allowPartial = element.getAttribute("data-wc-allowpartial"),
				elements;
			if (!has("native-dateinput") || allowPartial === "true" || dfUtils.hasPartialDate(element)) {
				elements = [createFakeDateInput(element, i18nBundle)];
				elements.push(renderDatePickerLauncher(element));
				elements.push(createListBox());
			} else {
				elements = [createDateInput(element)];
			}
			if (allowPartial !== null) {
				elements.push(createPartialSwitcher(element, i18nBundle));
			}
			gatherFieldIndicators(element, elements);
			elements = createContainer(element, elements);
			element.parentNode.replaceChild(elements, element);
		}

//		function createWrapper(children) {
//			var wrapper = document.createDocumentFragment();
//			children.forEach(function(element) {
//				wrapper.appendChild(element);
//			});
//			return wrapper;
//		}

		function createPartialSwitcher(element, i18nBundle) {
			var switcher,
				dateFieldId = getId(element),
				switcherId = dateFieldId + "_partial",
				allowPartial = element.getAttribute("data-wc-allowpartial"),
				config = {
					attrs: {
						name: switcherId,
						type: "checkbox",
						value: "true",
						"aria-controls": dateFieldId
					},
					onChange: changeEvent
				};
			if (allowPartial === "true") {
				config.attrs.checked = "checked";
			}
			/*
			 * The mere existence of @allowPartial indicates that we are dealing with a partial date field.
			 * The value is irrelevant, it really has three meaningful states:
			 * "true" - allow partial dates and user requested partial
			 * "false" - allow partial dates but user has not requested partialx
			 * null - does not allow partial dates
			 */
			switcher = renderUtils.createElement("input", config);
			if (isDisabled(element)) {
				switcher.disabled = true;
			}
			switcher = renderUtils.createElement("label", {}, [switcher, i18nBundle["datefield_partial_switcher_label"]]);
			switcher = renderUtils.createElement("div", {}, [switcher]);
			return switcher;
		}

		function renderDatePickerLauncher(element) {
			var icon, result, config = {
					attrs: {
						"aria-hidden": "true",
						tabindex: "-1",
						type: "button",
						value: getId(element) + "_input"
					}
				};
			icon = renderUtils.createElement("i", { attrs: {"aria-hidden": "true"} });
			icon.className = "fa fa-calendar";

			result = renderUtils.createElement("button", config, [icon]);
			result.className = "wc_wdf_cal wc-invite";

			if (isDisabled(element)) {
				result.disabled = true;
			}

			return result;
		}

		function createContainer(element, children) {
			var container,
				config = { attrs: {} };

			renderUtils.extractAttributes(element, { "aria-busy": null, "data-wc-id": "id" }, config.attrs);

			mixin({
				role: "combobox",
				"aria-autocomplete": "list",
				"aria-expanded": "false" },
			config.attrs);

			container = renderUtils.createElement("div", config, children);
			container.classList.add("wc-datefield");
			container.classList.add("wc-input-wrapper");
			if (element.hasAttribute("data-wc-allowpartial")) {
				container.classList.add("wc_datefield_partial");
			}
			return container;
		}

		function createListBox() {
			var config = {
				attrs: {
					"aria-busy": "true",
					role: "listbox"
				}
			};
			return renderUtils.createElement("span", config);
		}

		function createDateInput(element) {
			var input, fieldId = getId(element),
				dateVal = dfUtils.getValue(element),
				config = { attrs: {} };

			renderUtils.extractAttributes(element, inputAttributeMap, config.attrs);
			mixin({
				value: dateVal,
				id: fieldId + "_input",
				name: fieldId,
				type: "date",
				autocomplete: "off" },
			config.attrs);

			if (!dateVal) {
				config.attrs["aria-invalid"] = "true";
			}

			input = renderUtils.createElement("input", config);

			if (element.hasAttribute("wc-data-submitonchange")) {
				input.className = "wc_soc";
			}
			return input;
		}

		function createFakeDateInput(element, i18nBundle) {
			var input,
				fieldId = getId(element),
				config = { attrs: {
					title: i18nBundle["datefield_title_default"]
				} };
			renderUtils.extractAttributes(element, inputAttributeMap, config.attrs);
			mixin({
				value: dfUtils.getRawValue(element),
				id: fieldId + "_input",
				name: fieldId,
				type: "text",
				autocomplete: "off" },
			config.attrs);

			input = renderUtils.createElement("input", config);

			if (element.hasAttribute("wc-data-submitonchange")) {
				input.className = "wc_soc";
			}
			return input;
		}

		function changeEvent($event) {
			var switcher = $event.target,
				containerId = switcher.getAttribute("aria-controls"),
				dateField = document.getElementById(containerId);
			if (dateField) {
				dateField.setAttribute("data-wc-allowpartial", switcher.checked);
				renderAsync(dateField);
			}
		}

		function isDisabled(element) {
			return element.hasAttribute("data-wc-disabled") || shed.isDisabled(element);
		}

		return {
			widgets: widgets,
			render: renderAsync
		};
	});
