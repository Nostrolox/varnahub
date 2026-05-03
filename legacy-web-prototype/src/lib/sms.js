function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function buildParkingSms({ number, plate, zoneCode }) {
  const cleanNumber = String(number || "")
    .trim()
    .replace(/[^\d+]/g, "");
  const cleanPlate = String(plate || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const cleanZone = String(zoneCode || "").trim().toUpperCase();

  if (!cleanNumber) {
    throw new Error("SMS parking number is not configured.");
  }

  if (!cleanPlate) {
    throw new Error("Add your car plate before opening SMS.");
  }

  const message = `${cleanZone} ${cleanPlate}`.trim();
  const separator = isIOS() ? "&" : "?";

  return {
    message,
    url: `sms:${cleanNumber}${separator}body=${encodeURIComponent(message)}`,
  };
}

export function openParkingSms(options) {
  const sms = buildParkingSms(options);
  window.location.href = sms.url;
  return sms;
}
