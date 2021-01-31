/**
 * Converts a single value to the array containing the single value.
 * If the value is undefined then returns an empty array.
 * @param arrayOrSingleValue A single value or an array.
 */
export function convertToArray<T>(arrayOrSingleValue: T): T[] {
  if (arrayOrSingleValue === undefined) {
    return [];
  }

  if (!Array.isArray(arrayOrSingleValue)) {
    return [arrayOrSingleValue];
  }

  return arrayOrSingleValue;
}
