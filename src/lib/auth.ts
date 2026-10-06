/** Odhlásenie rieši Cloudflare Access na doméne aplikácie: zmaže prihlasovaciu cookie a vráti na prihlásenie. */
export const ACCESS_LOGOUT_PATH = '/cdn-cgi/access/logout'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Lokálne (vývoj) žiadne Access nie je, takže tam sa odhlásenie neponúka. */
export const canLogout = (hostname: string): boolean => !LOCAL_HOSTS.has(hostname)
