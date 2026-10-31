/**
 * Shared filter model for the player/agent detail tabs.
 *
 * Every tab describes its filters as data (`FilterField[]`) and the generic
 * toolbar + sheet render them, so a tab only owns its field list and how the
 * values turn into query params. Adding a filter to a tab is a config change,
 * not another bespoke filter bar.
 */

export type FilterValues = Record<string, string>;

export interface FilterOption {
  label: string;
  value: string;
}

interface BaseField {
  /** Shown as the control's label in the sheet, and as the chip prefix. */
  label: string;
  /** Hidden unless this returns true — used for "custom range" date inputs. */
  showWhen?: (values: FilterValues) => boolean;
  /** Small helper line under the control. */
  hint?: string;
}

export interface SelectField extends BaseField {
  type: "select";
  key: string;
  options: FilterOption[];
}

export interface TextField extends BaseField {
  type: "text";
  key: string;
  placeholder?: string;
}

/**
 * Several options at once, as checkboxes.
 *
 * The value is the selected values joined by commas, because `FilterValues` is
 * a flat string map — everything else in this system (the chips, the reset, the
 * param builder) already works on that shape, and a nested array here would
 * have meant special-casing all three. Empty string means "no restriction",
 * which is also its default, so an untouched group adds no chip and no param.
 */
export interface CheckboxGroupField extends BaseField {
  type: "checkboxGroup";
  key: string;
  options: FilterOption[];
}

export interface DateRangeField extends BaseField {
  type: "dateRange";
  fromKey: string;
  toKey: string;
}

export interface NumberRangeField extends BaseField {
  type: "numberRange";
  minKey: string;
  maxKey: string;
}

export type FilterField =
  | SelectField
  | TextField
  | CheckboxGroupField
  | DateRangeField
  | NumberRangeField;

export interface FilterChip {
  key: string;
  label: string;
  clear: () => void;
}

/** The selected values of a checkbox group, as a list. */
export const checkedValues = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

/** Keys a field owns, so a chip can clear all of them at once. */
export const fieldKeys = (field: FilterField): string[] => {
  switch (field.type) {
    case "dateRange":
      return [field.fromKey, field.toKey];
    case "numberRange":
      return [field.minKey, field.maxKey];
    default:
      return [field.key];
  }
};
