export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isDisplayDateValid(value: string): boolean {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    return false;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) {
    return false;
  }

  const lastDay = new Date(year, month, 0).getDate();
  return day <= lastDay;
}

export function displayDateToIso(value: string): string {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) {
    throw new Error('Data invalida. Use o formato dd/mm/aaaa.');
  }

  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];

  return `${year}-${month}-${day}`;
}

export function isoDateToDisplay(value: string): string {
  const datePart = value.includes('T') ? value.split('T')[0] : value;
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return value;
  }

  const year = match[1];
  const month = match[2];
  const day = match[3];

  return `${day}/${month}/${year}`;
}
