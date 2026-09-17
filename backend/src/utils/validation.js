function isIsoDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeString(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function isValidDateTimeString(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  isIsoDateString,
  isValidTimeString,
  isValidDateTimeString,
  parsePositiveInteger
};
