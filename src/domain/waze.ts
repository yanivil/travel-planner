// Waze is the navigation default in Israel (D-002 context, spec §4.1):
// we deep-link out and never pretend to be a navigator.
export function wazeUrl(query: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(query.trim())}&navigate=yes`;
}
