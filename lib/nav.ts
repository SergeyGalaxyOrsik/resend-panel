export function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard"
  }

  if (pathname === href) {
    return true
  }

  return pathname.startsWith(`${href}/`)
}
