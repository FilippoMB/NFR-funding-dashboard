const currencyFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0
});

const compactCurrencyFormatter = new Intl.NumberFormat("nb-NO", {
  currency: "NOK",
  maximumFractionDigits: 1,
  notation: "compact",
  style: "currency"
});

const numberFormatter = new Intl.NumberFormat("nb-NO");

export function formatCurrency(value) {
  return currencyFormatter.format(value);
}

export function formatCompactCurrency(value) {
  return compactCurrencyFormatter.format(value);
}

export function formatNumber(value) {
  return numberFormatter.format(value);
}
