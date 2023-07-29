function formatDateToDDMMYYHHMMSS() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).substr(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ddmmyyhhmmss = `${day}${month}${year}${hours}${minutes}${seconds}`;
  return ddmmyyhhmmss;
}

module.exports = {formatDateToDDMMYYHHMMSS}