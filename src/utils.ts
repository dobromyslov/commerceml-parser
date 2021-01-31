export function convertToArray<T>(arrayOrSingleValue: T): T[] {
  if (arrayOrSingleValue === undefined) {
    return [];
  }

  if (!Array.isArray(arrayOrSingleValue)) {
    return [arrayOrSingleValue];
  }

  return arrayOrSingleValue;
}
