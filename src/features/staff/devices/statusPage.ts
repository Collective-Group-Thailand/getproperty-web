/**
 * The gateway's LAN status page (getproperty-edge E1.3, D-132): read-only HTML on port 8080 of the
 * gateway's address, with the one-time provisioning entry while unprovisioned. The cloud does not
 * know the LAN address, so the installer types it (router list or the label); only a private IPv4
 * address or a `.local` name is accepted — never a public host.
 */
export function statusPageUrl(address: string): string | null {
  const value = address.trim();
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (ipv4.slice(1).some((part) => Number(part) > 255)) return null;
    const isPrivate =
      a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
    return isPrivate ? `http://${value}:8080/` : null;
  }
  if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.local$/i.test(value)) return `http://${value.toLowerCase()}:8080/`;
  return null;
}
