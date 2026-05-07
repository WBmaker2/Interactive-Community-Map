export const APP_SCHEMA_VERSION = 2;
export const STORAGE_KEY = "community_map_entries_v1";
export const SESSION_STORAGE_KEY = "community_map_session_v1";
export const DEFAULT_CENTER = [37.5665, 126.978];
export const DEFAULT_ZOOM = 15;

export const CATEGORIES = [
  {
    key: "pride",
    label: "살기 좋은 곳",
    icon: "🍏",
    symbol: "좋",
    color: "#2f9d44",
  },
  {
    key: "safety",
    label: "주의할 곳",
    icon: "⚠️",
    symbol: "!",
    color: "#d6463a",
  },
  {
    key: "help",
    label: "도움받는 곳",
    icon: "🏥",
    symbol: "+",
    color: "#1e79c2",
  },
];

export const CATEGORY_BY_KEY = Object.freeze(
  Object.fromEntries(CATEGORIES.map((category) => [category.key, category]))
);

export function getCategoryLabel(category) {
  return `${category.icon} ${category.label}`;
}
