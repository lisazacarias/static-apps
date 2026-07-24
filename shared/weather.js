// ==========================================================================
// Shared weather helper — Open-Meteo (keyless, no signup, CORS-enabled).
// ==========================================================================
const WX = "https://api.open-meteo.com/v1/forecast";

// WMO weather code → emoji + label.
export function wxLabel(code) {
  if (code === 0) return "☀️ Clear";
  if (code <= 3)  return "⛅ Cloudy";
  if (code <= 48) return "🌫️ Fog";
  if (code <= 67) return "🌧️ Rain";
  if (code <= 77) return "🌨️ Snow";
  if (code <= 82) return "🌦️ Showers";
  return "🌩️ Storm";
}

// Current conditions + N-day daily forecast in one call.
export async function forecast([lng, lat], days = 3) {
  try {
    const url = `${WX}?latitude=${lat}&longitude=${lng}`
      + `&current=temperature_2m,wind_speed_10m,weather_code`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,`
      + `wind_speed_10m_max,precipitation_probability_max`
      + `&temperature_unit=fahrenheit&wind_speed_unit=mph`
      + `&timezone=auto&forecast_days=${days}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();

    const current = j.current ? {
      airF: Math.round(j.current.temperature_2m),
      windMph: Math.round(j.current.wind_speed_10m),
      code: j.current.weather_code,
    } : null;

    const d = j.daily;
    const days_ = d ? d.time.map((date, i) => ({
      date,
      hi: Math.round(d.temperature_2m_max[i]),
      lo: Math.round(d.temperature_2m_min[i]),
      wind: Math.round(d.wind_speed_10m_max[i]),
      rain: d.precipitation_probability_max[i],
      code: d.weather_code[i],
    })) : [];

    return { current, days: days_ };
  } catch (e) {
    console.warn("forecast failed", e.message);
    return null;
  }
}

// Wind quality for SUP: green calm / amber breezy / red choppy.
export function windClass(mph) {
  if (mph == null) return "";
  if (mph <= 8)  return "wind-ok";
  if (mph <= 15) return "wind-warn";
  return "wind-bad";
}